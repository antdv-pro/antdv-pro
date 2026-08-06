import process from 'node:process'

const baseUrl = process.env.LIVE_SITE_URL || 'https://www.erpxt.online'
const username = process.env.LIVE_SITE_USERNAME || 'admin'
const password = process.env.LIVE_SITE_PASSWORD

if (!password)
  throw new Error('LIVE_SITE_PASSWORD is required; default production credentials are forbidden')

function assert(condition, message) {
  if (!condition)
    throw new Error(message)
}

async function request(path, { method = 'GET', token, body, headers } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: token } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body == null ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  }
  catch {
    json = { raw: text }
  }
  assert(response.ok, `${method} ${path} HTTP ${response.status}: ${text.slice(0, 500)}`)
  assert(!/500\s*Internal Server Error/i.test(text), `${method} ${path} returned 500 text`)
  return { response, json, text }
}

function countOf(data) {
  if (Array.isArray(data))
    return data.length
  if (data?.records && Array.isArray(data.records))
    return data.records.length
  if (data && typeof data === 'object') {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? value.length : typeof value]))
  }
  return typeof data
}

async function uploadFixture(token, filename, type, content) {
  const file = new File([content], filename, { type })
  const form = new FormData()
  form.append('file', file)
  const { json } = await request('/api/uploads', { method: 'POST', token, body: form })
  assert(json.code === 200, `上传失败: ${JSON.stringify(json)}`)
  assert(json.data?.url, `上传未返回 URL: ${JSON.stringify(json)}`)
  const fileResponse = await fetch(`${baseUrl}${json.data.url}`)
  assert(fileResponse.ok, `上传文件无法访问: ${json.data.url} HTTP ${fileResponse.status}`)
  return json.data
}

const login = await request('/api/login', {
  method: 'POST',
  body: { username, password, type: 'account' },
})
const token = login.json?.data?.token
assert(token, `登录未返回 token: ${login.text}`)

try {
  const checks = [
    ['GET', '/api/readyz'],
    ['GET', '/api/user/info'],
    ['GET', '/api/menu'],
    ['GET', '/api/approval/templates'],
    ['GET', '/api/approval/instances'],
    ['GET', '/api/approval/tasks/todo?userId=4'],
    ['GET', '/api/approval/tasks/done?userId=4'],
    ['GET', '/api/approval/tasks/submitted?userId=1'],
    ['GET', '/api/approval/cc/mine?userId=1'],
    ['GET', '/api/approval/business-records'],
    ['GET', '/api/approval/oa-module/data'],
    ['GET', '/api/system/users'],
    ['GET', '/api/system/orgs'],
    ['GET', '/api/system/roles'],
    ['GET', '/api/system/dicts'],
    ['GET', '/api/system/logs/login'],
    ['GET', '/api/system/logs/operation'],
    ['GET', '/api/transport/operations/data'],
    ['POST', '/api/transport/fees', { current: 1, pageSize: 10 }],
    ['POST', '/api/transport/fees/summary', {}],
    ['POST', '/api/transport/fees/overview', {}],
    ['POST', '/api/transport/maintenance/summary', { records: [] }],
    ['GET', '/api/gps/map-data?userId=1&role=ADMIN'],
    ['GET', '/api/gps/vehicles?userId=1&role=ADMIN'],
    ['GET', '/api/gps/locations/latest?userId=1&role=ADMIN'],
    ['GET', '/api/gps/status'],
    ['GET', '/api/gps/alarms?userId=1&role=ADMIN'],
    ['GET', '/api/gps/devices'],
    ['GET', '/api/gps/geofences'],
    ['GET', '/api/gps/provider-configs'],
    ['GET', '/api/gps/sync-logs'],
    ['GET', '/api/gps/operation-logs'],
    ['GET', '/api/trade/orders'],
    ['GET', '/api/hotel/revenue'],
    ['POST', '/api/office-vehicle/summary', {}],
    ['POST', '/api/office-vehicle/vehicles', { current: 1, pageSize: 10 }],
    ['POST', '/api/office-vehicle/expenses', { current: 1, pageSize: 10 }],
    ['POST', '/api/office-vehicle/licenses', { current: 1, pageSize: 10 }],
    ['POST', '/api/office-vehicle/insurances', { current: 1, pageSize: 10 }],
    ['POST', '/api/office-vehicle/reminders', { current: 1, pageSize: 10 }],
    ['GET', '/api/office-vehicle/logs'],
    ['GET', '/api/transport/bill-reconciliation/archives'],
  ]

  const results = []
  for (const [method, path, body] of checks) {
    const { json } = await request(path, { method, token, body })
    assert(json.code == null || json.code === 200, `${method} ${path} code ${json.code}: ${json.msg}`)
    results.push({ method, path, code: json.code ?? 'raw', count: countOf(json.data) })
  }

  const transport = (await request('/api/transport/operations/data', { token })).json.data
  const gps = (await request('/api/gps/map-data?userId=1&role=ADMIN', { token })).json.data
  assert(transport.orders.length > 0, '运输订单为空')
  assert(transport.fuels.length > 0, '加油明细为空')
  assert(transport.etc.length > 0, 'ETC 费用为空')
  assert(gps.vehicles.length > 0 && gps.locations.length > 0, 'GPS 车辆或位置为空')

  const firstOrder = transport.orders[0]
  const orderApproval = await request(`/api/approval/instances?businessType=transport_order&businessId=${encodeURIComponent(firstOrder.code || firstOrder.id)}`, { token })
  assert(Array.isArray(orderApproval.json.data), '运输订单审批关联接口不是数组')

  const uploaded = []
  uploaded.push(await uploadFixture(token, '验收附件.pdf', 'application/pdf', '%PDF-1.4\n% test pdf\n'))
  uploaded.push(await uploadFixture(token, '验收文档.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'PK\u0003\u0004docx'))
  uploaded.push(await uploadFixture(token, '验收表格.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'PK\u0003\u0004xlsx'))

  console.table(results.map(item => ({ ...item, count: JSON.stringify(item.count).slice(0, 80) })))
  console.table(uploaded.map(item => ({ originalName: item.originalName, size: item.size, url: item.url })))
  console.log('[live:modules] 所有模块接口、关键关联和 PDF/DOCX/XLSX 上传验证通过')
}
finally {
  await request('/api/logout', { token }).catch(() => undefined)
}

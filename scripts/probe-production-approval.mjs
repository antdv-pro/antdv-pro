const baseUrl = (process.env.PROBE_BASE_URL || 'https://www.erpxt.online/api').replace(/\/$/, '')
const username = process.env.PROBE_USERNAME || 'admin'
const password = process.env.PROBE_PASSWORD

if (!password)
  throw new Error('PROBE_PASSWORD is required; default production credentials are forbidden')

const approvalPaths = [
  '/approval/tasks/todo',
  '/approval/tasks/done',
  '/approval/tasks/submitted',
  '/approval/cc/mine',
  '/approval/instances',
  '/approval/templates',
  '/approval/business-records',
]

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'enterprise-approval-probe/1.0',
      ...(options.body ? { 'Content-Type': 'application/json;charset=UTF-8' } : {}),
      ...(options.headers || {}),
    },
  })
  const text = await response.text()
  return {
    status: response.status,
    text,
  }
}

function preview(text) {
  return text.replace(/\s+/g, ' ').slice(0, 240)
}

console.log(`probe_base_url=${baseUrl}`)
console.log(`probe_time_utc=${new Date().toISOString()}`)

const login = await request('/login', {
  method: 'POST',
  body: JSON.stringify({ username, password, type: 'account' }),
})
console.log(`POST /login ${login.status} ${preview(login.text)}`)

let token = ''
try {
  token = JSON.parse(login.text)?.data?.token || ''
}
catch {}

if (!token) {
  console.error('login_failed_no_token')
  process.exitCode = 1
}
else {
  for (const path of approvalPaths) {
    const result = await request(path, {
      headers: {
        Authorization: token,
      },
    })
    console.log(`GET ${path} ${result.status} ${preview(result.text)}`)
    if (result.status >= 500)
      process.exitCode = 1
  }
}

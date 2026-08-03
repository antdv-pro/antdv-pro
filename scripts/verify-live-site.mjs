import process from 'node:process'

const baseUrl = process.env.LIVE_SITE_URL || 'https://www.erpxt.online'
const username = process.env.LIVE_SITE_USERNAME || 'admin'
const password = process.env.LIVE_SITE_PASSWORD

if (!password)
  throw new Error('LIVE_SITE_PASSWORD is required; default production credentials are forbidden')

const requiredRoutes = [
  '/dashboard/workplace',
  '/transport/orders',
  '/transport/operations',
  '/trade/orders',
  '/hotel',
]

const apiChecks = [
  ['/api/readyz', '数据库就绪状态'],
  ['/api/user/info', '用户信息'],
  ['/api/approval/instances?businessType=transport_order', '运输订单审批'],
  ['/api/approval/instances?businessType=transport_etc', 'ETC 审批'],
  ['/api/approval/instances?businessType=salary', '司机薪酬审批'],
  ['/api/transport/operations/data', '运输运营数据'],
  ['/api/trade/orders', '贸易订单'],
  ['/api/hotel/revenue', '酒店收入'],
  ['/api/gps/map-data', '北斗地图数据'],
]

function hasMojibake(text) {
  return /è¶|ç\u0090|å‘|Ã|Â|�/.test(text)
}

function assert(condition, message) {
  if (!condition)
    throw new Error(message)
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  }
  catch {
    json = { raw: text }
  }
  return { response, json, text }
}

async function getJson(url, token) {
  const response = await fetch(url, {
    headers: token ? { Authorization: token } : {},
  })
  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  }
  catch {
    json = { raw: text }
  }
  return { response, json, text }
}

async function verifyApis() {
  const login = await postJson(`${baseUrl}/api/login`, { username, password })
  assert(login.response.ok, `登录接口失败: HTTP ${login.response.status} ${login.text}`)
  assert(login.json?.data?.token, `登录接口未返回 token: ${login.text}`)

  const token = login.json.data.token
  const results = []
  for (const [path, name] of apiChecks) {
    const result = await getJson(`${baseUrl}${path}`, token)
    const text = result.text || ''
    assert(result.response.ok, `${name} 接口失败: HTTP ${result.response.status} ${text}`)
    assert(!hasMojibake(text), `${name} 接口仍有乱码: ${text.slice(0, 500)}`)
    assert(!/500\s*Internal Server Error/i.test(text), `${name} 接口仍返回 500 文本`)
    results.push({
      name,
      path,
      status: result.response.status,
      code: result.json?.code ?? result.json?.status ?? '',
      empty: Array.isArray(result.json?.data) ? result.json.data.length === 0 : false,
    })
  }

  console.table(results)
  console.log('[live:verify] 接口级验证通过')
}

async function readPageState(page) {
  return page.evaluate(() => {
    const bodyText = document.body?.innerText || ''
    const placeholders = [...document.querySelectorAll('input')].map(input => input.placeholder).filter(Boolean)
    return {
      url: location.href,
      title: document.title,
      bodyText,
      bodyTextStart: bodyText.slice(0, 1200),
      placeholders,
      localStorage: { ...localStorage },
    }
  })
}

async function loginInBrowser(page) {
  await page.goto(`${baseUrl}/dashboard/workplace`, { waitUntil: 'networkidle', timeout: 45000 })
  const loginState = await readPageState(page)

  assert(!loginState.url.includes('%252F'), `登录重定向仍被双重编码: ${loginState.url}`)
  assert(
    !loginState.placeholders.some(item => /admin|user/i.test(item)),
    `登录页仍暴露默认账号密码: ${loginState.placeholders.join(', ')}`,
  )

  if (!page.url().includes('/login'))
    return loginState

  await page.locator('input[type="text"]').fill(username)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button').filter({ hasText: /Login|登\s*录/ }).click()
  await page.waitForTimeout(5000)

  const afterLogin = await readPageState(page)
  assert(!afterLogin.url.includes('/login'), `登录失败，仍停留在: ${afterLogin.url}`)
  assert(afterLogin.localStorage.Authorization, '登录后没有写入 Authorization token')
  return afterLogin
}

async function verifyRoute(page, route) {
  const responseErrors = []
  const onResponse = (response) => {
    if (response.status() >= 400)
      responseErrors.push({ url: response.url(), status: response.status(), statusText: response.statusText() })
  }

  page.on('response', onResponse)
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(1000)
    const state = await readPageState(page)

    assert(!state.url.includes('/login'), `${route} 访问后被重定向到登录页`)
    assert(!hasMojibake(state.bodyText), `${route} 页面仍有乱码`)
    assert(!/500\s*Internal Server Error/i.test(state.bodyText), `${route} 页面仍直接显示 500 Internal Server Error`)

    return {
      route,
      title: state.title,
      url: state.url,
      hasNoData: /\bNo data\b|暂无/.test(state.bodyText),
      responseErrors,
    }
  }
  finally {
    page.off('response', onResponse)
  }
}

async function verifyBrowser() {
  let playwright
  try {
    playwright = await import('playwright')
  }
  catch {
    console.warn('[live:verify] 未安装 Playwright，降级为接口级验证')
    await verifyApis()
    return
  }

  const browser = await playwright.chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, ignoreHTTPSErrors: true })
  const page = await context.newPage()

  try {
    await loginInBrowser(page)
    const results = []
    for (const route of requiredRoutes)
      results.push(await verifyRoute(page, route))

    const hardErrors = results.flatMap(result => result.responseErrors.map(error => ({ route: result.route, ...error })))
    if (hardErrors.length)
      throw new Error(`存在 HTTP 错误: ${JSON.stringify(hardErrors, null, 2)}`)

    console.table(results.map(result => ({
      route: result.route,
      title: result.title,
      hasNoData: result.hasNoData,
    })))

    const emptyBusinessRoutes = results
      .filter(result => ['/transport/orders', '/trade/orders', '/hotel'].includes(result.route) && result.hasNoData)
      .map(result => result.route)

    if (emptyBusinessRoutes.length) {
      console.warn(`[live:verify] 以下业务页面仍是空态，请确认业务数据是否已导入: ${emptyBusinessRoutes.join(', ')}`)
      process.exitCode = 2
      return
    }

    console.log('[live:verify] 页面级验证通过')
  }
  finally {
    const token = await page.evaluate(() => localStorage.getItem('Authorization')).catch(() => '')
    if (token)
      await getJson(`${baseUrl}/api/logout`, token).catch(() => undefined)
    await browser.close()
  }
}

verifyBrowser().catch((error) => {
  console.error('[live:verify] failed')
  console.error(error)
  process.exit(1)
})

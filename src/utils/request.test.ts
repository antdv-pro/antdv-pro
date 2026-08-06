import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDelete, useGet, usePost, usePut } from './request'

const mocks = vi.hoisted(() => ({
  requestHandler: undefined as any,
  responseHandler: undefined as any,
  errorHandler: undefined as any,
  request: vi.fn(),
  token: { value: 'session-token' as string | null },
  locale: { value: 'zh-CN' },
  notification: { error: vi.fn() },
  router: { currentRoute: { value: { fullPath: '/orders?page=1', query: {} as Record<string, any> } }, push: vi.fn() },
  loading: { addLoading: vi.fn(), closeLoading: vi.fn() },
}))

vi.mock('axios', () => ({ default: { create: vi.fn(() => ({
  request: mocks.request,
  interceptors: {
    request: { use: vi.fn((handler: any) => mocks.requestHandler = handler) },
    response: { use: vi.fn((handler: any, error: any) => {
      mocks.responseHandler = handler
      mocks.errorHandler = error
    }) },
  },
})) } }))
vi.mock('~/composables/authorization', () => ({ STORAGE_AUTHORIZE_KEY: 'Authorization', useAuthorization: () => mocks.token }))
vi.mock('~/router', () => ({ default: mocks.router }))
vi.mock('~@/composables/i18n-locale', () => ({ useI18nLocale: () => ({ locale: mocks.locale }) }))
vi.mock('~@/composables/global-config', () => ({ useNotification: () => mocks.notification }))
vi.mock('./loading', () => ({ AxiosLoading: class { addLoading = mocks.loading.addLoading; closeLoading = mocks.loading.closeLoading } }))

describe('hTTP request utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.token.value = 'session-token'
    mocks.locale.value = 'zh-CN'
    mocks.router.currentRoute.value = { fullPath: '/orders?page=1', query: {} }
    mocks.router.push.mockResolvedValue(undefined)
  })

  it('adds authorization, locale and loading metadata before requests', async () => {
    const headers = { set: vi.fn() }
    const config = { headers, loading: true } as any
    await expect(mocks.requestHandler(config)).resolves.toBe(config)
    expect(headers.set).toHaveBeenCalledWith('Authorization', 'session-token')
    expect(headers.set).toHaveBeenCalledWith('Accept-Language', 'zh-CN')
    expect(mocks.loading.addLoading).toHaveBeenCalledOnce()
  })

  it('supports anonymous requests and language fallback', async () => {
    mocks.locale.value = undefined as any
    const headers = { set: vi.fn() }
    await mocks.requestHandler({ headers, token: false })
    expect(headers.set).not.toHaveBeenCalledWith('Authorization', expect.anything())
    expect(headers.set).toHaveBeenCalledWith('Accept-Language', 'zh-CN')
  })

  it('unwraps successful Axios response data', () => {
    expect(mocks.responseHandler({ data: { code: 200, data: [1] } })).toEqual({ code: 200, data: [1] })
  })

  it('clears authorization and redirects once on 401', async () => {
    const error = { response: { status: 401, statusText: 'Unauthorized', data: { code: 401, msg: '登录过期' } } }
    await expect(mocks.errorHandler(error)).rejects.toBe(error)
    expect(mocks.notification.error).toHaveBeenCalledWith(expect.objectContaining({ message: '401', description: '登录过期' }))
    expect(mocks.token.value).toBeNull()
    expect(mocks.router.push).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/orders?page=1' } })
  })

  it.each([
    [403, '403'],
    [500, '500'],
    [422, '服务错误'],
  ])('reports HTTP %s with the expected notification', async (status, message) => {
    const error = { response: { status, statusText: 'Failed', data: {} } }
    await expect(mocks.errorHandler(error)).rejects.toBe(error)
    expect(mocks.notification.error).toHaveBeenCalledWith(expect.objectContaining({ message, description: 'Failed' }))
  })

  it.each([
    [{ code: 'ECONNABORTED' }, '服务响应超时'],
    [{ code: 'ERR_NETWORK' }, '无法连接服务器'],
  ])('reports transport failures clearly', async (error, message) => {
    await expect(mocks.errorHandler(error)).rejects.toBe(error)
    expect(mocks.notification.error).toHaveBeenCalledWith(expect.objectContaining({ message }))
  })

  it('suppresses notifications for silent background requests', async () => {
    const error = {
      code: 'ECONNABORTED',
      config: { errorNotification: false },
      response: { status: 500, statusText: 'Failed', data: {} },
    }
    await expect(mocks.errorHandler(error)).rejects.toBe(error)
    expect(mocks.notification.error).not.toHaveBeenCalled()
  })

  it('preserves wrapper URL and method when config attempts to override them', async () => {
    mocks.request.mockResolvedValue({ code: 200 })
    await useGet('/items', { page: 1 }, { url: '/wrong', method: 'POST', params: { page: 9 } } as any)
    await usePost('/items', { name: 'A' }, { url: '/wrong', method: 'GET', data: { name: 'B' } } as any)
    await usePut('/items/1', { name: 'C' }, { method: 'DELETE' } as any)
    await useDelete('/items/1', { hard: true }, { method: 'GET' } as any)
    expect(mocks.request.mock.calls.map(([options]) => ({ url: options.url, method: options.method }))).toEqual([
      { url: '/items', method: 'GET' },
      { url: '/items', method: 'POST' },
      { url: '/items/1', method: 'PUT' },
      { url: '/items/1', method: 'DELETE' },
    ])
    expect(mocks.request.mock.calls[0][0].params).toEqual({ page: 1 })
    expect(mocks.request.mock.calls[1][0].data).toEqual({ name: 'A' })
  })

  it('always closes request loading after success and failure', async () => {
    mocks.request.mockResolvedValueOnce({ code: 200 })
    await useGet('/success', undefined, { loading: true })
    mocks.request.mockRejectedValueOnce(new Error('offline'))
    await expect(useGet('/failure', undefined, { loading: true })).rejects.toThrow('offline')
    expect(mocks.loading.closeLoading).toHaveBeenCalledTimes(2)
  })
})

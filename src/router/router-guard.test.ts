import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  beforeEach: undefined as any,
  afterEach: undefined as any,
  addRoute: vi.fn(),
  setRouteEmitter: vi.fn(),
  useMetaTitle: vi.fn(),
  useLoadingCheck: vi.fn(),
  useScrollToTop: vi.fn(),
  token: { value: null as string | null },
  userStore: { userInfo: undefined as any, routerData: undefined as any, getUserInfo: vi.fn(), generateDynamicRoutes: vi.fn() },
}))

vi.mock('~/router', () => ({ default: {
  beforeEach: (handler: any) => mocks.beforeEach = handler,
  afterEach: (handler: any) => mocks.afterEach = handler,
  addRoute: mocks.addRoute,
} }))
vi.mock('~@/utils/route-listener', () => ({ setRouteEmitter: mocks.setRouteEmitter }))
vi.mock('~/composables/meta-title', () => ({ useMetaTitle: mocks.useMetaTitle }))
vi.mock('~@/composables/loading', () => ({ useLoadingCheck: mocks.useLoadingCheck, useScrollToTop: mocks.useScrollToTop }))
vi.mock('~@/composables/authorization', () => ({ useAuthorization: () => mocks.token }))
vi.mock('~@/stores/user', () => ({ useUserStore: () => mocks.userStore }))

await import('./router-guard')

function to(path: string) {
  return { path, fullPath: `${path}?q=1`, meta: {} }
}

describe('router guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.token.value = null
    mocks.userStore.userInfo = undefined
    mocks.userStore.routerData = undefined
  })

  it('redirects protected routes to login while allowing public routes', async () => {
    const next = vi.fn()
    await mocks.beforeEach(to('/orders'), {}, next)
    expect(mocks.setRouteEmitter).toHaveBeenCalledWith(to('/orders'))
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/orders?q=1' } })

    next.mockClear()
    await mocks.beforeEach(to('/login'), {}, next)
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith()
  })

  it('loads user state and injects dynamic routes before entering', async () => {
    mocks.token.value = 'token'
    const dynamicRoute = { path: '/', children: [] }
    mocks.userStore.getUserInfo.mockResolvedValue(undefined)
    mocks.userStore.generateDynamicRoutes.mockResolvedValue(dynamicRoute)
    const next = vi.fn()
    const target = to('/orders')
    await mocks.beforeEach(target, {}, next)
    expect(mocks.addRoute).toHaveBeenCalledWith(dynamicRoute)
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith({ ...target, replace: true })
  })

  it('redirects exactly once on expired authorization', async () => {
    mocks.token.value = 'expired'
    mocks.userStore.getUserInfo.mockRejectedValue(new AxiosError('expired', undefined, undefined, undefined, { status: 401 } as any))
    const next = vi.fn()
    await mocks.beforeEach(to('/orders'), {}, next)
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith({ path: '/401' })
  })

  it('restores dynamic routes on refresh when user info is already cached', async () => {
    mocks.token.value = 'token'
    mocks.userStore.userInfo = { id: 1 }
    const dynamicRoute = { path: '/', children: [] }
    mocks.userStore.generateDynamicRoutes.mockResolvedValue(dynamicRoute)
    const next = vi.fn()
    const target = to('/transport/base-data')

    await mocks.beforeEach(target, {}, next)

    expect(mocks.userStore.getUserInfo).not.toHaveBeenCalled()
    expect(mocks.userStore.generateDynamicRoutes).toHaveBeenCalledOnce()
    expect(mocks.addRoute).toHaveBeenCalledWith(dynamicRoute)
    expect(next).toHaveBeenCalledWith({ ...target, replace: true })
  })

  it('cancels navigation when route initialization fails unexpectedly', async () => {
    mocks.token.value = 'token'
    mocks.userStore.getUserInfo.mockRejectedValue(new Error('network'))
    const next = vi.fn()
    await mocks.beforeEach(to('/orders'), {}, next)
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith(false)
  })

  it('redirects authenticated users away from login and runs after hooks', async () => {
    mocks.token.value = 'token'
    mocks.userStore.userInfo = { id: 1 }
    mocks.userStore.routerData = { path: '/' }
    const next = vi.fn()
    await mocks.beforeEach(to('/login'), {}, next)
    expect(next).toHaveBeenCalledWith({ path: '/' })
    const target = to('/orders')
    mocks.afterEach(target)
    expect(mocks.useMetaTitle).toHaveBeenCalledWith(target)
    expect(mocks.useLoadingCheck).toHaveBeenCalledOnce()
    expect(mocks.useScrollToTop).toHaveBeenCalledOnce()
  })
})

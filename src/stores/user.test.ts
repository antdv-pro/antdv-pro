import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUserStore } from './user'

const mocks = vi.hoisted(() => ({
  getUserInfoApi: vi.fn(),
  getRouteMenusApi: vi.fn(),
  logoutApi: vi.fn(),
  generateTreeRoutes: vi.fn(),
  generateRoutes: vi.fn(),
  generateFlatRoutes: vi.fn(),
  token: { value: 'token' as string | null },
}))

vi.mock('~@/api/common/user', () => ({ getUserInfoApi: mocks.getUserInfoApi }))
vi.mock('~@/api/common/menu', () => ({ getRouteMenusApi: mocks.getRouteMenusApi }))
vi.mock('~@/api/common/login', () => ({ logoutApi: mocks.logoutApi }))
vi.mock('~@/router/generate-route', () => ({
  generateTreeRoutes: mocks.generateTreeRoutes,
  generateRoutes: mocks.generateRoutes,
  generateFlatRoutes: mocks.generateFlatRoutes,
}))
vi.mock('~@/router/constant', () => ({ rootRoute: { path: '/', name: 'root' } }))
vi.mock('~@/composables/authorization', () => ({ useAuthorization: () => mocks.token }))

describe('user store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.token.value = 'token'
  })

  it('loads user information and derives display fields', async () => {
    mocks.getUserInfoApi.mockResolvedValue({ data: { id: 1, username: 'admin', nickname: '', avatar: 'avatar.png', roles: ['ADMIN'] } })
    const store = useUserStore()
    await store.getUserInfo()
    expect(store.userInfo?.username).toBe('admin')
    expect(store.nickname).toBe('')
    expect(store.avatar).toBe('avatar.png')
    expect(store.roles).toEqual(['ADMIN'])
  })

  it('generates backend menu and flattened child routes', async () => {
    const menus = [{ id: 1, path: '/system' }]
    const routeData = [{ path: '/system' }]
    mocks.getRouteMenusApi.mockResolvedValue({ data: menus })
    mocks.generateTreeRoutes.mockReturnValue({ menuData: menus, routeData })
    mocks.generateFlatRoutes.mockReturnValue([{ path: '/system' }])
    const store = useUserStore()
    await expect(store.generateDynamicRoutes()).resolves.toMatchObject({ path: '/', children: [{ path: '/system' }] })
    expect(store.menuData).toEqual(menus)
    expect(mocks.generateTreeRoutes).toHaveBeenCalledWith(menus)
  })

  it('clears all sensitive state even when the logout request fails', async () => {
    mocks.getUserInfoApi.mockResolvedValue({ data: { id: 1, username: 'admin', nickname: 'Admin', avatar: '' } })
    mocks.getRouteMenusApi.mockResolvedValue({ data: [] })
    mocks.generateTreeRoutes.mockReturnValue({ menuData: [], routeData: [] })
    mocks.generateFlatRoutes.mockReturnValue([])
    mocks.logoutApi.mockRejectedValue(new Error('network'))
    const store = useUserStore()
    await store.getUserInfo()
    await store.generateDynamicRoutes()
    await expect(store.logout()).rejects.toThrow('network')
    expect(mocks.token.value).toBeNull()
    expect(store.userInfo).toBeUndefined()
    expect(store.routerData).toBeUndefined()
    expect(store.menuData).toEqual([])
  })
})

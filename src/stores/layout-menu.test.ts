import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useLayoutMenu } from './layout-menu'

const mocks = vi.hoisted(() => ({
  route: undefined as any,
  userStore: undefined as any,
  appStore: undefined as any,
}))
vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pinia')>()
  const { toRef } = await import('vue')
  return {
    ...actual,
    storeToRefs: (store: Record<string, any>) => Object.fromEntries(Object.keys(store).map(key => [key, toRef(store, key)])),
  }
})
vi.mock('~@/router', async () => {
  const { ref } = await import('vue')
  mocks.route = ref({ path: '/system/users', meta: {} })
  return { default: { currentRoute: mocks.route } }
})
vi.mock('~@/stores/user', async () => {
  const { reactive } = await import('vue')
  mocks.userStore = reactive({ menuData: [] as any[] })
  return { useUserStore: () => mocks.userStore }
})
vi.mock('~@/stores/app', async () => {
  const { reactive } = await import('vue')
  mocks.appStore = reactive({ layoutSetting: { accordionMode: false } })
  return { useAppStore: () => mocks.appStore }
})

const menu = [
  { path: '/system', title: '系统', children: [
    { path: '/system/users', title: '用户', parentId: 1 },
    { path: '/system/roles', title: '角色', parentId: 1 },
  ] },
  { path: '/reports', title: '报表', children: [{ path: '/reports/monthly', title: '月报', parentId: 2 }] },
]

describe('layout menu store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    mocks.userStore.menuData = structuredClone(menu)
    mocks.appStore.layoutSetting.accordionMode = false
    mocks.route.value = { path: '/system/users', meta: {} }
    await nextTick()
  })

  it('maps nested menus and derives selected/open keys from the route', async () => {
    const store = useLayoutMenu()
    await nextTick()
    expect(store.menuDataMap.has('/system/users')).toBe(true)
    expect(store.selectedKeys).toEqual(['/system/users'])
    expect(store.openKeys).toEqual(['/system'])
  })

  it('uses route originPath for flattened routes', async () => {
    const store = useLayoutMenu()
    mocks.route.value = { path: '/flattened', meta: { originPath: '/system/roles' } }
    store.changeMenu()
    expect(store.selectedKeys).toEqual(['/system/roles'])
  })

  it('ignores external URLs when selecting menu keys', () => {
    const store = useLayoutMenu()
    store.handleSelectedKeys(['/system/users'])
    store.handleSelectedKeys(['https://example.com'])
    expect(store.selectedKeys).toEqual(['/system/users'])
  })

  it('supports root accordion and same-level submenu replacement', () => {
    const store = useLayoutMenu()
    mocks.appStore.layoutSetting.accordionMode = true
    store.handleOpenKeys(['/system'])
    expect(store.openKeys).toEqual(['/system'])
    store.handleAccordionMode(['/system', '/system/users', '/system/roles'])
    expect(store.openKeys).not.toContain('/system/users')
    expect(store.openKeys).toContain('/system/roles')
  })

  it('removes stale menu map entries when permissions reload', async () => {
    const store = useLayoutMenu()
    expect(store.menuDataMap.has('/system/users')).toBe(true)
    mocks.userStore.menuData = [{ path: '/dashboard', title: '首页' }]
    await nextTick()
    expect(store.menuDataMap.has('/system/users')).toBe(false)
    expect(store.menuDataMap.has('/dashboard')).toBe(true)
  })

  it('clears selected and open menu state', () => {
    const store = useLayoutMenu()
    store.handleSelectedKeys(['/system/users'])
    store.handleOpenKeys(['/system'])
    store.clear()
    expect(store.selectedKeys).toEqual([])
    expect(store.openKeys).toEqual([])
  })
})

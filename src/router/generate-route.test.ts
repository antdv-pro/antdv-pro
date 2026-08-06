import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateFlatRoutes, generateRoutes, generateTreeRoutes, genRoutes } from './generate-route'

const routeView = vi.hoisted(() => () => 'route-view')
const page = vi.hoisted(() => () => 'page')
const componentError = vi.hoisted(() => () => 'error')
const access = vi.hoisted(() => vi.fn((role: unknown) => role === 'ADMIN'))
const dynamicRoutes = vi.hoisted(() => [
  { path: '/public', name: 'public', component: page, meta: { title: '公开' } },
  { path: '/admin', name: 'admin', component: routeView, meta: { title: '管理', access: 'ADMIN' }, children: [
    { path: 'users', name: 'users', component: page, meta: { title: '用户', access: 'ADMIN' } },
    { path: 'audit', name: 'audit', component: page, meta: { title: '审计', access: 'AUDITOR' } },
  ] },
  { path: '/secret', name: 'secret', component: page, meta: { title: '机密', access: 'AUDITOR' } },
])

vi.mock('~@/locales', () => ({ i18n: { global: { t: (key: string) => `t:${key}` } } }))
vi.mock('~@/router/dynamic-routes', () => ({ default: dynamicRoutes }))
vi.mock('~@/composables/access', () => ({ useAccess: () => ({ hasAccess: access }) }))
vi.mock('./router-modules', () => ({
  basicRouteMap: { RouteView: routeView, ComponentError: componentError },
  getRouterModule: (name?: string) => name === 'Page' ? page : name === 'RouteView' ? routeView : componentError,
}))

describe('route generation', () => {
  beforeEach(() => access.mockClear())

  it('normalizes nested menu paths, generated names and localized titles', () => {
    const routes: any[] = [{ path: 'parent', meta: { title: '父级' }, children: [{ path: 'child', meta: { title: 'fallback', locale: 'route.child' } }] }]
    const menu = genRoutes(routes)
    expect(menu[0].path).toBe('/parent')
    expect(menu[0].name).toMatch(/^Cache_Key_/)
    expect(menu[0].children?.[0].path).toBe('/parent/child')
    expect((menu[0].children?.[0].title as () => string)()).toBe('t:route.child')
  })

  it('builds route and menu trees from flat backend data', () => {
    const result = generateTreeRoutes([
      { id: 1, path: '/system', title: '系统', component: 'RouteView' },
      { id: 2, parentId: 1, path: 'users', title: '用户', component: 'Page' },
      { id: 3, parentId: 99, path: '/orphan', title: '孤立', component: 'Page' },
    ] as any)
    expect(result.routeData).toHaveLength(1)
    expect(result.routeData[0].children?.[0]).toMatchObject({ path: 'users', component: page })
    expect(result.menuData[0].children?.[0]).toMatchObject({ path: 'users' })
  })

  it('returns the same access-filtered set for menus and registered routes', async () => {
    const result = await generateRoutes()
    expect(result.routeData.map(route => route.path)).toEqual(['/public', '/admin'])
    expect(result.routeData[1].children?.map(route => route.path)).toEqual(['users'])
    expect(result.menuData.map(route => route.path)).toEqual(['/public', '/admin'])
  })

  it('flattens descendants while retaining parent component context', () => {
    const [root] = generateFlatRoutes([{ path: '/parent', name: 'parent', component: page, children: [{ path: 'child', name: 'child', component: page }] }] as any)
    expect(root.name).toBe('ROOT_EMPTY_PATH')
    expect(root.children).toHaveLength(2)
    expect(root.children?.[1].meta).toMatchObject({ originPath: 'child', parentName: 'parent', parentComps: [page] })
  })
})

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMultiTab } from './multi-tab'

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  message: { error: vi.fn() },
  appStore: { layoutSetting: { keepAlive: true } },
}))
vi.mock('~@/router', () => ({ default: mocks.router }))
vi.mock('~@/stores/app', () => ({ useAppStore: () => mocks.appStore }))
vi.mock('~@/composables/global-config', () => ({ useMessage: () => mocks.message }))

function route(path: string, options: Record<string, any> = {}) {
  return { path, fullPath: options.fullPath ?? path, name: options.name ?? path.slice(1), meta: { title: path, keepAlive: true, ...options.meta } } as any
}

describe('multi-tab store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('ignores system routes, deduplicates tabs and caches keep-alive names', () => {
    const store = useMultiTab()
    for (const path of ['/', '/login', '/redirect/x', '/common/x'])
      store.addItem(route(path))
    store.addItem(route('/orders', { name: 'Orders' }))
    store.addItem(route('/orders', { name: 'Orders' }))
    expect(store.list).toHaveLength(1)
    expect(store.cacheList).toEqual(['Orders'])
  })

  it('protects the last tab and reports unknown close targets', () => {
    const store = useMultiTab()
    store.addItem(route('/one'))
    store.close('/one')
    expect(mocks.message.error).toHaveBeenCalledWith('不能关闭最后一个标签页')
    store.addItem(route('/two'))
    store.close('/missing')
    expect(mocks.message.error).toHaveBeenCalledWith('当前页签不存在无法关闭')
  })

  it('activates a neighbor and removes component cache when closing the active tab', () => {
    const store = useMultiTab()
    store.addItem(route('/one', { name: 'One' }))
    store.addItem(route('/two', { name: 'Two' }))
    store.activeKey = '/two'
    store.close('/two')
    expect(store.activeKey).toBe('/one')
    expect(mocks.router.push).toHaveBeenCalledWith('/one')
    expect(store.cacheList).toEqual(['One'])
  })

  it('refreshes through redirect and restores loading on the next add', () => {
    vi.useFakeTimers()
    const store = useMultiTab()
    store.addItem(route('/orders', { name: 'Orders', fullPath: '/orders?page=2' }))
    store.refresh('/orders?page=2')
    expect(store.list[0].loading).toBe(true)
    expect(store.cacheList).toEqual([])
    expect(mocks.router.replace).toHaveBeenCalledWith('/redirect/%2Forders%3Fpage%3D2')
    store.addItem(route('/other'))
    vi.advanceTimersByTime(500)
    expect(store.list[0].loading).toBe(false)
  })

  it('preserves affixed tabs while closing other tabs and can clear all state', () => {
    const store = useMultiTab()
    store.addItem(route('/home', { meta: { affix: true } }))
    store.addItem(route('/orders'))
    store.addItem(route('/users'))
    store.closeOther('/orders')
    expect(store.list.map(item => item.fullPath)).toEqual(['/home', '/orders'])
    store.clear()
    expect(store.list).toEqual([])
    expect(store.cacheList).toEqual([])
    expect(store.activeKey).toBeUndefined()
  })
})

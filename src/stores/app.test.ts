import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAppStore } from './app'

const mocks = vi.hoisted(() => ({
  localeStorage: { value: 'zh-CN' },
  isDark: undefined as any,
  toggleDark: vi.fn((value: boolean) => mocks.isDark.value = value),
  body: { style: { filter: '' } },
  algorithms: { defaultAlgorithm: () => 'default', darkAlgorithm: () => 'dark', compactAlgorithm: () => 'compact' },
}))
vi.mock('~@/composables/i18n-locale', () => ({ lsLocaleState: mocks.localeStorage }))
vi.mock('~@/composables/theme', async () => {
  const { ref } = await import('vue')
  mocks.isDark = ref(false)
  return { isDark: mocks.isDark, toggleDark: mocks.toggleDark }
})
vi.mock('ant-design-vue/es', () => ({ theme: mocks.algorithms }))

describe('app settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.localeStorage.value = 'zh-CN'
    mocks.isDark.value = false
    mocks.body.style.filter = ''
    vi.stubGlobal('document', { querySelector: vi.fn(() => mocks.body) })
  })

  it('keeps exposed locale and persistent locale synchronized', () => {
    const store = useAppStore()
    store.toggleLocale('en-US')
    expect(store.locale).toBe('en-US')
    expect(mocks.localeStorage.value).toBe('en-US')
  })

  it('switches light and dark theme tokens consistently', () => {
    const store = useAppStore()
    store.toggleTheme('dark')
    expect(store.layoutSetting.theme).toBe('dark')
    expect(store.theme.token?.colorBgContainer).toBe('rgb(36, 37, 37)')
    expect(store.theme.components?.Menu).toBeDefined()
    expect(mocks.toggleDark).toHaveBeenCalledWith(true)
    store.toggleTheme('light')
    expect(store.theme.token?.colorBgContainer).toBe('#fff')
    expect(store.theme.components?.Menu).toBeUndefined()
  })

  it('updates primary color, collapsed and drawer settings', () => {
    const store = useAppStore()
    store.toggleColorPrimary('#ff0000')
    store.toggleCollapsed(true)
    store.toggleDrawerVisible(true)
    expect(store.layoutSetting).toMatchObject({ colorPrimary: '#ff0000', collapsed: true, drawerVisible: true })
    expect(store.theme.token?.colorPrimary).toBe('#ff0000')
  })

  it('enforces layout-dependent content and split-menu settings', () => {
    const store = useAppStore()
    store.changeSettingLayout('layout', 'top')
    expect(store.layoutSetting).toMatchObject({ layout: 'top', contentWidth: 'Fixed', splitMenus: false })
    store.changeSettingLayout('layout', 'mix')
    expect(store.layoutSetting).toMatchObject({ layout: 'mix', contentWidth: 'Fluid', leftCollapsed: true })
    store.layoutSetting.theme = 'inverted'
    store.changeSettingLayout('layout', 'mix')
    expect(store.layoutSetting.theme).toBe('light')
  })

  it('toggles compact algorithms without duplicates', () => {
    const store = useAppStore()
    store.changeSettingLayout('compactAlgorithm', true)
    expect(store.theme.algorithm).toEqual([mocks.algorithms.defaultAlgorithm, mocks.algorithms.compactAlgorithm])
    store.changeSettingLayout('compactAlgorithm', true)
    expect((store.theme.algorithm as any[]).filter(item => item === mocks.algorithms.compactAlgorithm)).toHaveLength(1)
    store.changeSettingLayout('compactAlgorithm', false)
    expect(store.theme.algorithm).toEqual([mocks.algorithms.defaultAlgorithm])
  })

  it('keeps grayscale and weak modes mutually exclusive', () => {
    const store = useAppStore()
    store.toggleGray(true)
    expect(store.layoutSetting).toMatchObject({ colorGray: true, colorWeak: false })
    expect(mocks.body.style.filter).toBe('grayscale(100%)')
    store.toggleWeak(true)
    expect(store.layoutSetting).toMatchObject({ colorGray: false, colorWeak: true })
    expect(mocks.body.style.filter).toBe('invert(80%)')
    store.toggleWeak(false)
    expect(mocks.body.style.filter).toBe('')
  })
})

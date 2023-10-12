import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { theme as antdTheme } from 'ant-design-vue/es'
import type { ContentWidth, LayoutType, ThemeType } from '~@/layouts/basic-layout/typing'
import type { AnimationNameValueType } from '~@/config/default-setting'
import defaultSetting from '~@/config/default-setting'

export interface LayoutSetting {
  title?: string
  logo?: string
  theme: ThemeType
  collapsed: boolean
  drawerVisible: boolean
  colorPrimary?: string
  layout?: LayoutType
  contentWidth?: ContentWidth
  fixedHeader?: boolean
  fixedSider?: boolean
  splitMenus?: boolean
  watermark?: boolean
  header?: boolean
  footer?: boolean
  menu?: boolean
  menuHeader?: boolean
  colorWeak?: boolean
  multiTab?: boolean
  multiTabFixed?: boolean
  headerHeight?: number
  copyright?: string
  keepAlive?: boolean
  accordionMode?: boolean
  leftCollapsed?: boolean
  animationName?: AnimationNameValueType
}

export const useAppStore = defineStore('app', () => {
  const layoutSetting = reactive<LayoutSetting>(defaultSetting)
  const themeConfig = reactive<ThemeConfig>({
    algorithm: antdTheme.defaultAlgorithm,
    token: {
      colorBgContainer: '#fff',
      colorPrimary: layoutSetting.colorPrimary,
    },
    components: {},
  })
  const locale = ref<string>(lsLocaleState.value)
  const toggleLocale = (locale: string) => {
    lsLocaleState.value = locale
  }
  const toggleTheme = (theme: ThemeType) => {
    if (layoutSetting.theme === theme)
      return
    layoutSetting.theme = theme
    if (theme === 'light' || theme === 'inverted') {
      if (themeConfig.token)
        themeConfig.token.colorBgContainer = '#fff'
      if (themeConfig.components?.Menu)
        delete themeConfig.components.Menu

      themeConfig.algorithm = antdTheme.defaultAlgorithm

      toggleDark(false)
    }
    else if (theme === 'dark') {
      toggleDark(true)
      if (themeConfig.token)
        themeConfig.token.colorBgContainer = 'rgb(36, 37, 37)'
      if (themeConfig.components) {
        themeConfig.components = {
          ...themeConfig.components,
          Menu: {
            colorItemBg: 'rgb(36, 37, 37)',
            colorSubItemBg: 'rgb(36, 37, 37)',
            menuSubMenuBg: 'rgb(36, 37, 37)',
          } as any,
        }
      }
      themeConfig.algorithm = antdTheme.darkAlgorithm
    }
  }

  const toggleDrawerVisible = (visible: boolean) => {
    layoutSetting.drawerVisible = visible
  }

  const toggleColorPrimary = (color: string) => {
    layoutSetting.colorPrimary = color
    if (themeConfig.token)
      themeConfig.token.colorPrimary = color
  }

  // 如果加载进来是暗色模式，就切换到暗色模式
  if (isDark.value)
    toggleTheme('dark')

  // 监听isDark的变化
  watch(isDark, () => {
    if (isDark.value)
      toggleTheme('dark')
    else toggleTheme('light')
  })

  // 监听isDark的变化
  watch(preferredLanguages, () => {
    toggleLocale(preferredLanguages.value[0])
  })

  const toggleCollapsed = (collapsed: boolean) => {
    layoutSetting.collapsed = collapsed
  }

  const toggleLayout = (layout: LayoutType) => {
    if (layoutSetting.theme === 'inverted' && layout === 'mix')
      layoutSetting.theme = 'light'

    if (layout !== 'mix')
      layoutSetting.splitMenus = false
    else layoutSetting.leftCollapsed = true

    if (layout === 'top')
      layoutSetting.contentWidth = 'Fixed'
    else layoutSetting.contentWidth = 'Fluid'

    layoutSetting.layout = layout
  }

  const changeSettingLayout = (key: keyof LayoutSetting, value: any) => {
    if (key === 'theme')
      toggleTheme(value as ThemeType)
    else if (key === 'colorPrimary')
      toggleColorPrimary(value)
    else if (key === 'layout')
      toggleLayout(value as LayoutType)
    else if (key in layoutSetting)
      (layoutSetting as any)[key] = value
  }

  return {
    layoutSetting,
    theme: themeConfig,
    locale,
    toggleLocale,
    toggleTheme,
    toggleCollapsed,
    toggleDrawerVisible,
    changeSettingLayout,
    toggleColorPrimary,
  }
})

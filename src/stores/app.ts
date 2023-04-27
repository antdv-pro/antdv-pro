import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { theme as antdTheme } from 'ant-design-vue/es'
import type { LayoutType, ThemeType } from '~@/layouts/basic-layout/typing'

export interface LayoutSetting {
  theme: ThemeType
  collapsed: boolean
  drawerVisible: boolean
  colorPrimary?: string
  layout?: LayoutType
}

export const useAppStore = defineStore('app', () => {
  const layoutSetting = reactive<LayoutSetting>({
    theme: 'light',
    collapsed: true,
    drawerVisible: false,
    colorPrimary: '#1677FF',
    layout: 'mix',
  })
  const themeConfig = reactive<ThemeConfig>({
    algorithm: antdTheme.defaultAlgorithm,
    token: {
      colorBgContainer: 'var(--bg-color-container)',
      colorPrimary: layoutSetting.colorPrimary,
    },
    components: {},
  })
  const toggleTheme = (theme: ThemeType) => {
    if (layoutSetting.theme === theme)
      return

    layoutSetting.theme = theme
    if (theme === 'light' || theme === 'inverted') {
      themeConfig.algorithm = antdTheme.defaultAlgorithm
      toggleDark(false)
    }
    else if (theme === 'dark') {
      toggleDark(true)
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

  const toggleCollapsed = (collapsed: boolean) => {
    layoutSetting.collapsed = collapsed
  }

  const toggleLayout = (layout: LayoutType) => {
    if (layoutSetting.theme === 'inverted' && layout === 'mix')
      layoutSetting.theme = 'light'

    layoutSetting.layout = layout
  }

  const changeSettingLayout = (key: keyof LayoutSetting, value: string) => {
    if (key === 'theme')
      toggleTheme(value as ThemeType)
    else if (key === 'colorPrimary')
      toggleColorPrimary(value)
    else if (key === 'layout')
      toggleLayout(value as LayoutType)
  }

  return {
    layoutSetting,
    theme: themeConfig,
    toggleTheme,
    toggleCollapsed,
    toggleDrawerVisible,
    changeSettingLayout,
    toggleColorPrimary,
  }
})

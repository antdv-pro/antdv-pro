import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { theme as antdTheme } from 'ant-design-vue/es'
import type { ThemeType } from '~@/layouts/basic-layout/typing'

export interface LayoutSetting {
  theme: ThemeType
  collapsed: boolean
  drawerVisible: boolean
  colorPrimary?: string
}

export const useAppStore = defineStore('app', () => {
  const layoutSetting = reactive<LayoutSetting>({
    theme: 'light',
    collapsed: true,
    drawerVisible: false,
    colorPrimary: undefined,
  })
  const themeConfig = reactive<ThemeConfig>({
    algorithm: antdTheme.defaultAlgorithm,
    token: {
      colorBgContainer: 'var(--bg-color-container)',
    },
    components: { },
  })
  const toggleTheme = (theme: ThemeType) => {
    if (layoutSetting.theme === theme)
      return

    layoutSetting.theme = theme
    if (theme === 'light') {
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

  // 如果加载进来是暗色模式，就切换到暗色模式
  if (isDark.value)
    toggleTheme('dark')

  const toggleCollapsed = (collapsed: boolean) => {
    layoutSetting.collapsed = collapsed
  }

  const changeSettingLayout = (key: keyof LayoutSetting, value: string) => {
    if (key === 'theme')
      toggleTheme(value as ThemeType)
  }

  return {
    layoutSetting,
    theme: themeConfig,
    toggleTheme,
    toggleCollapsed,
    toggleDrawerVisible,
    changeSettingLayout,
  }
})

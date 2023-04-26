import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { theme as antdTheme } from 'ant-design-vue/es'

export interface LayoutSetting {
  theme: 'light' | 'dark'
  collapsed: boolean
  drawerVisible: boolean
}

export const useAppStore = defineStore('app', () => {
  const layoutSetting = reactive<LayoutSetting>({
    theme: 'light',
    collapsed: true,
    drawerVisible: false,
  })
  const themeConfig = reactive<ThemeConfig>({
    algorithm: antdTheme.defaultAlgorithm,
    token: {

    },
    components: {
      Menu: {
        colorBgContainer: 'var(--bg-color-container)',
      },
      Layout: {
        colorBgContainer: 'var(--bg-color-container)',
      },
    },
  })
  const toggleTheme = (theme: LayoutSetting['theme']) => {
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

  return {
    layoutSetting,
    theme: themeConfig,
    toggleTheme,
    toggleCollapsed,
    toggleDrawerVisible,
  }
})

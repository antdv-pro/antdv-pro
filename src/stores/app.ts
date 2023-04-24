import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { theme as antdTheme } from 'ant-design-vue/es'

export interface LayoutSetting {
  theme: 'light' | 'dark'
  collapsed: boolean
}

export const useAppStore = defineStore('app', () => {
  const layoutSetting = reactive<LayoutSetting>({
    theme: 'light',
    collapsed: true,
  })
  const themeConfig = reactive<ThemeConfig>({
    algorithm: antdTheme.defaultAlgorithm,
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

  const toggleCollapsed = (collapsed: boolean) => {
    layoutSetting.collapsed = collapsed
  }

  return {
    layoutSetting,
    theme: themeConfig,
    toggleTheme,
    toggleCollapsed,
  }
})

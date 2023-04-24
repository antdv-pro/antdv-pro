import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { theme as antdTheme } from 'ant-design-vue/es'

export const useAppStore = defineStore('app', () => {
  const layoutSetting = reactive({
    theme: 'light',
  })
  const themeConfig = reactive<ThemeConfig>({
    algorithm: antdTheme.defaultAlgorithm,
  })
  const toggleTheme = (theme: string) => {
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

  return {
    layoutSetting,
    theme: themeConfig,
    toggleTheme,
  }
})

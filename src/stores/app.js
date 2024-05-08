import { theme as antdTheme } from 'ant-design-vue/es'
import defaultSetting from '~@/config/default-setting'

export const useAppStore = defineStore('app', () => {
  const { darkAlgorithm, compactAlgorithm, defaultAlgorithm } = antdTheme
  const layoutSetting = reactive(defaultSetting)
  const themeConfig = reactive({
    algorithm: antdTheme.defaultAlgorithm,
    token: {
      colorBgContainer: '#fff',
      colorPrimary: layoutSetting.colorPrimary,
    },
    components: {},
  })
  const locale = ref(lsLocaleState.value)
  const toggleLocale = (locale2) => {
    lsLocaleState.value = locale2
  }
  const toggleCompact = (isCompact = true) => {
    layoutSetting.compactAlgorithm = isCompact
    const algorithm = layoutSetting.theme === 'dark' ? [darkAlgorithm] : [defaultAlgorithm]
    isCompact && algorithm.push(compactAlgorithm)
    themeConfig.algorithm = algorithm
  }
  const toggleTheme = (theme) => {
    if (layoutSetting.theme === theme)
      return
    layoutSetting.theme = theme
    if (theme === 'light' || theme === 'inverted') {
      if (themeConfig.token)
        themeConfig.token.colorBgContainer = '#fff'
      if (themeConfig.components?.Menu)
        delete themeConfig.components.Menu
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
          },
        }
      }
    }
    toggleCompact(layoutSetting.compactAlgorithm)
  }
  const toggleDrawerVisible = (visible) => {
    layoutSetting.drawerVisible = visible
  }
  const toggleColorPrimary = (color) => {
    layoutSetting.colorPrimary = color
    if (themeConfig.token)
      themeConfig.token.colorPrimary = color
  }
  if (isDark.value)
    toggleTheme('dark')
  watch(isDark, () => {
    if (isDark.value)
      toggleTheme('dark')
    else
      toggleTheme('light')
  })
  watch(preferredLanguages, () => {
    toggleLocale(preferredLanguages.value[0])
  })
  const toggleCollapsed = (collapsed) => {
    layoutSetting.collapsed = collapsed
  }
  function toggleGray(isGray = true) {
    layoutSetting.colorGray = isGray
    const dom = document.querySelector('body')
    if (dom) {
      if (isGray) {
        toggleWeak(false)
        dom.style.filter = 'grayscale(100%)'
      }
      else {
        dom.style.filter = ''
      }
    }
  }
  if (layoutSetting.colorGray)
    toggleGray(true)
  function toggleWeak(isWeak = true) {
    layoutSetting.colorWeak = isWeak
    const dom = document.querySelector('body')
    if (dom) {
      if (isWeak) {
        toggleGray(false)
        dom.style.filter = 'invert(80%)'
      }
      else {
        dom.style.filter = ''
      }
    }
  }
  if (layoutSetting.colorWeak)
    toggleWeak(true)
  const toggleLayout = (layout) => {
    if (layoutSetting.theme === 'inverted' && layout === 'mix')
      layoutSetting.theme = 'light'
    if (layout !== 'mix')
      layoutSetting.splitMenus = false
    else
      layoutSetting.leftCollapsed = true
    if (layout === 'top')
      layoutSetting.contentWidth = 'Fixed'
    else
      layoutSetting.contentWidth = 'Fluid'
    layoutSetting.layout = layout
  }
  const changeSettingLayout = (key, value) => {
    if (key === 'theme')
      toggleTheme(value)
    else if (key === 'colorPrimary')
      toggleColorPrimary(value)
    else if (key === 'layout')
      toggleLayout(value)
    else if (key === 'compactAlgorithm')
      toggleCompact(value)
    else if (key === 'colorWeak')
      toggleWeak(value)
    else if (key === 'colorGray')
      toggleGray(value)
    else if (key in layoutSetting)
      layoutSetting[key] = value
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
    toggleGray,
    toggleWeak,
  }
})

import dayjs from 'dayjs'
import { i18n, loadLanguageAsync } from '~@/locales'
import 'dayjs/locale/zh-cn'
import router from '~@/router'
import { useMetaTitle } from '~/composables/meta-title'

const LOCALE_KEY = 'locale'

export const preferredLanguages = usePreferredLanguages()

export const lsLocaleState = useStorage(LOCALE_KEY, preferredLanguages.value[0])

export const useI18nLocale = createSharedComposable(() => {
  // 加载多语言的loading状态
  const loading = ref(false)
  const localeStore = useAppStore()
  // 多语言的信息
  const locale = computed<string>(() => {
    if (!i18n)
      return 'zh-CN'

    return unref(i18n.global.locale)
  })

  // 获取antd的多语言
  const antd = computed(() => {
    return (i18n?.global?.getLocaleMessage?.(unref(locale)) as any)?.antd || undefined
  })

  // 切换多语言
  const setLocale = async (locale: string) => {
    if (!i18n)
      return

    if (loading.value)
      return
    loading.value = true
    try {
      // 加载多语言
      localeStore.toggleLocale(locale)
      await loadLanguageAsync(locale)
      // 判断是否存在兼容模式
      if (i18n.mode === 'legacy')
        i18n.global.locale = locale as any
      else
        (i18n.global.locale as any).value = locale as any
      loading.value = false
    }
    catch (e) {
      loading.value = false
    }
  }

  watch(locale, () => {
    if (antd.value && antd.value.locale)
      dayjs.locale(antd.value.locale)

    const route = router.currentRoute.value
    useMetaTitle(route)
  }, {
    immediate: true,
  })

  // 切换多语言功能
  const t = (key: string, defaultMessage?: string) => {
    const message = (i18n?.global as any)?.t?.(key)
    if (message !== key)
      return (i18n?.global as any)?.t?.(key)
    else
      return defaultMessage ?? key
  }
  return {
    locale,
    t,
    antd,
    setLocale,
  }
})

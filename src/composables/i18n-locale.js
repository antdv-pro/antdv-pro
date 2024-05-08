import dayjs from 'dayjs'
import { i18n, loadLanguageAsync } from '~@/locales'
import 'dayjs/locale/zh-cn'
import router from '~@/router'
import { useMetaTitle } from '~/composables/meta-title'

const LOCALE_KEY = 'locale'
export const preferredLanguages = usePreferredLanguages()
export const lsLocaleState = useStorage(LOCALE_KEY, preferredLanguages.value[0])
export const useI18nLocale = createSharedComposable(() => {
  const loading = ref(false)
  const localeStore = useAppStore()
  const locale = computed(() => {
    if (!i18n)
      return 'zh-CN'
    return unref(i18n.global.locale)
  })
  const antd = computed(() => {
    return i18n?.global?.getLocaleMessage?.(unref(locale))?.antd || void 0
  })
  const setLocale = async (locale2) => {
    if (!i18n)
      return
    if (loading.value)
      return
    loading.value = true
    try {
      localeStore.toggleLocale(locale2)
      await loadLanguageAsync(locale2)
      if (i18n.mode === 'legacy')
        i18n.global.locale = locale2
      else
        i18n.global.locale.value = locale2
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
  const t = (key, defaultMessage) => {
    const message = i18n?.global?.t?.(key)
    if (message !== key)
      return i18n?.global?.t?.(key)
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

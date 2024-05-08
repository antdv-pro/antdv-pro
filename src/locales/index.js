import { createI18n } from 'vue-i18n'

// eslint-disable-next-line import/no-mutable-exports
export let i18n
const defaultLoadLang = 'zh-CN'
async function createI18nOptions() {
  const appStore = useAppStore()
  const { locale } = storeToRefs(appStore)
  let defaultLocal
  try {
    defaultLocal = await import(`./lang/${locale.value}.js`)
  }
  catch (e) {
    defaultLocal = await import(`./lang/${defaultLoadLang}.js`)
  }
  return {
    legacy: false,
    locale: locale.value,
    fallbackLocale: 'zh-CN',
    messages: {
      [locale.value]: defaultLocal.default,
    },
    sync: true,
    silentTranslationWarn: true,
    missingWarn: false,
    silentFallbackWarn: true,
  }
}
export async function setupI18n(app) {
  const options = await createI18nOptions()
  i18n = createI18n(options)
  app.use(i18n)
}
export async function loadLanguageAsync(locale) {
  const current = unref(i18n.global.locale)
  try {
    if (current === locale)
      return nextTick()
    let messages
    try {
      messages = await import(`./lang/${locale}.js`)
    }
    catch (e) {
      messages = await import(`./lang/${defaultLoadLang}.js`)
    }
    if (messages)
      i18n.global.setLocaleMessage(locale, messages.default)
  }
  catch (e) {
    console.warn('load language error', e)
  }
  return nextTick()
}

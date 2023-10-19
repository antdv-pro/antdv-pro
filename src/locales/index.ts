import type { App } from 'vue'
import type { I18n, I18nOptions } from 'vue-i18n'
import { createI18n } from 'vue-i18n'

// eslint-disable-next-line import/no-mutable-exports
export let i18n: I18n

const defaultLoadLang = 'zh-CN'

async function createI18nOptions(): Promise<I18nOptions> {
  const appStore = useAppStore()
  const { locale } = storeToRefs(appStore)
  // 扩展可从服务器端获取语言翻译文件
  let defaultLocal
  try {
    defaultLocal = await import(`./lang/${locale.value}.ts`)
  }
  catch (e) {
    defaultLocal = await import(`./lang/${defaultLoadLang}.ts`)
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

export async function setupI18n(app: App) {
  const options = await createI18nOptions()
  i18n = createI18n(options)
  app.use(i18n)
}

/**
 * 异步加载其他多语言
 * @param locale 语言类型
 * @returns 返回参数
 */
export async function loadLanguageAsync(locale: string) {
  const current = unref(i18n.global.locale)
  try {
    if (current === locale)
      return nextTick()
    let messages
    try {
      messages = await import(`./lang/${locale}.ts`)
    }
    catch (e) {
      messages = await import(`./lang/${defaultLoadLang}.ts`)
    }
    if (messages)
      i18n.global.setLocaleMessage(locale, messages.default)
  }
  catch (e) {
    console.warn('load language error', e)
  }
  return nextTick()
}

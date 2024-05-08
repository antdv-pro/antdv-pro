import { i18n } from '~@/locales'

export function useMetaTitle(route) {
  const { title, locale } = route.meta ?? {}
  if (title || locale) {
    if (locale)
      useTitle((i18n?.global).t?.(locale) ?? title)
    else
      useTitle(title)
  }
}

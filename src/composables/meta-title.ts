import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from 'vue-router'
import { i18n } from '~@/locales'

export function useMetaTitle(route: RouteRecordRaw | RouteLocationNormalizedLoaded) {
  const appTitle = '企业管理系统'
  const { title, locale } = route.meta ?? {}
  if (title || locale) {
    const routeTitle = locale ? (i18n?.global as any).t?.(locale) ?? title : title
    if (locale)
      useTitle(`${routeTitle} - ${appTitle}`)
    else
      useTitle(`${routeTitle} - ${appTitle}`)
  }
}

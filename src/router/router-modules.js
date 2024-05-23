const routerModules = import.meta.glob([
  '~/pages/**/*.vue',
  '!~/pages/**/*copy.vue',
  '!~/pages/**/component',
  '!~/pages/**/components',
  '!~/pages/**/composables',
  '!~/pages/**/hooks',
  '!~/pages/**/locales',
  '!~/pages/**/modules',
  '!~/pages/**/plugins',
  '!~/pages/**/tests',
  '!~/pages/**/test',
  '!~/pages/common',
])
export const basicRouteMap = {
  // iframe模式下使用
  Iframe: () => import('~/pages/common/iframe.vue'),
  // 一般用于存在子集的页面
  RouteView: () => import('~/layouts/components/route-view.vue'),
  // 空页面
  ComponentError: () => import('~/pages/exception/component-error.vue'),
}
function checkEager(module) {
  if (typeof module === 'object' && 'default' in module)
    return module.default
  return module
}
export function getRouterModule(path) {
  if (!path)
    return basicRouteMap.ComponentError
  if (path in basicRouteMap)
    return basicRouteMap[path]
  if (path.startsWith('/'))
    path = path.slice(1)
  const fullPath = `/src/pages/${path}.vue`
  const fullPathIndex = `/src/pages/${path}/index.vue`
  if (fullPathIndex in routerModules)
    return checkEager(routerModules[fullPathIndex])
  return checkEager(routerModules[fullPath])
}
export default routerModules

import { isUrl } from '@v-c/utils'
import { omit } from 'lodash'
import { basicRouteMap, getRouterModule } from './router-modules.js'
import dynamicRoutes from '~@/router/dynamic-routes'
import { ROOT_ROUTE_REDIRECT_PATH } from '~@/router/constant'
import { i18n } from '~@/locales'

let cache_key = 1
const getCacheKey = () => `Cache_Key_${cache_key++}`
function renderTitle(route) {
  const { title, locale } = route.meta || {}
  if (!title)
    return ''
  return locale ? i18n.global.t(locale) : title
}
function formatMenu(route, path) {
  return {
    id: route.meta?.id,
    parentId: route.meta?.parentId,
    title: () => renderTitle(route),
    icon: route.meta?.icon || '',
    path: path ?? route.path,
    hideInMenu: route.meta?.hideInMenu || false,
    parentKeys: route.meta?.parentKeys || [],
    hideInBreadcrumb: route.meta?.hideInBreadcrumb || false,
    hideChildrenInMenu: route.meta?.hideChildrenInMenu || false,
    locale: route.meta?.locale,
    keepAlive: route.meta?.keepAlive || false,
    name: route.name,
    url: route.meta?.url || '',
    target: route.meta?.target || '_blank',
  }
}
export function genRoutes(routes, parent) {
  const menuData = []
  routes.forEach((route) => {
    let path = route.path
    if (!path.startsWith('/') && !isUrl(path)) {
      if (parent)
        path = `${parent.path}/${path}`
      else
        path = `/${path}`
    }
    if (!route.name)
      route.name = getCacheKey()
    const item = formatMenu(route, path)
    item.children = []
    if (route.children && route.children.length)
      item.children = genRoutes(route.children, item)
    if (item.children?.length === 0)
      delete item.children
    menuData.push(item)
  })
  return menuData
}
export function generateTreeRoutes(menus) {
  const routeDataMap = /* @__PURE__ */ new Map()
  const menuDataMap = /* @__PURE__ */ new Map()
  for (const menuItem of menus) {
    if (!menuItem.id)
      continue
    const route = {
      path: menuItem.path,
      name: menuItem.name || getCacheKey(),
      component: getRouterModule(menuItem.component),
      redirect: menuItem.redirect || void 0,
      meta: {
        title: menuItem?.title,
        icon: menuItem?.icon,
        keepAlive: menuItem?.keepAlive,
        id: menuItem?.id,
        parentId: menuItem?.parentId,
        affix: menuItem?.affix,
        parentKeys: menuItem?.parentKeys,
        url: menuItem?.url,
        hideInMenu: menuItem?.hideInMenu,
        hideChildrenInMenu: menuItem?.hideChildrenInMenu,
        hideInBreadcrumb: menuItem?.hideInBreadcrumb,
        target: menuItem?.target,
        locale: menuItem?.locale,
      },
    }
    const menu = formatMenu(route)
    routeDataMap.set(menuItem.id, route)
    menuDataMap.set(menuItem.id, menu)
  }
  const routeData = []
  const menuData = []
  for (const menuItem of menus) {
    if (!menuItem.id)
      continue
    const currentRoute = routeDataMap.get(menuItem.id)
    const currentItem = menuDataMap.get(menuItem.id)
    if (!menuItem.parentId) {
      if (currentRoute && currentItem) {
        routeData.push(currentRoute)
        menuData.push(currentItem)
      }
    }
    else {
      const pRoute = routeDataMap.get(menuItem.parentId)
      const pItem = menuDataMap.get(menuItem.parentId)
      if (currentItem && currentRoute && pRoute && pItem) {
        if (pRoute.children && pItem.children) {
          pRoute.children.push(currentRoute)
          pItem.children.push(currentItem)
        }
        else {
          pItem.children = [currentItem]
          pRoute.children = [currentRoute]
        }
      }
    }
  }
  return {
    menuData,
    routeData,
  }
}
export async function generateRoutes() {
  const { hasAccess } = useAccess()
  function filterRoutesByAccess(routes) {
    return routes
      .filter((route) => {
        return !route.meta?.access || hasAccess(route.meta?.access)
      })
      .map((route) => {
        if (route.children?.length) {
          route.children = filterRoutesByAccess(route.children)
        }
        return route
      })
  }
  const accessRoutes = filterRoutesByAccess(dynamicRoutes)
  const menuData = genRoutes(accessRoutes)
  return {
    menuData,
    routeData: dynamicRoutes,
  }
}
function checkComponent(component) {
  for (const componentKey in basicRouteMap) {
    if (component === basicRouteMap[componentKey])
      return void 0
  }
  return component
}
function flatRoutes(routes, parentName, parentComps = []) {
  const flatRouteData = []
  for (const route of routes) {
    const parentComponents = [...parentComps]
    const currentRoute = omit(route, ['children'])
    if (!currentRoute.meta)
      currentRoute.meta = {}
    if (parentName)
      currentRoute.meta.parentName = parentName
    if (parentComponents.length > 0)
      currentRoute.meta.parentComps = parentComponents
    currentRoute.meta.originPath = currentRoute.path
    flatRouteData.push(currentRoute)
    if (route.children && route.children.length) {
      const comp = checkComponent(route.component)
      if (comp)
        parentComponents.push(comp)
      flatRouteData.push(...flatRoutes(route.children, route.name, [...parentComponents]))
    }
  }
  return flatRouteData
}
export function generateFlatRoutes(routes) {
  const flatRoutesList = flatRoutes(routes)
  const parentRoute = {
    path: '/',
    redirect: ROOT_ROUTE_REDIRECT_PATH,
    name: 'ROOT_EMPTY_PATH',
    // component: getRouterModule('RouteView'),
    children: flatRoutesList,
  }
  return [parentRoute]
}

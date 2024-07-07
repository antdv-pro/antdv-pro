import { isUrl } from '@v-c/utils'
import type { RouteRecordRaw } from 'vue-router'
import { omit } from 'lodash'
import { basicRouteMap, getRouterModule } from './router-modules'
import type { MenuData, MenuDataItem } from '~@/layouts/basic-layout/typing'
import dynamicRoutes from '~@/router/dynamic-routes'
import { ROOT_ROUTE_REDIRECT_PATH } from '~@/router/constant'
import { i18n } from '~@/locales'

let cache_key = 1

const getCacheKey = () => `Cache_Key_${cache_key++}`

function renderTitle(route: RouteRecordRaw) {
  const { title, locale } = route.meta || {}
  if (!title)
    return ''
  return locale ? (i18n.global as any).t(locale) : title
}

function formatMenu(route: RouteRecordRaw, path?: string) {
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
    name: route.name as string,
    url: route.meta?.url || '',
    target: route.meta?.target || '_blank',
  }
}

// 本地静态路由生成菜单的信息
export function genRoutes(routes: RouteRecordRaw[], parent?: MenuDataItem) {
  const menuData: MenuData = []
  routes.forEach((route) => {
    let path = route.path
    if (!path.startsWith('/') && !isUrl(path)) {
      // 判断当前是不是以 /开头，如果不是就表示当前的路由地址为不完全的地址
      if (parent)
        path = `${parent.path}/${path}`
      else
        path = `/${path}`
    }
    // 判断是不是存在name，如果不存在name的情况下，自动补充一个自定义的name，为了更容易的去实现保活的功能，name是必须的
    if (!route.name)
      route.name = getCacheKey()
    const item: MenuDataItem = formatMenu(route, path)
    item.children = []
    if (route.children && route.children.length)
      item.children = genRoutes(route.children, item)
    if (item.children?.length === 0)
      delete item.children
    menuData.push(item)
  })
  return menuData
}

/**
 * 请求后端的数据获取到的菜单的信息，默认数据是拉平的，需要对数据进行树结构的整理
 */
export function generateTreeRoutes(menus: MenuData) {
  const routeDataMap = new Map<string | number, RouteRecordRaw>()
  const menuDataMap = new Map<string | number, MenuDataItem>()
  for (const menuItem of menus) {
    if (!menuItem.id)
      continue
    const route = {
      path: menuItem.path,
      name: menuItem.name || getCacheKey(),
      component: getRouterModule(menuItem.component!),
      redirect: menuItem.redirect || undefined,
      meta: {
        title: menuItem?.title as string,
        icon: menuItem?.icon as string,
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
    } as RouteRecordRaw
    const menu = formatMenu(route)
    routeDataMap.set(menuItem.id, route)
    menuDataMap.set(menuItem.id, menu)
  }
  const routeData: RouteRecordRaw[] = []
  const menuData: MenuData = []

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

/**
 * 通过前端数据中的dynamic-routes动态生成菜单和数据
 */

export async function generateRoutes() {
  const { hasAccess } = useAccess()
  function filterRoutesByAccess(routes: RouteRecordRaw[]) {
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

function checkComponent(component: RouteRecordRaw['component']) {
  for (const componentKey in basicRouteMap) {
    if (component === (basicRouteMap as any)[componentKey])
      return undefined
  }
  return component
}

// 路由拉平处理
function flatRoutes(routes: RouteRecordRaw[], parentName?: string, parentComps: RouteRecordRaw['component'][] = []) {
  const flatRouteData: RouteRecordRaw[] = []
  for (const route of routes) {
    const parentComponents = [...parentComps]
    const currentRoute = omit(route, ['children']) as RouteRecordRaw
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
      flatRouteData.push(...flatRoutes(route.children, route.name as string, [...parentComponents]))
    }
  }
  return flatRouteData
}

export function generateFlatRoutes(routes: RouteRecordRaw[]) {
  const flatRoutesList = flatRoutes(routes)
  // 拿到拉平后的路由，然后统一添加一个父级的路由,通过这层路由实现保活的功能
  const parentRoute: RouteRecordRaw = {
    path: '/',
    redirect: ROOT_ROUTE_REDIRECT_PATH,
    name: 'ROOT_EMPTY_PATH',
    // fix: https://github.com/antdv-pro/antdv-pro/issues/179
    // component: getRouterModule('RouteView'),
    children: flatRoutesList,
  }
  return [parentRoute]
}

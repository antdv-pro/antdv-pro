
import { isUrl } from '@v-c/utils'
import type { RouteRecordRaw } from 'vue-router'
import { omit } from 'lodash'
import { getRouterModule } from './router-modules'
import type { MenuData, MenuDataItem } from '~@/layouts/basic-layout/typing'
import dynamicRoutes, { ROOT_ROUTE_REDIRECT_PATH } from '~@/router/dynamic-routes'

let cache_key = 1

const getCacheKey = () => `Cache_Key_${cache_key++}`

const formatMenu = (route: RouteRecordRaw, path?: string) => {
  return {
    id: route.meta?.id,
    parentId: route.meta?.parentId,
    title: route.meta?.title || '',
    icon: route.meta?.icon || '',
    path: path ?? route.path,
    hideInMenu: route.meta?.hideInMenu || false,
    parentKeys: route.meta?.parentKeys || [],
    hideInBreadcrumb: route.meta?.hideInBreadcrumb || false,
    hideChildrenInMenu: route.meta?.hideChildrenInMenu || false,
    keepAlive: route.meta?.keepAlive || false,
    name: route.name as string,
    url: route.meta?.url || '',
    target: route.meta?.target || '_blank',
  }
}

// 本地静态路由生成菜单的信息
export const genRoutes = (routes: RouteRecordRaw[], parent?: MenuDataItem) => {
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
    if (item.children?.length === 0) delete item.children
    menuData.push(item)
  })
  return menuData
}

/**
 * 请求后端的数据获取到的菜单的信息，默认数据是拉平的，需要对数据进行树结构的整理
 */
export const generateTreeRoutes = (menus: MenuData) => {
  const routeDataMap = new Map<string | number, RouteRecordRaw>()
  const menuDataMap = new Map<string | number, MenuDataItem>()
  for (const menuItem of menus) {
    if (!menuItem.id) continue
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
        parentId: menuItem?.id,
        affix: menuItem?.affix,
        parentKeys: menuItem?.parentKeys,
        url: menuItem?.url,
        hideInMenu: menuItem?.hideInMenu,
        hideChildrenInMenu: menuItem?.hideChildrenInMenu,
        hideInBreadcrumb: menuItem?.hideInBreadcrumb,
        target: menuItem?.target,
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
      continue
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

export const generateRoutes = async () => {
  const menuData = genRoutes(dynamicRoutes)

  return {
    menuData,
    routeData: dynamicRoutes,
  }
}

// 路由拉平处理
const flatRoutes = (routes: RouteRecordRaw[]) => {
  const flatRouteData: RouteRecordRaw[] = []
  for (const route of routes) {
    flatRouteData.push(omit(route, ['chidlren']) as RouteRecordRaw)
    if (route.children && route.children.length)
      flatRouteData.push(...flatRoutes(route.children))
  }
  return flatRouteData
}

export const generateFlatRoutes = (routes: RouteRecordRaw[]) => {
  const flatRouets = flatRoutes(routes)
  // 拿到拉平后的路由，然后统一添加一个父级的路由,通过这层路由实现保活的功能
  const parentRoute: RouteRecordRaw = {
    path: '/',
    redirect: ROOT_ROUTE_REDIRECT_PATH,
    name: 'ROOT_EMPTY_PATH',
    component: getRouterModule('RouteView'),
    children: flatRouets,
  }
  return [parentRoute]
}

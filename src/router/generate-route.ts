
// 通过菜单生成路由

import type { RouteRecordRaw } from 'vue-router'
import type { MenuData, MenuDataItem } from '~@/layouts/basic-layout/typing'

// 本地静态路由生成菜单的信息
export const genRoutes = (routes: RouteRecordRaw[]) => {
  const menuData: MenuData = []
  routes.forEach((route) => {
    const item: MenuDataItem = {
      title: route.meta?.title || '',
      icon: route.meta?.icon || '',
      path: route.path,
      children: [],
      hideInMenu: route.meta?.hideInMenu || false,
      parentKeys: route.meta?.parentKeys || [],
      isIframe: route.meta?.isIframe || false,
      hideInBreadcrumb: route.meta?.hideInBreadcrumb || false,
      keepAlive: route.meta?.keepAlive || false,
    }
    if (route.children && route.children.length)
      item.children = genRoutes(route.children)
    if (item.children?.length === 0) delete item.children
    menuData.push(item)
  })
  return menuData
}

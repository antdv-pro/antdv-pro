
// 通过菜单生成路由

import { isUrl } from '@v-c/utils'
import type { RouteRecordRaw } from 'vue-router'
import type { MenuData, MenuDataItem } from '~@/layouts/basic-layout/typing'
let cache_key = 1

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
      route.name = `Cache_Key_${cache_key++}`
    const item: MenuDataItem = {
      title: route.meta?.title || '',
      icon: route.meta?.icon || '',
      path,
      children: [],
      hideInMenu: route.meta?.hideInMenu || false,
      parentKeys: route.meta?.parentKeys || [],
      isIframe: route.meta?.isIframe || false,
      hideInBreadcrumb: route.meta?.hideInBreadcrumb || false,
      hideChildrenInMenu: route.meta?.hideChildrenInMenu || false,
      keepAlive: route.meta?.keepAlive || false,
      name: route.name as string,
      url: route.meta?.url || '',
      target: route.meta?.target || '_blank',
    }
    if (route.children && route.children.length)
      item.children = genRoutes(route.children, item)
    if (item.children?.length === 0) delete item.children
    menuData.push(item)
  })
  return menuData
}

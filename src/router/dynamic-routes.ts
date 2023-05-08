import type { RouteRecordRaw } from 'vue-router'
import { basicRouteMap } from './router-modules'
export const ROOT_ROUTE_REDIRECT_PATH = '/dashboard'
const Layout = () => import('~/layouts/index.vue')

export const rootRoute: RouteRecordRaw = {
  path: '/',
  name: 'rootPath',
  redirect: ROOT_ROUTE_REDIRECT_PATH,
  component: Layout,
  children: [],
}

export default [
  {
    path: '/dashboard',
    redirect: '/dashboard/analysis',
    name: 'Dashboard',
    meta: {
      title: '仪表盘',
      icon: 'DashboardOutlined',
    },
    component: basicRouteMap.RouteView,
    children: [
      {
        path: '/dashboard/analysis',
        name: 'DashboardAnalysis',
        component: () => import('~/pages/dashboard/analysis.vue'),
        meta: {
          title: '分析页',
        },
      },
    ],
  },
  {
    path: '/form',
    redirect: '/form/basic',
    name: 'Form',
    meta: {
      title: '表单页',
      icon: 'FormOutlined',
    },
    component: basicRouteMap.RouteView,
    children: [
      {
        path: '/form/basic',
        name: 'FormBasic',
        component: () => import('~/pages/form/basic.vue'),
        meta: {
          title: '基础表单',
        },
      },
    ],
  },
  {
    path: '/link',
    redirect: '/link/iframe',
    name: 'Link',
    meta: {
      title: '链接',
      icon: 'LinkOutlined',
    },
    component: basicRouteMap.RouteView,
    children: [
      {
        path: '/link/iframe',
        name: 'LinkIframe',
        component: basicRouteMap.Iframe,
        meta: {
          title: 'AntDesign',
          url: 'https://ant.design/',
        },
      }, {
        path: '/link/antdv',
        name: 'LinkAntdv',
        component: basicRouteMap.Iframe,
        meta: {
          title: 'AntDesignVue',
          url: 'https://antdv.com/',
        },
      },
      {
        path: 'https://www.baidu.com',
        name: 'LinkExternal',
        meta: {
          title: '跳转百度',
          // target: '_self',
        },
      },
    ],
  },
  {
    path: '/menu',
    redirect: '/menu/menu1',
    name: 'Menu',
    meta: {
      title: '菜单',
      icon: 'BarsOutlined',
    },
    component: basicRouteMap.RouteView,
    children: [
      {
        path: '/menu/menu1',
        name: 'MenuMenu11',
        component: () => import('~/pages/menu/menu1.vue'),
        meta: {
          title: '菜单1',
        },
      },
      {
        path: '/menu/menu2',
        name: 'MenuMenu12',
        component: () => import('~/pages/menu/menu2.vue'),
        meta: {
          title: '菜单2',
        },
      },
      {
        path: '/menu/menu3',
        redirect: '/menu/menu3/menu1',
        name: 'MenuMenu1-1',
        meta: {
          title: '菜单1-1',
        },
        children: [
          {
            path: '/menu/menu3/menu1',
            name: 'MenuMenu111',
            component: () => import('~/pages/menu/menu-1-1/menu1.vue'),
            meta: {
              title: '菜单1-1-1',
            },
          },
          {
            path: '/menu/menu3/menu2',
            name: 'MenuMenu112',
            component: () => import('~/pages/menu/menu-1-1/menu2.vue'),
            meta: {
              title: '菜单1-1-2',
            },
          },
        ],
      },
    ],
  },
] as RouteRecordRaw[]

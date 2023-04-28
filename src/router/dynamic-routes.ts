import type { RouteRecordRaw } from 'vue-router'
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
    },
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
    },
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
    path: '/menu',
    redirect: '/menu/menu1',
    name: 'Menu',
    meta: {
      title: '菜单',
    },
    children: [
      {
        path: '/menu/menu11',
        name: 'MenuMenu11',
        component: () => import('~/pages/menu/menu1.vue'),
        meta: {
          title: '菜单1',
        },
      },
      {
        path: '/menu/menu12',
        name: 'MenuMenu12',
        component: () => import('~/pages/menu/menu2.vue'),
        meta: {
          title: '菜单2',
        },
      },
      {
        path: '/menu/menu1-1',
        redirect: '/menu/menu1-1/menu1',
        name: 'MenuMenu1-1',
        meta: {
          title: '菜单1-1',
        },
        children: [
          {
            path: '/menu/menu11',
            name: 'MenuMenu11',
            component: () => import('~/pages/menu/menu-1/menu-1-1/menu1.vue'),
            meta: {
              title: '菜单1-1-1',
            },
          },
          {
            path: '/menu/menu12',
            name: 'MenuMenu12',
            component: () => import('~/pages/menu/menu-1/menu-1-1/menu2.vue'),
            meta: {
              title: '菜单1-1-2',
            },
          },
        ],
      },
    ],
  },
] as RouteRecordRaw[]

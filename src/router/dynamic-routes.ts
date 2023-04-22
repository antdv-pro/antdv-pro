import type { RouteRecordRaw } from 'vue-router'
export const ROOT_ROUTE_REDIRECT_PATH = '/dashboard'

export const rootRoute: RouteRecordRaw = {
  path: '/',
  name: 'rootPath',
  redirect: ROOT_ROUTE_REDIRECT_PATH,
  component: () => import('~/layouts/basic-layout.vue'),
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
] as RouteRecordRaw[]

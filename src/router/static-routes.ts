import type { RouteRecordRaw } from 'vue-router'
export default [
  {
    path: '/login',
    component: () => import('~/pages/common/login.vue'),
    meta: {
      title: '登录',
    },
  },
  {
    path: '/:pathMatch(.*)',
    component: () => import('~/pages/exception/error.vue'),
  },
] as RouteRecordRaw[]

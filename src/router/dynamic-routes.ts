import type { RouteRecordRaw } from 'vue-router'
import { basicRouteMap } from './router-modules'

export default [
  {
    path: '/dashboard',
    redirect: '/dashboard/analysis',
    name: 'Dashboard',
    meta: {
      title: '仪表盘',
      icon: 'DashboardOutlined',
    },
    // component: basicRouteMap.RouteView,  别加basicRouteMap.RouteView
    children: [
      {
        path: '/dashboard/analysis',
        name: 'DashboardAnalysis',
        component: () => import('~/pages/dashboard/analysis/index.vue'),
        meta: {
          title: '分析页',
        },
      },
      {
        path: '/dashboard/monitor',
        name: 'DashboardMonitor',
        component: () => import('~/pages/dashboard/monitor/index.vue'),
        meta: {
          title: '监控页',
        },
      },
      {
        path: '/dashboard/workplace',
        name: 'DashboardWorkplace',
        component: () => import('~/pages/dashboard/workplace/index.vue'),
        meta: {
          title: '监控页',
        },
      },
    ],
  },
  {
    path: '/form',
    redirect: '/form/basic-form',
    name: 'Form',
    meta: {
      title: '表单页',
      icon: 'FormOutlined',
    },
    component: basicRouteMap.RouteView,
    children: [
      {
        path: '/form/basic-form',
        name: 'FormBasic',
        component: () => import('~/pages/form/basic-form/index.vue'),
        meta: {
          title: '基础表单',
          locale: 'menu.form.basic-form',
        },
      },
      {
        path: '/form/step-form',
        name: 'FormStep',
        component: () => import('~/pages/form/step-form/index.vue'),
        meta: {
          title: '分步表单',
          locale: 'menu.form.step-form',
        },
      },
      {
        path: '/form/advanced-form',
        name: 'FormAdvanced',
        component: () => import('~/pages/form/advanced-form/index.vue'),
        meta: {
          title: '高级表单',
          locale: 'menu.form.advanced-form',
        },
      },
    ],
  },
  {
    path: '/test',
    redirect: '/test/page1',
    name: 'Test',
    meta: {
      title: '测试嵌套路由',
      icon: 'UserOutlined',
      // keepAlive: true
    },
    component: () => import('~/pages/test/wrap.vue'),
    children: [
      {
        path: '/test/page1',
        name: 'TEST_PAGE_1',
        component: () => import('~/pages/test/page1.vue'),
        meta: {
          title: 'page1',
        },
      },
      {
        path: '/test/page2',
        name: 'TEST_PAGE_2',
        component: () => import('~/pages/test/page2.vue'),
        meta: {
          title: 'page2',
        },
      },
    ],
  },
] as RouteRecordRaw[]

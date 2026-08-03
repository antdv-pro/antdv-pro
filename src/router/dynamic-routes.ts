import type { RouteRecordRaw } from 'vue-router'
import { basicRouteMap } from './router-modules'

export default [
  {
    path: '/dashboard/workplace',
    name: 'DashboardWorkplace',
    component: () => import('~/pages/dashboard/workplace/index.vue'),
    meta: {
      title: '首页',
      icon: 'HomeOutlined',
      locale: 'menu.dashboard',
    },
  },
  {
    path: '/oa-approval',
    redirect: '/oa-approval/dashboard',
    name: 'OAApproval',
    component: basicRouteMap.RouteView,
    meta: {
      title: 'OA办公审批',
      icon: 'AuditOutlined',
      locale: 'menu.oa-approval',
    },
    children: [
      {
        path: '/oa-approval/dashboard',
        name: 'OaFinanceDashboard',
        component: () => import('~/pages/approval/oa/dashboard.vue'),
        meta: {
          title: '财务看板',
          locale: 'menu.oa-approval.dashboard',
          oaModule: 'dashboard',
        },
      },
      {
        path: '/oa-approval/center',
        name: 'ApprovalCenter',
        component: () => import('~/pages/approval/index.vue'),
        meta: {
          title: '审批中心',
          locale: 'menu.oa-approval.center',
          approvalView: 'center',
        },
      },
      {
        path: '/oa-approval/receivable-payable',
        name: 'OaReceivablePayable',
        component: () => import('~/pages/approval/oa/receivable-payable.vue'),
        meta: {
          title: '应收应付',
          locale: 'menu.oa-approval.receivable-payable',
          oaModule: 'receivable',
        },
      },
      {
        path: '/oa-approval/cash',
        name: 'OaCashManagement',
        component: () => import('~/pages/approval/oa/cash.vue'),
        meta: {
          title: '现金管理',
          locale: 'menu.oa-approval.cash',
          oaModule: 'cash',
        },
      },
      {
        path: '/oa-approval/salary',
        name: 'OaSalaryManagement',
        component: () => import('~/pages/approval/oa/salary.vue'),
        meta: {
          title: '工资管理',
          locale: 'menu.oa-approval.salary',
          oaModule: 'salary',
        },
      },
      {
        path: '/oa-approval/vehicle',
        name: 'OaOfficeVehicle',
        component: () => import('~/pages/approval/office-vehicle/index.vue'),
        meta: {
          title: '办公用车',
          locale: 'menu.oa-approval.vehicle',
          oaModule: 'vehicle',
        },
      },
      {
        path: '/oa-approval/org',
        name: 'OaOrganizationLegacyRedirect',
        redirect: '/system/organization',
        meta: {
          title: '组织架构',
          locale: 'menu.oa-approval.org',
          hideInMenu: true,
        },
      },
      {
        path: '/oa-approval/todo',
        name: 'ApprovalTodo',
        component: () => import('~/pages/approval/index.vue'),
        meta: {
          title: '待我审批',
          locale: 'menu.oa-approval.todo',
          approvalView: 'todo',
          hideInMenu: true,
        },
      },
      {
        path: '/oa-approval/done',
        name: 'ApprovalDone',
        component: () => import('~/pages/approval/index.vue'),
        meta: {
          title: '已办审批',
          locale: 'menu.oa-approval.done',
          approvalView: 'done',
          hideInMenu: true,
        },
      },
      {
        path: '/oa-approval/submitted',
        name: 'ApprovalSubmitted',
        component: () => import('~/pages/approval/index.vue'),
        meta: {
          title: '我发起的',
          locale: 'menu.oa-approval.submitted',
          approvalView: 'submitted',
          hideInMenu: true,
        },
      },
      {
        path: '/oa-approval/cc',
        name: 'ApprovalCc',
        component: () => import('~/pages/approval/index.vue'),
        meta: {
          title: '抄送我的',
          locale: 'menu.oa-approval.cc',
          approvalView: 'cc',
          hideInMenu: true,
        },
      },
      {
        path: '/oa-approval/templates',
        name: 'ApprovalTemplates',
        component: () => import('~/pages/approval/index.vue'),
        meta: {
          title: '审批模板',
          locale: 'menu.oa-approval.templates',
          approvalView: 'templates',
          hideInMenu: true,
        },
      },
      {
        path: '/oa-approval/business',
        name: 'ApprovalBusiness',
        component: () => import('~/pages/approval/index.vue'),
        meta: {
          title: '业务回写',
          locale: 'menu.oa-approval.business',
          approvalView: 'business',
          hideInMenu: true,
        },
      },
      {
        path: '/oa-approval/wecom',
        name: 'WecomApprovalIntegration',
        component: () => import('~/pages/approval/wecom.vue'),
        meta: {
          title: '企业微信互通',
          locale: 'menu.oa-approval.wecom',
          access: 'ADMIN',
        },
      },
    ],
  },
  {
    path: '/transport',
    redirect: '/transport/operations',
    name: 'Transport',
    meta: {
      title: '运输管理',
      icon: 'CarOutlined',
      locale: 'menu.transport',
    },
    component: basicRouteMap.RouteView,
    children: [
      {
        path: '/transport/operations',
        name: 'TransportOperations',
        component: () => import('~/pages/transport/operations/index.vue'),
        meta: {
          title: '运营数据',
          locale: 'menu.transport.operations',
        },
      },
      {
        path: '/transport/orders',
        name: 'TransportOrders',
        component: () => import('~/pages/transport/module.vue'),
        meta: {
          title: '运输订单',
          locale: 'menu.transport.orders',
        },
      },
      {
        path: '/transport/tracking',
        name: 'TransportTracking',
        component: () => import('~/pages/transport/gps/index.vue'),
        meta: {
          title: '北斗监控',
          locale: 'menu.transport.tracking',
        },
      },
      {
        path: '/transport/fuel',
        name: 'TransportFuel',
        component: () => import('~/pages/transport/fuel/index.vue'),
        meta: {
          title: '加油明细',
          locale: 'menu.transport.fuel',
        },
      },
      {
        path: '/transport/etc',
        name: 'TransportEtc',
        component: () => import('~/pages/transport/etc/index.vue'),
        meta: {
          title: 'ETC费用',
          locale: 'menu.transport.etc',
        },
      },
      {
        path: '/transport/fees',
        name: 'TransportFees',
        component: () => import('~/pages/transport/fees/index.vue'),
        meta: {
          title: '规费管理',
          locale: 'menu.transport.fees',
        },
      },
      {
        path: '/transport/maintenance',
        name: 'TransportMaintenance',
        component: () => import('~/pages/transport/maintenance/index.vue'),
        meta: {
          title: '维保管理',
          locale: 'menu.transport.maintenance',
        },
      },
      {
        path: '/transport/driver-payroll',
        name: 'TransportDriverPayroll',
        component: () => import('~/pages/transport/driver-payroll/index.vue'),
        meta: {
          title: '司机薪酬',
          locale: 'menu.transport.driver-payroll',
        },
      },
      {
        path: '/transport/vehicle-loans',
        name: 'TransportVehicleLoans',
        component: () => import('~/pages/transport/vehicle-loans/index.vue'),
        meta: {
          title: '车贷费用',
          locale: 'menu.transport.vehicle-loans',
        },
      },
      {
        path: '/transport/bill-reconciliation',
        name: 'TransportBillReconciliation',
        component: () => import('~/pages/transport/bill-reconciliation/index.vue'),
        meta: {
          title: '账单核对',
          locale: 'menu.transport.bill-reconciliation',
        },
      },
      {
        path: '/transport/base-data',
        name: 'TransportBaseData',
        component: () => import('~/pages/transport/base-data/index.vue'),
        meta: {
          title: '基础数据',
          locale: 'menu.transport.base-data',
        },
      },
      {
        path: '/transport/site-credentials',
        name: 'TransportSiteCredentials',
        component: () => import('~/pages/transport/site-credentials/index.vue'),
        meta: {
          title: '帐号网址',
          locale: 'menu.transport.site-credentials',
        },
      },
    ],
  },
  {
    path: '/trade',
    redirect: '/trade/orders',
    name: 'Trade',
    meta: {
      title: '贸易管理',
      icon: 'SwapOutlined',
      locale: 'menu.trade',
    },
    component: basicRouteMap.RouteView,
    children: [
      {
        path: '/trade/orders',
        name: 'TradeOrders',
        component: () => import('~/pages/trade/orders/index.vue'),
        meta: {
          title: '贸易订单',
          locale: 'menu.trade.orders',
        },
      },
    ],
  },
  {
    path: '/hotel',
    name: 'Hotel',
    component: () => import('~/pages/hotel/revenue/index.vue'),
    meta: {
      title: '酒店管理',
      icon: 'BankOutlined',
      locale: 'menu.hotel',
    },
  },
  {
    path: '/hotel/revenue',
    redirect: '/hotel',
  },
] as RouteRecordRaw[]

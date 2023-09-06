export enum AccessEnum {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum DynamicLoadEnum {
  FRONTEND = 'FRONTEND', // 前端动态加载菜单，使用这种方式将从dynamic-routes.ts中加载菜单和路由信息
  BACKEND = 'BACKEND', // 后端动态加载菜单， 使用这种方式将从后端接口加载菜单和路由信息
}

export enum STATUS {
  OFF = '0',
  RUNNING = '1',
  ONLINE = '2',
  ERROR = '3',

}
// 默认情况下我们提供从后端加载的逻辑
export const DYNAMIC_LOAD_WAY = import.meta.env.VITE_APP_LOAD_ROUTE_WAY ?? DynamicLoadEnum.BACKEND

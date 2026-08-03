export type SystemStatus = 'enabled' | 'disabled'
export type OrgType = 'company' | 'department' | 'post'
export type DataScope = 'all' | 'company' | 'department' | 'self'

export interface SystemUser {
  id?: number
  username: string
  nickname: string
  mobile: string
  wecomUserId?: string
  wecomDepartmentId?: string
  email?: string
  companyId?: string
  companyName?: string
  deptId?: string
  deptName?: string
  postId?: string
  postName?: string
  leaderId?: number
  leaderName?: string
  roleIds: string[]
  roles: string[]
  status: SystemStatus
  lastLoginAt?: string
  createdAt?: string
  updatedAt?: string
  password?: string
}

export interface OrganizationNode {
  id?: string
  parentId?: string
  type: OrgType
  name: string
  code: string
  leaderId?: number
  leaderName?: string
  sortNo: number
  status: SystemStatus
  remark?: string
}

export interface RoleRecord {
  id?: string
  code: string
  name: string
  dataScope: DataScope
  menuPermissions: string[]
  buttonPermissions: string[]
  status: SystemStatus
  remark?: string
}

export interface DictionaryItem {
  id?: string
  type: string
  typeName: string
  label: string
  value: string
  sortNo: number
  status: SystemStatus
  remark?: string
}

export interface LoginLog {
  id: string
  username: string
  nickname?: string
  ip: string
  userAgent?: string
  status: 'success' | 'failed' | 'logout'
  message: string
  createdAt: string
}

export interface OperationLog {
  id: string
  module: string
  action: string
  content: string
  operatorId?: number
  operatorName?: string
  targetId?: string | number
  createdAt: string
}

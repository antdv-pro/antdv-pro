import type { SystemStatus, SystemUser } from './models'

export function getSystemUsersApi(params?: { keyword?: string, deptId?: string, status?: SystemStatus }) {
  return useGet<SystemUser[]>('/system/users', params)
}

export function saveSystemUserApi(data: Partial<SystemUser>) {
  return usePost<SystemUser, Partial<SystemUser>>('/system/users/save', data)
}

export function deleteSystemUserApi(id: number) {
  return useDelete(`/system/users/${id}`)
}

export function disableSystemUserApi(id: number, status: SystemStatus) {
  return usePost<SystemUser, { status: SystemStatus }>(`/system/users/${id}/disable`, { status })
}

export function resetSystemUserPasswordApi(id: number, password: string) {
  return usePost(`/system/users/${id}/reset-password`, { password })
}

import type { RoleRecord } from './models'

export function getSystemRolesApi() {
  return useGet<RoleRecord[]>('/system/roles')
}

export function saveSystemRoleApi(data: Partial<RoleRecord>) {
  return usePost<RoleRecord, Partial<RoleRecord>>('/system/roles/save', data)
}

export function deleteSystemRoleApi(id: string) {
  return useDelete(`/system/roles/${id}`)
}

import type { OrganizationNode } from './models'

export function getSystemOrganizationsApi() {
  return useGet<OrganizationNode[]>('/system/orgs')
}

export function saveSystemOrganizationApi(data: Partial<OrganizationNode>) {
  return usePost<OrganizationNode, Partial<OrganizationNode>>('/system/orgs/save', data)
}

export function deleteSystemOrganizationApi(id: string) {
  return useDelete(`/system/orgs/${id}`)
}

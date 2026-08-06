import type { RoleRecord, SystemUser } from '../../utils/system-store'
import type { AuditOperation } from './types'

export function saveRoleRecord(
  roles: RoleRecord[],
  users: SystemUser[],
  payload: Partial<RoleRecord>,
  nextId: () => string,
) {
  let role = payload.id ? roles.find(item => item.id === payload.id) : undefined
  let operation: AuditOperation
  if (!role) {
    role = {
      id: nextId(),
      code: String(payload.code ?? ''),
      name: String(payload.name ?? ''),
      dataScope: payload.dataScope ?? 'self',
      menuPermissions: payload.menuPermissions ?? [],
      buttonPermissions: payload.buttonPermissions ?? [],
      status: payload.status ?? 'enabled',
      remark: payload.remark,
    }
    roles.push(role)
    operation = { module: '角色权限', action: 'create', content: `新增角色 ${role.name}`, targetId: role.id }
  }
  else {
    Object.assign(role, payload)
    const roleById = new Map(roles.map(item => [item.id, item]))
    users.forEach((user) => {
      user.roles = user.roleIds.map(id => roleById.get(id)?.code).filter(Boolean) as string[]
    })
    operation = { module: '角色权限', action: 'update', content: `编辑角色 ${role.name}`, targetId: role.id }
  }
  return { role, operation }
}

export function deleteRoleRecord(roles: RoleRecord[], users: SystemUser[], id: string) {
  const index = roles.findIndex(item => item.id === id)
  if (index < 0)
    throw new Error('角色不存在')
  if (users.some(user => user.roleIds.includes(id)))
    throw new Error('已有用户绑定该角色，不能删除')
  const [role] = roles.splice(index, 1)
  return {
    role,
    operation: { module: '角色权限', action: 'delete', content: `删除角色 ${role.name}`, targetId: role.id } satisfies AuditOperation,
  }
}

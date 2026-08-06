import type { SystemStatus, SystemUser } from '../../utils/system-store'
import type { AuditOperation } from './types'

export function toPublicUser(user: SystemUser) {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...rest } = user
  return rest
}

export function listUserRecords(users: SystemUser[], query: { keyword?: unknown, deptId?: unknown, status?: unknown } = {}) {
  const keyword = String(query.keyword ?? '').trim().toLowerCase()
  const deptId = String(query.deptId ?? '')
  const status = String(query.status ?? '')
  return users.filter((item) => {
    const matchKeyword = !keyword || [item.username, item.nickname, item.mobile, item.deptName, item.postName]
      .some(value => String(value ?? '').toLowerCase().includes(keyword))
    return matchKeyword && (!deptId || item.deptId === deptId) && (!status || item.status === status)
  }).map(toPublicUser)
}

export function changeUserStatus(users: SystemUser[], id: number, status: SystemStatus, timestamp: string) {
  const user = users.find(item => item.id === Number(id))
  if (!user)
    throw new Error('用户不存在')
  user.status = status
  user.updatedAt = timestamp
  return {
    user,
    operation: {
      module: '用户管理',
      action: 'disable',
      content: `${status === 'disabled' ? '禁用' : '启用'}用户 ${user.nickname}`,
      targetId: user.id,
    } satisfies AuditOperation,
  }
}

export function resetUserCredential(
  users: SystemUser[],
  id: number,
  password: string,
  timestamp: string,
  createCredential: (password: string) => Pick<SystemUser, 'passwordSalt' | 'passwordHash'>,
) {
  const user = users.find(item => item.id === Number(id))
  if (!user)
    throw new Error('用户不存在')
  if (password.length < 6 || password.length > 64)
    throw new Error('密码长度必须为 6–64 个字符')
  Object.assign(user, createCredential(password), { updatedAt: timestamp })
  return {
    user,
    operation: { module: '用户管理', action: 'reset-password', content: `重置用户 ${user.nickname} 密码`, targetId: user.id } satisfies AuditOperation,
  }
}

export function deleteUserRecord(users: SystemUser[], id: number) {
  const index = users.findIndex(item => item.id === Number(id))
  if (index < 0)
    throw new Error('用户不存在')
  const [user] = users.splice(index, 1)
  return {
    user,
    operation: { module: '用户管理', action: 'delete', content: `删除用户 ${user.nickname}`, targetId: user.id } satisfies AuditOperation,
  }
}

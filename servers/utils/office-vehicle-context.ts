import type { H3Event } from 'h3'
import type { OperatorContext } from './office-vehicle-store'
import { requireAuthenticatedUser } from './security'

export function getOperatorContext(event: H3Event): OperatorContext {
  const user = requireAuthenticatedUser(event)
  return {
    userId: user.id,
    userName: user.nickname,
    deptId: user.deptId,
    deptName: user.deptName,
    roles: user.roles,
  }
}

// Compatibility exports for routes pending migration to the shared HTTP helper.
export function ok<T>(data: T, msg = '获取成功') {
  return { code: 200, msg, data }
}

export function fail(error: any, fallback = '操作失败') {
  return { code: 400, msg: error?.message || fallback }
}

import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { systemStore } from '../../utils/system-store'
import { syncUserSalary } from './user-salary-sync-service'

function token(event: H3Event) {
  return getRequestHeader(event, 'Authorization')
}

export const systemUserService = {
  list: (query: Record<string, unknown>) => systemStore.listUsers(query),
  async save(event: H3Event, payload: Record<string, unknown>) {
    const user = await systemStore.saveUser(payload, token(event))
    await syncUserSalary(user as any)
    return user
  },
  remove: (event: H3Event, id: number) => systemStore.deleteUser(id, token(event)),
  async setStatus(event: H3Event, id: number, status: 'enabled' | 'disabled') {
    const user = await systemStore.disableUser(id, status, token(event))
    await syncUserSalary(user as any)
    return user
  },
  resetPassword: (event: H3Event, id: number, password: string) => systemStore.resetPassword(id, password, token(event)),
}

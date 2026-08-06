import type { ActionPayload, TransferPayload } from './types'
import { approvalStore } from '../../utils/approval-store'

export const approvalTaskRepository = {
  get: (id: string) => approvalStore.getTask(id),
  listTodo: (userId: string | number, query: Record<string, unknown>) => approvalStore.listTodo(userId, query),
  listDone: (userId: string | number, query: Record<string, unknown>) => approvalStore.listDone(userId, query),
  listSubmitted: (userId: string | number, query: Record<string, unknown>) => approvalStore.listSubmitted(userId, query),
  listCc: (userId: string | number, query: Record<string, unknown>) => approvalStore.listCc(userId, query),
  approve: (input: ActionPayload) => approvalStore.approve(input),
  reject: (input: ActionPayload) => approvalStore.reject(input),
  transfer: (input: TransferPayload) => approvalStore.transfer(input),
}

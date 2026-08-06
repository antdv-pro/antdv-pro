import { approvalTaskRepository } from '../../repositories/approval/task-repository'

export const approvalTaskService = {
  listTodo: (userId: string | number, query: Record<string, unknown>) => approvalTaskRepository.listTodo(userId, query),
  listDone: (userId: string | number, query: Record<string, unknown>) => approvalTaskRepository.listDone(userId, query),
  listSubmitted: (userId: string | number, query: Record<string, unknown>) => approvalTaskRepository.listSubmitted(userId, query),
  listCc: (userId: string | number, query: Record<string, unknown>) => approvalTaskRepository.listCc(userId, query),
  approve: (input: Parameters<typeof approvalTaskRepository.approve>[0]) => approvalTaskRepository.approve(input),
  reject: (input: Parameters<typeof approvalTaskRepository.reject>[0]) => approvalTaskRepository.reject(input),
  transfer: (input: Parameters<typeof approvalTaskRepository.transfer>[0]) => approvalTaskRepository.transfer(input),
}

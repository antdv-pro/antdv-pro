import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { systemStore } from '../../utils/system-store'

export const systemLogService = {
  listLogin: (query: Record<string, unknown>) => systemStore.listLoginLogs(query),
  listOperations: (query: Record<string, unknown>) => systemStore.listOperationLogs(query),
  record(event: H3Event, payload: { module?: unknown, action?: string, content?: unknown, targetId?: string | number }) {
    const operator = systemStore.getUserByToken(getRequestHeader(event, 'Authorization'))
    systemStore.addOperationLog({
      module: String(payload.module || '系统管理'),
      action: payload.action || 'export',
      content: String(payload.content || '执行导出操作'),
      operatorId: operator?.id,
      operatorName: operator?.nickname,
      targetId: payload.targetId,
    })
  },
}

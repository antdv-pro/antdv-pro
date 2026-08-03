import type { LoginLog, OperationLog } from './models'

export function getSystemLoginLogsApi(params?: { keyword?: string }) {
  return useGet<LoginLog[]>('/system/logs/login', params)
}

export function getSystemOperationLogsApi(params?: { keyword?: string, action?: string }) {
  return useGet<OperationLog[]>('/system/logs/operation', params)
}

export function recordSystemOperationApi(data: { module: string, action: string, content: string, targetId?: string | number }) {
  return usePost('/system/logs/operation-record', data)
}

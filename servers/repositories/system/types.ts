export interface AuditOperation {
  module: string
  action: 'create' | 'update' | 'delete' | 'disable' | 'reset-password'
  content: string
  targetId: string | number
}

export interface OperatorIdentity {
  id?: number
  nickname?: string
}

export function withOperator(operation: AuditOperation, operator?: OperatorIdentity) {
  return { ...operation, operatorId: operator?.id, operatorName: operator?.nickname }
}

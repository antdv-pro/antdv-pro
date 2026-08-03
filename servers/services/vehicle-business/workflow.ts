export const VEHICLE_FINANCE_ROLES = ['ADMIN', 'FINANCE_MANAGER'] as const
export const OFFICE_VEHICLE_FINANCE_ROLES = ['ADMIN', 'OFFICE_ADMIN', 'FINANCE_MANAGER'] as const
export const VEHICLE_EXPORT_ROLES = ['ADMIN', 'OFFICE_ADMIN', 'FINANCE_MANAGER', 'DEPT_LEADER'] as const

export type StatusTransitionMap<TStatus extends string> = Readonly<Record<TStatus, readonly TStatus[]>>

export function assertStatusValue<TStatus extends string>(value: unknown, allowed: readonly TStatus[], label = '状态'): asserts value is TStatus {
  if (!allowed.includes(value as TStatus))
    throw new Error(`${label}不合法`)
}

export function assertStatusTransition<TStatus extends string>(current: TStatus, next: TStatus, transitions: StatusTransitionMap<TStatus>, label = '状态') {
  if (current === next)
    return
  if (!transitions[current]?.includes(next))
    throw new Error(`${label}不能从“${current}”变更为“${next}”`)
}

export const expenseApprovalTransitions = {
  草稿: ['待审批', '审批中', '已确认', '已撤回'],
  待审批: ['审批中', '已确认', '已驳回', '已撤回'],
  审批中: ['已确认', '已驳回', '已撤回'],
  已驳回: ['待审批', '审批中', '已撤回'],
  已撤回: ['待审批', '审批中'],
  已确认: [],
} as const satisfies StatusTransitionMap<'草稿' | '待审批' | '审批中' | '已确认' | '已驳回' | '已撤回'>

export const manualEnableTransitions = {
  enabled: ['disabled'],
  disabled: ['enabled'],
} as const satisfies StatusTransitionMap<'enabled' | 'disabled'>

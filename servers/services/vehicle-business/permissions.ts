export type VehicleRecordAction = 'view' | 'edit' | 'delete' | 'audit' | 'revoke' | 'void' | 'confirmImport'

export interface VehiclePermissionContext {
  userId?: string | number
  roles?: Array<string | number>
}

export type VehicleRecordPermissions = Partial<Record<VehicleRecordAction, boolean | { allowed: boolean, reason?: string }>>

function hasAnyRole(context: VehiclePermissionContext, roles: string[]) {
  return (context.roles ?? []).some(role => roles.includes(String(role)))
}

function denied(reason: string) {
  return { allowed: false, reason }
}

export function officeVehiclePermissions(
  kind: 'vehicle' | 'expense' | 'license' | 'insurance' | 'reminder',
  record: Record<string, any>,
  context: VehiclePermissionContext,
): VehicleRecordPermissions {
  const officeAdmin = hasAnyRole(context, ['ADMIN', 'OFFICE_ADMIN'])
  const financeAdmin = hasAnyRole(context, ['ADMIN', 'OFFICE_ADMIN', 'FINANCE_MANAGER'])
  const maintainer = kind === 'expense' || kind === 'insurance' ? financeAdmin : officeAdmin
  const locked = kind === 'vehicle'
    ? record.status === '已出售'
    : kind === 'expense' && ['已确认', '审批中'].includes(String(record.approvalStatus ?? record.status ?? ''))
  const lockReason = kind === 'vehicle' ? '已出售车辆不允许修改' : '已确认或审批中记录不允许修改'
  const roleReason = kind === 'expense' ? '无费用维护权限' : '无车辆档案维护权限'
  const canMaintain = maintainer && !locked

  return {
    view: true,
    edit: canMaintain || denied(locked ? lockReason : roleReason),
    delete: canMaintain || denied(locked ? lockReason : roleReason),
    audit: financeAdmin || denied('无费用审核权限'),
    revoke: financeAdmin || denied('无费用状态维护权限'),
    void: financeAdmin || denied('无费用状态维护权限'),
  }
}

export function maintenancePermissions(record: Record<string, any>, context: VehiclePermissionContext): VehicleRecordPermissions {
  const admin = hasAnyRole(context, ['ADMIN'])
  const departmentLeader = hasAnyRole(context, ['DEPT_LEADER'])
  const maintainer = admin || departmentLeader
  const locked = ['已审核', '已归档', '已作废'].includes(String(record.status ?? ''))
  const canMaintain = maintainer && !locked
  const lockedReason = '已审核、已归档或已作废记录不允许修改'
  const roleReason = '无维保记录维护权限'

  return {
    view: true,
    edit: canMaintain || denied(locked ? lockedReason : roleReason),
    delete: canMaintain || denied(locked ? lockedReason : roleReason),
    audit: maintainer || denied('无维保审核权限'),
    revoke: maintainer || denied('无维保状态维护权限'),
    void: maintainer || denied('无维保状态维护权限'),
  }
}

export function withoutRecordPermissions<T extends Record<string, any>>(record: T): Omit<T, 'permissions'> {
  const { permissions: _permissions, ...persisted } = record
  return persisted
}

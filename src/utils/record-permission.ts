import type {
  PermissionAwareRecord,
  PermissionUser,
  RecordAction,
  RecordPermissionResult,
  RecordPermissionValue,
} from '~@/types/record-permission'
import { AccessEnum } from '~@/utils/constant'

const editableStatuses = new Set(['draft', 'rejected', 'pending'])
const lockedStatuses = new Set(['approved', 'imported', 'void', 'revoked', 'canceled', 'disabled', 'expired'])
const pendingStatuses = new Set(['pending', 'approving', 'import_pending'])
const auditRoles = new Set(['FINANCE_MANAGER', 'DEPT_LEADER', 'GENERAL_MANAGER', AccessEnum.ADMIN])
const importRoles = new Set(['FINANCE_MANAGER', 'DEPT_LEADER', AccessEnum.ADMIN])

const statusAliases: Record<string, string> = {
  草稿: 'draft',
  DRAFT: 'draft',
  待审核: 'pending',
  待审批: 'pending',
  待处理: 'pending',
  待确认: 'pending',
  审批中: 'approving',
  PENDING: 'pending',
  APPROVING: 'approving',
  已审核: 'approved',
  已通过: 'approved',
  APPROVED: 'approved',
  已驳回: 'rejected',
  驳回: 'rejected',
  REJECTED: 'rejected',
  已导入: 'imported',
  IMPORTED: 'imported',
  导入失败: 'failed',
  FAILED: 'failed',
  作废: 'void',
  已作废: 'void',
  VOID: 'void',
  已撤回: 'revoked',
  撤回: 'revoked',
  REVOKED: 'revoked',
  已取消: 'canceled',
  CANCELED: 'canceled',
  停用: 'disabled',
  已截止: 'expired',
}

function normalizeId(value: unknown) {
  return value === undefined || value === null ? '' : String(value)
}

function normalizeStatus(value: unknown) {
  const raw = String(value ?? '').trim()
  return statusAliases[raw] ?? raw.toLowerCase()
}

function result(allowed: boolean, reason?: string): RecordPermissionResult {
  return { allowed, reason: allowed ? undefined : reason }
}

function fromBackendPermission(value?: RecordPermissionValue): RecordPermissionResult | undefined {
  if (value === undefined)
    return undefined
  if (typeof value === 'boolean')
    return result(value, value ? undefined : '后端权限不允许')
  return result(Boolean(value.allowed), value.reason)
}

function hasRole(user: PermissionUser | undefined, roleSet: Set<string | AccessEnum>) {
  return (user?.roles ?? []).some(role => roleSet.has(String(role) as AccessEnum))
}

function isAdmin(user: PermissionUser | undefined) {
  return hasRole(user, new Set([AccessEnum.ADMIN]))
}

function isCreator(record: PermissionAwareRecord, user: PermissionUser | undefined) {
  const userId = normalizeId(user?.id)
  if (!userId)
    return false
  return [record.createdBy, record.creatorId, record.applicantId].some(id => normalizeId(id) === userId)
}

function isAuditor(record: PermissionAwareRecord, user: PermissionUser | undefined) {
  const userId = normalizeId(user?.id)
  if (!userId)
    return false
  return [record.auditorId, record.approverId, record.assigneeId].some(id => normalizeId(id) === userId)
}

function getRecordStatus(record: PermissionAwareRecord) {
  return normalizeStatus(record.status ?? record.approvalStatus ?? record.importStatus)
}

function isLockedRecord(record: PermissionAwareRecord) {
  const status = getRecordStatus(record)
  return record.isApproved || record.isImported || lockedStatuses.has(status)
}

export function getRecordPermission(
  record: PermissionAwareRecord,
  currentUser: PermissionUser | undefined,
  action: RecordAction,
): RecordPermissionResult {
  const backendPermission = fromBackendPermission(record.permissions?.[action])
  if (backendPermission)
    return backendPermission

  if (action === 'view')
    return result(true)

  const status = getRecordStatus(record)
  const admin = isAdmin(currentUser)

  if (action === 'edit') {
    if (isLockedRecord(record))
      return result(false, '已审核、已导入或已锁定记录不允许修改')
    if (admin || (isCreator(record, currentUser) && editableStatuses.has(status)))
      return result(true)
    return result(false, '仅创建人可修改草稿、待审核或驳回记录')
  }

  if (action === 'delete') {
    if (isLockedRecord(record))
      return result(false, '已审核、已导入或已锁定记录不允许删除')
    if (admin || (isCreator(record, currentUser) && editableStatuses.has(status)))
      return result(true)
    return result(false, '仅创建人可删除草稿、待审核或驳回记录')
  }

  if (action === 'audit') {
    if (!pendingStatuses.has(status))
      return result(false, '仅待审核记录可审核')
    if (admin || isAuditor(record, currentUser) || hasRole(currentUser, auditRoles))
      return result(true)
    return result(false, '当前用户不是审批人')
  }

  if (action === 'revoke' || action === 'void') {
    if (!pendingStatuses.has(status))
      return result(false, '仅审批中记录可撤回或作废')
    if (admin || isCreator(record, currentUser))
      return result(true)
    return result(false, '仅创建人可撤回或作废')
  }

  if (action === 'confirmImport') {
    const importStatus = normalizeStatus(record.importStatus ?? record.status)
    if (!pendingStatuses.has(importStatus))
      return result(false, '仅待确认导入记录可确认')
    if (admin || isCreator(record, currentUser) || hasRole(currentUser, importRoles))
      return result(true)
    return result(false, '当前用户不能确认导入')
  }

  return result(false, '无操作权限')
}

export function canViewRecord(record: PermissionAwareRecord, currentUser?: PermissionUser) {
  return getRecordPermission(record, currentUser, 'view')
}

export function canEditRecord(record: PermissionAwareRecord, currentUser?: PermissionUser) {
  return getRecordPermission(record, currentUser, 'edit')
}

export function canDeleteRecord(record: PermissionAwareRecord, currentUser?: PermissionUser) {
  return getRecordPermission(record, currentUser, 'delete')
}

export function canAuditRecord(record: PermissionAwareRecord, currentUser?: PermissionUser) {
  return getRecordPermission(record, currentUser, 'audit')
}

export function canConfirmImport(record: PermissionAwareRecord, currentUser?: PermissionUser) {
  return getRecordPermission(record, currentUser, 'confirmImport')
}

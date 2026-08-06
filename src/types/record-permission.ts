export type RecordAction = 'view' | 'edit' | 'delete' | 'audit' | 'revoke' | 'void' | 'confirmImport'

export interface RecordPermissionResult {
  allowed: boolean
  reason?: string
}

export type RecordPermissionValue = boolean | RecordPermissionResult

export interface PermissionAwareRecord {
  id?: string | number
  status?: string
  approvalStatus?: string
  importStatus?: string
  createdBy?: string | number
  creatorId?: string | number
  applicantId?: string | number
  auditorId?: string | number
  approverId?: string | number
  assigneeId?: string | number
  isApproved?: boolean
  isImported?: boolean
  permissions?: Partial<Record<RecordAction, RecordPermissionValue>>
}

export interface PermissionUser {
  id?: string | number
  username?: string
  nickname?: string
  roles?: Array<string | number>
}

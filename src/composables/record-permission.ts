import type { PermissionAwareRecord, RecordAction } from '~@/types/record-permission'
import { getRecordPermission } from '~@/utils/record-permission'

export function useRecordPermission() {
  const userStore = useUserStore()
  const currentUser = computed(() => userStore.userInfo)

  const canRecord = (record: PermissionAwareRecord, action: RecordAction) => {
    return getRecordPermission(record, currentUser.value, action)
  }

  return {
    currentUser,
    canRecord,
    canViewRecord: (record: PermissionAwareRecord) => canRecord(record, 'view'),
    canEditRecord: (record: PermissionAwareRecord) => canRecord(record, 'edit'),
    canDeleteRecord: (record: PermissionAwareRecord) => canRecord(record, 'delete'),
    canAuditRecord: (record: PermissionAwareRecord) => canRecord(record, 'audit'),
    canRevokeRecord: (record: PermissionAwareRecord) => canRecord(record, 'revoke'),
    canVoidRecord: (record: PermissionAwareRecord) => canRecord(record, 'void'),
    canConfirmImport: (record: PermissionAwareRecord) => canRecord(record, 'confirmImport'),
  }
}

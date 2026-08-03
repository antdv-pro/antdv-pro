import type { TransportOperationDataset } from '../../utils/transport-operation-store'
import { maintenancePermissions, withoutRecordPermissions } from './permissions'

interface MaintenanceUser {
  id?: string | number
  roles?: Array<string | number>
}

function recordKey(record: Record<string, any>) {
  return String(record.id ?? record.code ?? '')
}

export function presentMaintenanceDataset(dataset: TransportOperationDataset, user: MaintenanceUser): TransportOperationDataset {
  return {
    ...dataset,
    maintenance: dataset.maintenance.map(record => ({
      ...record,
      permissions: maintenancePermissions(record, { userId: user.id, roles: user.roles }),
    })),
  }
}

export function prepareMaintenanceDataset(
  incoming: Partial<TransportOperationDataset>,
  current: TransportOperationDataset,
  user: MaintenanceUser,
) {
  const creators = new Map(current.maintenance.map(record => [recordKey(record), record.createdBy]))
  return {
    ...incoming,
    maintenance: (incoming.maintenance ?? []).map((record) => {
      const persisted = withoutRecordPermissions(record)
      return {
        ...persisted,
        createdBy: creators.get(recordKey(record)) ?? record.createdBy ?? user.id,
      }
    }),
  }
}

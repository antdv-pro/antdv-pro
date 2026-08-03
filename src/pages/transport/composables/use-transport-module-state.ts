import { useTransportBaseDataState } from './use-transport-base-data-state'
import { useTransportImportState } from './use-transport-import-state'
import { useTransportOrderForm } from './use-transport-order-form'
import { useTransportQueryState } from './use-transport-query-state'

export type { TransportImportKind } from './use-transport-import-state'
export type { TransportOrderForm } from './use-transport-order-form'
export { createEmptyTransportOrderForm } from './use-transport-order-form'

export function useTransportModuleState() {
  return {
    ...useTransportOrderForm(),
    ...useTransportBaseDataState(),
    ...useTransportQueryState(),
    ...useTransportImportState(),
  }
}

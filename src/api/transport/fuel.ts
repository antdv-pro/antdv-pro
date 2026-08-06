import type { FuelRecord } from '~@/composables/transport-operation-data'

export interface TransportFuelCreatePayload {
  date: string
  plateNo: string
  location: string
  product: string
  quantity: number
  quantityUnit?: 'L' | 'kg'
  amount: number
  driver?: string
  status?: string
}

export function importTransportFuelApi(records: FuelRecord[]) {
  return usePost<{ importedCount: number }>('/transport/fuel/import', { records })
}

export function createTransportFuelRecordApi(payload: TransportFuelCreatePayload) {
  return usePost<FuelRecord>('/transport/fuel/create', payload)
}

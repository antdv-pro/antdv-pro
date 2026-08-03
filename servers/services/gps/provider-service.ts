import type { GpsProvider } from '../../utils/gps-store'
import { gpsStore } from '../../utils/gps-store'

export const gpsProviderService = {
  listConfigs: () => gpsStore.listProviderConfigs(),
  listDevices: () => gpsStore.listDevices(),
  listSyncLogs: () => gpsStore.listSyncLogs(),
  listOperationLogs: () => gpsStore.listOperationLogs(),
  syncDevices: (provider?: GpsProvider) => gpsStore.syncDevices(provider),
  bindVehicleDevice: (input: Parameters<typeof gpsStore.bindVehicleDevice>[0]) => gpsStore.bindVehicleDevice(input),
}

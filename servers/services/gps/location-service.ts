import type { GpsProvider } from '../../utils/gps-store'
import { gpsStore } from '../../utils/gps-store'

export const gpsLocationService = {
  listVehicles: (query: Record<string, unknown>) => gpsStore.listVehicles(query),
  listLatest: (query: Record<string, unknown>) => gpsStore.listLatestLocations(query),
  syncLatest: (provider?: GpsProvider) => gpsStore.syncLatestLocations(provider),
  getVehicleLocation: (vehicleId: string) => gpsStore.getVehicleLocation(vehicleId),
  getVehicleTrack: (vehicleId: string, startTime?: string, endTime?: string, provider?: GpsProvider) => gpsStore.getVehicleTrack(vehicleId, startTime, endTime, provider),
  getVehicleStatuses: () => gpsStore.getVehicleStatuses(),
  getMapData: (query: Record<string, unknown>) => gpsStore.getMapData(query),
}

import { gpsStore } from '../../utils/gps-store'

export const gpsGeofenceService = {
  list: () => gpsStore.listGeofences(),
  save: (input: Parameters<typeof gpsStore.upsertGeofence>[0]) => gpsStore.upsertGeofence(input),
  bindVehicles: (input: Parameters<typeof gpsStore.bindGeofenceVehicles>[0]) => gpsStore.bindGeofenceVehicles(input),
  syncRoutes: (input: Parameters<typeof gpsStore.syncRouteGeofences>[0]) => gpsStore.syncRouteGeofences(input),
}

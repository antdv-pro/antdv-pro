import type { GpsProvider } from '../../utils/gps-store'
import { gpsStore } from '../../utils/gps-store'

export const gpsAlarmService = {
  list: (query: Record<string, unknown>) => gpsStore.listAlarms(query),
  sync: (provider?: GpsProvider) => gpsStore.syncAlarms(provider),
  handle: (input: Parameters<typeof gpsStore.handleAlarm>[0]) => gpsStore.handleAlarm(input),
}

import type { GpsAlarmRecord } from '~@/api/gps'

export function summarizeGpsAlarms(rows: GpsAlarmRecord[], startDate: string, endDate: string) {
  const periodRows = rows.filter(alarm => alarm.alarmTime >= startDate && alarm.alarmTime < endDate)
  return {
    total: periodRows.length,
    handled: periodRows.filter(alarm => alarm.status !== 'unhandled').length,
    unhandled: periodRows.filter(alarm => alarm.status === 'unhandled').length,
    vehicles: new Set(periodRows.map(alarm => alarm.vehicleId).filter(Boolean)).size,
  }
}

import type { GpsAlarmRecord } from '~@/api/gps'
import { describe, expect, it } from 'vitest'
import { summarizeGpsAlarms } from './gps-financial-summary'

function alarm(id: string, alarmTime: string, status: GpsAlarmRecord['status'], vehicleId = 'V1') {
  return { id, alarmTime, status, vehicleId } as GpsAlarmRecord
}

describe('gps financial summary', () => {
  it('uses a left-closed and right-open period and counts affected vehicles', () => {
    const result = summarizeGpsAlarms([
      alarm('before', '2026-06-25 23:59:59', 'handled'),
      alarm('start', '2026-06-26 00:00:00', 'unhandled'),
      alarm('handled', '2026-07-25 10:00:00', 'handled', 'V2'),
      alarm('ignored', '2026-07-25 11:00:00', 'ignored', 'V2'),
      alarm('next', '2026-07-26 00:00:00', 'unhandled'),
    ], '2026-06-26', '2026-07-26')

    expect(result).toEqual({ total: 3, handled: 2, unhandled: 1, vehicles: 2 })
  })
})

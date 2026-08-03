import { describe, expect, it } from 'vitest'
import { normalize808GpsTrackRange } from './gps808-adapter'

describe('808GPS track query range', () => {
  it('converts ISO timestamps to the provider Beijing-time format', () => {
    expect(normalize808GpsTrackRange(
      '2026-07-20T16:00:00.000Z',
      '2026-07-21T16:00:00.000Z',
    )).toEqual({
      startTime: '2026-07-21 00:00:00',
      endTime: '2026-07-22 00:00:00',
    })
  })

  it('defaults to the previous 24 hours when no range is provided', () => {
    expect(normalize808GpsTrackRange(undefined, undefined, new Date('2026-07-21T08:30:00.000Z'))).toEqual({
      startTime: '2026-07-20 16:30:00',
      endTime: '2026-07-21 16:30:00',
    })
  })

  it('rejects reversed ranges', () => {
    expect(() => normalize808GpsTrackRange('2026-07-22T00:00:00Z', '2026-07-21T00:00:00Z')).toThrow('开始时间不能晚于结束时间')
  })
})

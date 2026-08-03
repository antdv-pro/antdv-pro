import { describe, expect, it } from 'vitest'
import { getGeofenceTransition, getTimedGeofenceTransition, isGeofenceLocationFresh, isLocationTimeAfter, isPointInGeofence } from './geofence'

describe('isPointInGeofence', () => {
  it('checks a GPS point against a circular fence in meters', () => {
    const fence = { shape: 'circle' as const, center: [121.47, 31.23] as [number, number], radius: 1000 }
    expect(isPointInGeofence([121.471, 31.231], fence)).toBe(true)
    expect(isPointInGeofence([121.5, 31.25], fence)).toBe(false)
  })

  it('checks a GPS point against a polygon fence', () => {
    const fence = { shape: 'polygon' as const, points: [[0, 0], [10, 0], [10, 10], [0, 10]] as Array<[number, number]> }
    expect(isPointInGeofence([5, 5], fence)).toBe(true)
    expect(isPointInGeofence([15, 5], fence)).toBe(false)
  })

  it('only emits transitions when a vehicle crosses the boundary', () => {
    const fence = { shape: 'circle' as const, center: [121.47, 31.23] as [number, number], radius: 1000 }
    expect(getGeofenceTransition([121.5, 31.25], [121.471, 31.231], fence)).toBe('enter')
    expect(getGeofenceTransition([121.471, 31.231], [121.5, 31.25], fence)).toBe('exit')
    expect(getGeofenceTransition([121.471, 31.231], [121.472, 31.232], fence)).toBeUndefined()
    expect(getGeofenceTransition(undefined, [121.471, 31.231], fence)).toBeUndefined()
  })

  it('excludes stale, invalid and future locations', () => {
    const now = Date.parse('2026-07-15T05:00:00Z')
    expect(isGeofenceLocationFresh('2026-07-15T04:30:00Z', now)).toBe(true)
    expect(isGeofenceLocationFresh('2026-07-15T04:29:59Z', now)).toBe(false)
    expect(isGeofenceLocationFresh('2026-07-15T05:00:01Z', now)).toBe(false)
    expect(isGeofenceLocationFresh('invalid', now)).toBe(false)
    expect(isLocationTimeAfter('2026-07-15 05:00:01', '2026-07-15 05:00:00')).toBe(true)
    expect(isLocationTimeAfter('2026-07-15 05:00:01', 'invalid')).toBe(true)
    expect(isLocationTimeAfter('invalid', '2026-07-15 05:00:00')).toBe(false)
  })

  it('requires time-ordered consecutive points for transitions', () => {
    const fence = { shape: 'circle' as const, center: [121.47, 31.23] as [number, number], radius: 1000 }
    const outside = { point: [121.5, 31.25] as [number, number], locationTime: '2026-07-15T04:00:00Z' }
    const inside = { point: [121.471, 31.231] as [number, number], locationTime: '2026-07-15T04:10:00Z' }
    expect(getTimedGeofenceTransition(outside, inside, fence)).toBe('enter')
    expect(getTimedGeofenceTransition(inside, outside, fence)).toBeUndefined()
    expect(getTimedGeofenceTransition(outside, { ...inside, locationTime: '2026-07-15T04:30:01Z' }, fence)).toBeUndefined()
  })
})

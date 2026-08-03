import type { GpsGeofence, GpsLocationLatest } from '~@/api/gps'
import { describe, expect, it } from 'vitest'
import { filterGpsFencesForRoute, findNearbyGpsFence, resolveGpsRouteStageByAddress } from './gps-location-address'

const location = { longitude: 108.5, latitude: 34.2 } as GpsLocationLatest

describe('findNearbyGpsFence', () => {
  it('returns the nearest fence containing the vehicle', () => {
    const fences: GpsGeofence[] = [
      { id: 'loading', name: '装车围栏', shape: 'circle', center: [108.5, 34.2], radius: 1000, routeStage: 'loading', enabled: true },
      { id: 'unloading', name: '卸车围栏', shape: 'circle', center: [108.5001, 34.2], radius: 1000, routeStage: 'unloading', enabled: true },
    ]

    expect(findNearbyGpsFence(location, fences)?.id).toBe('loading')
  })

  it('ignores disabled and out-of-range fences', () => {
    const fences: GpsGeofence[] = [
      { id: 'disabled', name: '卸车围栏', shape: 'circle', center: [108.5, 34.2], radius: 1000, enabled: false },
      { id: 'far', name: '装车围栏', shape: 'circle', center: [109.5, 35.2], radius: 1000, enabled: true },
    ]

    expect(findNearbyGpsFence(location, fences)).toBeUndefined()
  })
})

describe('filterGpsFencesForRoute', () => {
  const fences: GpsGeofence[] = [
    { id: 'ansai', name: '安塞华油装车围栏', address: '安塞华油', shape: 'circle', center: [109.3, 36.8], radius: 1500, routeCode: 'LX001', routeName: '安塞至宝鸡', routeStage: 'loading', enabled: true },
    { id: 'qianyang', name: '千阳卸车围栏', address: '宝鸡千阳', shape: 'circle', center: [107.1, 34.6], radius: 1500, routeCode: 'LX001', routeName: '安塞至宝鸡', routeStage: 'unloading', enabled: true },
    { id: 'other', name: '其他路线装车围栏', address: '宝鸡千阳', shape: 'circle', center: [107.1, 34.6], radius: 1500, routeCode: 'LX002', routeName: '其他路线', routeStage: 'loading', enabled: true },
  ]

  it('keeps only fences bound to the order route', () => {
    expect(filterGpsFencesForRoute(fences, { code: 'LX001', name: '安塞至宝鸡' }).map(item => item.id)).toEqual(['ansai', 'qianyang'])
  })

  it('does not fall back to another explicitly bound route', () => {
    expect(filterGpsFencesForRoute(fences, { code: 'LX003', name: '未知路线' })).toEqual([])
  })

  it('matches legacy fence codes through the same route endpoint', () => {
    expect(filterGpsFencesForRoute(fences, {
      code: 'LX999',
      name: '安塞华油-宝鸡千阳',
      loadingAddress: '安塞华油',
      unloadingAddress: '宝鸡千阳',
    }).map(item => item.id)).toEqual(['ansai', 'qianyang'])
  })
})

describe('resolveGpsRouteStageByAddress', () => {
  const route = { loadingAddress: '安塞华油', unloadingAddress: '千阳段坊' }

  it('recognizes the unloading county when the precise fence is missing', () => {
    expect(resolveGpsRouteStageByAddress('宝鸡市 千阳县', route)).toBe('unloading')
  })

  it('recognizes the loading district', () => {
    expect(resolveGpsRouteStageByAddress('延安市 安塞区', route)).toBe('loading')
  })

  it('does not use a broad city match for another destination', () => {
    expect(resolveGpsRouteStageByAddress('宝鸡市 岐山县', route)).toBeUndefined()
  })
})

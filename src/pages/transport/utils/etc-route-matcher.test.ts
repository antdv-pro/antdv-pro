import { describe, expect, it } from 'vitest'
import { decorateEtcRoute, decorateEtcRoutes, matchEtcRoute } from './etc-route-matcher'

const routes = [
  { code: 'LX001', name: '宁强液厂-勉县庆港站', loadingAddress: '宁强液厂', unloadingAddress: '勉县庆港站', status: '启用' },
  { code: 'LX002', name: '子洲液厂-西安杨庄南站', loadingAddress: '子洲液厂', unloadingAddress: '西安杨庄南站', status: '启用' },
]

function etc(entryInfo: string, exitInfo: string) {
  return { code: 'E1', entryInfo, exitInfo, name: `${entryInfo} 至 ${exitInfo}` } as any
}

describe('ETC route matcher'.toLowerCase(), () => {
  it('identifies a route from normalized entrance and exit stations', () => {
    expect(matchEtcRoute(etc('宁强南收费站', '勉县收费站'), routes)).toMatchObject({
      routeCode: 'LX001',
      routeLine: '宁强液厂-勉县庆港站',
      routeMatchStatus: '已识别',
    })
  })

  it('supports a return trip', () => {
    expect(matchEtcRoute(etc('勉县收费站', '宁强南收费站'), routes)).toMatchObject({
      routeCode: 'LX001',
      routeMatchStatus: '已识别',
    })
  })

  it('automatically accepts the best valid partial match', () => {
    const result = matchEtcRoute(etc('宁强南收费站', ''), routes)
    expect(result.routeMatchStatus).toBe('已识别')
    expect(result.routeCode).toBe('LX001')
  })

  it('decorates a copy without mutating the imported ETC row', () => {
    const source = etc('子洲收费站', '杨庄南收费站')
    const decorated = decorateEtcRoute(source, routes)
    expect(decorated.routeCode).toBe('LX002')
    expect(source).not.toHaveProperty('routeCode')
  })

  it('combines consecutive toll segments into one route journey', () => {
    const rows = [
      { ...etc('宁强南收费站', '汉中收费站'), plateNo: '青A12345', updatedAt: '2026-07-20' },
      { ...etc('汉中收费站', '洋县收费站'), code: 'E2', plateNo: '青A12345', updatedAt: '2026-07-20' },
      { ...etc('洋县收费站', '勉县收费站'), code: 'E3', plateNo: '青A12345', updatedAt: '2026-07-20' },
    ] as any
    const result = decorateEtcRoutes(rows, routes)
    expect(result.map(row => row.routeCode)).toEqual(['LX001', 'LX001', 'LX001'])
    expect(new Set(result.map(row => row.routeJourneyId)).size).toBe(1)
    expect(result[0].routeSegmentCount).toBe('3')
  })

  it('uses the same-vehicle same-day order to distinguish similar route endpoints', () => {
    const rows = [
      { ...etc('韩家坝收费站', '勉县收费站'), plateNo: '青H76930', updatedAt: '2026-03-04' },
      { ...etc('勉县收费站', '韩家坝收费站'), code: 'E2', plateNo: '青H76930', updatedAt: '2026-03-04' },
    ] as any
    const orders = [{ code: 'A202603040003', plateNo: '青H76930', shipDate: '2026-03-04', routeLine: '宁强液厂-勉县定军站' }] as any
    const result = decorateEtcRoutes(rows, routes, orders)
    expect(result.map(row => row.routeLine)).toEqual(['宁强液厂-勉县定军站', '宁强液厂-勉县定军站'])
    expect(new Set(result.map(row => row.routeJourneyId))).toEqual(new Set(['order|A202603040003']))
  })
})

import { describe, expect, it } from 'vitest'
import { analyzeEtcActualRoutes } from './transport-etc-route-analysis'

const routes = [
  {
    code: 'LX0002',
    name: '宁强旭日综合能源有限公司-勉县和泰LNG加气站',
    loadingAddress: '宁强旭日综合能源有限公司',
    destinationName: '勉县和泰LNG加气站',
    distance: '85',
    status: '正常',
  },
  {
    code: 'LX0004',
    name: '宁强旭日综合能源有限公司-勉县定军LNG加气站',
    loadingAddress: '宁强旭日综合能源有限公司',
    destinationName: '勉县定军LNG加气站',
    distance: '85',
    status: '正常',
  },
  {
    code: 'LX0036',
    name: '宁强旭日综合能源有限公司-益店加气站',
    loadingAddress: '宁强旭日综合能源有限公司',
    destinationName: '益店加气站',
    distance: '355',
    status: '正常',
  },
]

describe('ETC actual route analysis'.toLowerCase(), () => {
  it('uses a same-vehicle same-day order to identify the exact base route', () => {
    const result = analyzeEtcActualRoutes([
      { plateNo: '青H76930', updatedAt: '2026-03-04', entryInfo: '韩家坝收费站', exitInfo: '勉县收费站', amount: '83.25' },
    ], routes, [
      { plateNo: '青H76930', shipDate: '2026-03-04', routeLine: '宁强液厂-勉县定军站', distance: '85' },
    ])

    expect(result).toMatchObject([{
      routeCode: 'LX0004',
      distance: 85,
      amount: 83.25,
      recordCount: 1,
      estimatedJourneyCount: 1,
      confidence: '已核对',
      matchBasis: '运单核对',
    }])
  })

  it('extends verified route evidence to the same toll corridor', () => {
    const result = analyzeEtcActualRoutes([
      { plateNo: '青H76930', updatedAt: '2026-03-04', entryInfo: '韩家坝收费站', exitInfo: '勉县收费站', amount: 83 },
      { plateNo: '青H76930', updatedAt: '2026-03-05', entryInfo: '勉县收费站', exitInfo: '韩家坝收费站', amount: 84 },
      { plateNo: '青H12345', updatedAt: '2026-03-06', entryInfo: '韩家坝收费站', exitInfo: '勉县收费站', amount: 85 },
    ], routes, [
      { plateNo: '青H76930', shipDate: '2026-03-04', routeLine: '宁强液厂-勉县定军站' },
      { plateNo: '青H76930', shipDate: '2026-03-05', routeLine: '宁强液厂-勉县定军站' },
    ])

    expect(result[0]).toMatchObject({
      routeCode: 'LX0004',
      recordCount: 3,
      matchedRecordCount: 2,
      inferredRecordCount: 1,
      confidence: '推断',
    })
  })

  it('rechecks a pending route after a matching order is entered', () => {
    const records = [
      { plateNo: '青H00001', updatedAt: '2026-03-04', entryInfo: '未知入口', exitInfo: '未知出口', amount: 10 },
    ]
    const pending = analyzeEtcActualRoutes(records, routes, [])

    expect(pending).toMatchObject([{
      routeCode: '',
      routeLine: '待确定路线',
      recordCount: 1,
      confidence: '待确定',
      matchBasis: '待录入同车同日订单后自动查验',
    }])

    const verified = analyzeEtcActualRoutes(records, routes, [
      { plateNo: '青H00001', shipDate: '2026-03-04', routeLine: '宁强液厂-勉县定军站' },
    ])

    expect(verified).toMatchObject([{
      routeCode: 'LX0004',
      routeLine: '宁强旭日综合能源有限公司-勉县定军LNG加气站',
      recordCount: 1,
      confidence: '已核对',
      matchBasis: '运单核对',
    }])
  })
})

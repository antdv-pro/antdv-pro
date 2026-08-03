import { describe, expect, it } from 'vitest'
import { createBaseImportFieldMap, normalizeImportHeader, parseCrewImportRows, selectBaseImportSheet } from './base-data-parser'

describe('transport base data parser', () => {
  it('normalizes invisible characters, spaces and brackets', () => {
    expect(normalizeImportHeader('\uFEFF 车 牌（号） ')).toBe('车牌号')
  })

  it('maps customer and route-specific customer headers', () => {
    const columns = [{ title: '名称', dataIndex: 'name' }]
    expect(createBaseImportFieldMap({ key: 'customer', columns }, columns).get('客户名称')).toBe('name')
    expect(createBaseImportFieldMap({ key: 'route', columns }, columns).get('客户名称')).toBe('customer')
  })

  it('maps loading and unloading coordinate aliases', () => {
    const columns = [
      { title: '装货地经度', dataIndex: 'loadingLongitude' },
      { title: '装货地纬度', dataIndex: 'loadingLatitude' },
      { title: '卸货地经度', dataIndex: 'unloadingLongitude' },
      { title: '卸货地纬度', dataIndex: 'unloadingLatitude' },
    ]
    const fieldMap = createBaseImportFieldMap({ key: 'route', columns }, columns)
    expect(fieldMap.get('装车经度')).toBe('loadingLongitude')
    expect(fieldMap.get('卸车纬度')).toBe('unloadingLatitude')
  })

  it('prefers the crew detail sheet and parses grouped driver and escort fields', () => {
    const fieldMap = createBaseImportFieldMap(
      { key: 'crew', columns: [] },
      [{ title: '车牌号', dataIndex: 'plateNo' }, { title: '司机', dataIndex: 'driverName' }, { title: '押运员', dataIndex: 'escortName' }],
    )
    const summary = { matrix: [['车牌号', '司机'], ['沪A1', '张三']] }
    const detail = {
      matrix: [
        ['说明'],
        ['车牌号', '驾驶员', '电话', '资格证号', '押运员', '手机', '备注'],
        ['沪A1', '张三', '13800000000', 'D-1', '李四', '13900000000', '正常'],
      ],
    }
    const selected = selectBaseImportSheet([summary, detail], 'crew', fieldMap)
    expect(selected.matrix).toBe(detail.matrix)
    expect(parseCrewImportRows(selected.matrix, selected.headerIndex)).toEqual([{
      plateNo: '沪A1',
      driverName: '张三',
      driverPhone: '13800000000',
      driverCertNo: 'D-1',
      escortName: '李四',
      escortPhone: '13900000000',
      remark: '正常',
    }])
  })
})

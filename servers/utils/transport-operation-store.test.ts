import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getTransportOperationRevision, transportOperationStore } from './transport-operation-store'

const mocks = vi.hoisted(() => ({
  pool: undefined as any,
  required: false,
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
}))
vi.mock('./mysql', () => ({
  getMysqlPool: () => mocks.pool,
  isDatabaseRequired: () => mocks.required,
  withMysqlTransaction: (_db: any, handler: any) => handler(mocks.pool),
}))
vi.mock('./json-store', () => ({ readJsonFile: mocks.readJsonFile, writeJsonFile: mocks.writeJsonFile }))

describe('transport operation store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pool = undefined
    mocks.required = false
  })

  it('normalizes incomplete local datasets without sharing omitted categories', async () => {
    mocks.readJsonFile.mockReturnValue({ orders: [{ code: 'O1' }], fuels: 'invalid' })
    await expect(transportOperationStore.getDataset()).resolves.toEqual({
      orders: [{ code: 'O1' }],
      fuels: [],
      etc: [],
      driverPayrolls: [],
      maintenance: [],
      inventoryMovements: [],
      vehicleLoans: [],
      baseCompanies: [],
      baseCustomers: [],
      baseVehicles: [],
      baseCrews: [],
      baseRoutes: [],
    })
  })

  it('removes whitespace from vehicle numbers across operation datasets', async () => {
    mocks.readJsonFile.mockReturnValue({
      orders: [{ code: 'O1', plateNo: '青H 75141' }],
      maintenance: [{ id: 1, plateNo: '青 H 75141' }],
      driverPayrolls: [{ code: 'P1', plateNos: '青H 75141、青H 59588' }],
      baseVehicles: [{ code: '青H 75141', plateNo: '青H 75141', area: '格尔木' }],
      baseCrews: [{ code: 'C1', plateNo: '青H 75141' }],
    })

    const dataset = await transportOperationStore.getDataset()

    expect(dataset.orders[0].plateNo).toBe('青H75141')
    expect(dataset.maintenance[0].plateNo).toBe('青H75141')
    expect(dataset.driverPayrolls[0].plateNos).toBe('青H75141、青H59588')
    expect(dataset.baseVehicles[0]).toMatchObject({ code: '青H75141', plateNo: '青H75141', area: '青海' })
    expect(dataset.baseCrews[0].plateNo).toBe('青H75141')
  })

  it('normalizes and persists local replacement data', async () => {
    const result = await transportOperationStore.replaceDataset({
      orders: [{ code: 'O1' }],
      baseVehicles: [{ id: 1, plateNo: '青A001' }],
      maintenance: null as any,
    })
    expect(result.orders).toEqual([{ code: 'O1' }])
    expect(result.baseVehicles).toHaveLength(1)
    expect(result.maintenance).toEqual([])
    expect(mocks.writeJsonFile).toHaveBeenCalledWith(expect.stringContaining('transport-operation.json'), result)
  })

  it('rejects a stale full-dataset replacement instead of overwriting newer data', async () => {
    mocks.readJsonFile.mockReturnValue({ orders: [{ code: 'NEW' }] })
    const staleRevision = getTransportOperationRevision({
      orders: [{ code: 'OLD' }],
      fuels: [],
      etc: [],
      driverPayrolls: [],
      maintenance: [],
      inventoryMovements: [],
      vehicleLoans: [],
      baseCustomers: [],
      baseVehicles: [],
      baseCrews: [],
      baseRoutes: [],
    })

    await expect(transportOperationStore.replaceDataset({
      orders: [{ code: 'LOCAL' }],
      expectedRevision: staleRevision,
    })).rejects.toThrow('数据已被其他用户更新')
    expect(mocks.writeJsonFile).not.toHaveBeenCalled()
  })

  it('builds missing customer archives from historical transport orders', async () => {
    mocks.readJsonFile.mockReturnValue({
      orders: [
        { code: 'O1', customer: '甲公司' },
        { code: 'O2', customer: '乙公司' },
        { code: 'O3', customer: '乙公司' },
      ],
      baseCustomers: [{ code: 'KH005', name: '甲公司', contact: '张经理' }],
    })

    const result = await transportOperationStore.getDataset()

    expect(result.baseCustomers).toHaveLength(2)
    expect(result.baseCustomers[0]).toMatchObject({ code: 'KH005', name: '甲公司', contact: '张经理' })
    expect(result.baseCustomers[1]).toMatchObject({ code: 'KH006', name: '乙公司', progress: '0', source: '运输订单' })
  })

  it('collapses duplicate customer archives by normalized name', async () => {
    mocks.readJsonFile.mockReturnValue({
      baseCustomers: [
        { code: 'KH001', name: '昆仑物流陕西分公司', area: '陕西', contact: '' },
        { code: 'KH099', name: ' 昆仑物流陕西分公司 ', area: '', contact: '张经理' },
      ],
    })

    const result = await transportOperationStore.getDataset()

    expect(result.baseCustomers).toHaveLength(1)
    expect(result.baseCustomers[0]).toMatchObject({
      code: 'KH001',
      name: '昆仑物流陕西分公司',
      area: '陕西',
      contact: '张经理',
    })
  })

  it('shares valid order vehicles but keeps configured route archives unchanged', async () => {
    mocks.readJsonFile.mockReturnValue({
      orders: [
        { code: 'O1', plateNo: '青H59588', trailerNo: '青A1234挂', driver: '张三', routeLine: '西宁至格尔木', loadingAddress: '西宁', unloadingAddress: '格尔木', shipDate: '2026-07-01' },
        { code: 'O2', plateNo: '损坏车牌-1265', routeLine: '西宁 / 格尔木' },
      ],
      baseVehicles: [],
      baseRoutes: [
        { code: 'LX0050', name: 'Excel 配置路线', source: '基础资料' },
        { code: 'LX0118', name: '旧页面派生路线', source: '运输订单' },
        { code: 'LX0119', name: '服务端派生路线', source: '运输订单自动建档' },
      ],
    })

    const result = await transportOperationStore.getDataset()

    expect(result.baseVehicles).toEqual([
      expect.objectContaining({ code: '青H59588', plateNo: '青H59588', driverName: '张三', source: '运输订单自动建档' }),
    ])
    expect(result.baseRoutes).toEqual([
      expect.objectContaining({ code: 'LX0050', name: 'Excel 配置路线', source: '基础资料' }),
    ])
  })

  it.each([
    ['orders', [{ code: 'O1' }, { code: 'O1' }]],
    ['vehicleLoans', [{ contractNo: 'L1' }, { contractNo: 'L1' }]],
    ['baseCompanies', [{ code: 'GS001' }, { code: 'GS001' }]],
    ['baseCustomers', [{ id: 9 }, { id: 9 }]],
  ])('rejects duplicate business keys in %s before persistence', async (type, records) => {
    await expect(transportOperationStore.replaceDataset({ [type]: records })).rejects.toThrow(`运输运营 ${type} 存在重复标识`)
    expect(mocks.writeJsonFile).not.toHaveBeenCalled()
  })

  it('rejects an ETC summary number imported from different files', async () => {
    await expect(transportOperationStore.replaceDataset({
      etc: [
        { code: '26617903020500031627-001', summaryNo: '26617903020500031627', sourceFileHash: 'a'.repeat(64), sourceFileRow: '1' },
        { code: '26617903020500031627-002', summaryNo: '26617903020500031627', sourceFileHash: 'b'.repeat(64), sourceFileRow: '2' },
      ],
    })).rejects.toThrow('ETC汇总单号 26617903020500031627 已存在，禁止重复录入')
  })

  it('allows all journey rows belonging to one ETC summary file', async () => {
    await expect(transportOperationStore.replaceDataset({
      etc: [
        { code: '26617903020500031627-001', summaryNo: '26617903020500031627', sourceFileHash: 'a'.repeat(64), sourceFileRow: '1' },
        { code: '26617903020500031627-002', summaryNo: '26617903020500031627', sourceFileHash: 'a'.repeat(64), sourceFileRow: '2' },
      ],
    })).resolves.toBeDefined()
  })

  it('rejects the same ETC PDF row twice', async () => {
    const row = { code: '26617903020500031627-1', sourceFileHash: 'a'.repeat(64), sourceFileRow: '1' }
    await expect(transportOperationStore.replaceDataset({ etc: [row, { ...row }] })).rejects.toThrow('运输运营 etc 存在重复标识')
  })

  it('rejects local reads and writes when MySQL is mandatory', async () => {
    mocks.required = true
    await expect(transportOperationStore.getDataset()).rejects.toThrow('运输运营数据禁止读取本地 JSON')
    await expect(transportOperationStore.replaceDataset({})).rejects.toThrow('运输运营数据禁止写入本地 JSON')
  })

  it('loads a populated structured dataset from MySQL without legacy fallback', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT record_json FROM transport_order'))
        return [[{ record_json: '{"code":"O1","shipDate":"2026-07-01"}' }]]
      if (sql.includes('SELECT record_json FROM transport_fuel_record'))
        return [[{ record_json: { code: 'F1' } }]]
      if (sql.includes('SELECT category, record_json'))
        return [[{ category: 'vehicle', record_json: '{"id":"V1"}' }, { category: 'unknown', record_json: '{}' }]]
      return [[]]
    })
    mocks.pool = { query, execute: vi.fn() }
    const data = await transportOperationStore.getDataset()
    expect(data.orders).toEqual([{ code: 'O1', shipDate: '2026-07-01' }])
    expect(data.fuels).toEqual([{ code: 'F1' }])
    expect(data.baseVehicles).toEqual([{ id: 'V1' }])
    expect(query.mock.calls.some(([sql]) => String(sql).includes('SELECT record_type, record_json'))).toBe(false)
    const queryCount = query.mock.calls.length
    await expect(transportOperationStore.getDataset()).resolves.toBe(data)
    expect(query).toHaveBeenCalledTimes(queryCount)
  })

  it('soft-deletes old rows and writes normalized MySQL values', async () => {
    const query = vi.fn().mockResolvedValue([[]])
    const execute = vi.fn().mockResolvedValue([{}])
    mocks.pool = { query, execute }
    const payload = {
      orders: [{ code: 'O1', financeMonth: '2026-07', shipDate: '2026-07-09', customer: '客户', plateNo: '青A001', freightTotal: '¥1,200.50', taxRate: '9%' }],
      fuels: [{ code: 'F1', date: '2026-07-09T12:30:00', plateNo: '青A001', quantity: '30升', amount: '240' }],
      etc: [],
      driverPayrolls: [],
      maintenance: [],
      inventoryMovements: [],
      vehicleLoans: [{ contractNo: 'L1', plateNo: '青A001', lender: '银行', loanAmount: '10,000', payments: [{ periodNo: 1, paymentDate: '2026-08-01', amount: 1000 }] }],
      baseCompanies: [],
      baseCustomers: [],
      baseVehicles: [],
      baseCrews: [],
      baseRoutes: [],
    }
    await expect(transportOperationStore.replaceDataset(payload)).resolves.toMatchObject(payload)
    expect(execute.mock.calls.filter(([sql]) => String(sql).startsWith('UPDATE transport_')).length).toBe(8)
    const orderInsert = execute.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO transport_order'))!
    expect(orderInsert[1]).toEqual(expect.arrayContaining(['O1', 2026, 7, '2026-07-09', 1200.5]))
    expect(execute.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO transport_vehicle_loan_payment'))).toBe(true)
  })

  it('rejects incomplete and unexpectedly destructive bulk replacements', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT record_json FROM transport_order'))
        return [[1, 2, 3, 4].map(index => ({ record_json: { code: `O${index}` } }))]
      return [[]]
    })
    const execute = vi.fn().mockResolvedValue([{}])
    mocks.pool = { query, execute }
    await expect(transportOperationStore.replaceDataset({ orders: [] })).rejects.toThrow('整批保存缺少分类')

    const payload = {
      orders: [{ code: 'O1' }],
      fuels: [],
      etc: [],
      driverPayrolls: [],
      maintenance: [],
      inventoryMovements: [],
      vehicleLoans: [],
      baseCompanies: [],
      baseCustomers: [],
      baseVehicles: [],
      baseCrews: [],
      baseRoutes: [],
    }
    await expect(transportOperationStore.replaceDataset(payload)).rejects.toThrow('数据大幅缩减')
    await expect(transportOperationStore.replaceDataset({ ...payload, confirmDestructiveReplace: true })).resolves.toMatchObject(payload)
  })
})

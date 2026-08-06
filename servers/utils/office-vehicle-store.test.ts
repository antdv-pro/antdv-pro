import { beforeEach, describe, expect, it, vi } from 'vitest'

import { officeVehicleStore } from './office-vehicle-store'

const mocks = vi.hoisted(() => ({ submit: vi.fn(), writeFileSync: vi.fn(), mkdirSync: vi.fn(), getTransportDataset: vi.fn() }))
vi.mock('node:fs', () => ({ existsSync: () => false, readFileSync: vi.fn(), writeFileSync: mocks.writeFileSync, mkdirSync: mocks.mkdirSync }))
vi.mock('./mysql', () => ({ getMysqlPool: () => undefined, isDatabaseRequired: () => false }))
vi.mock('./approval-store', () => ({ approvalStore: { submit: mocks.submit } }))
vi.mock('./transport-operation-store', () => ({ transportOperationStore: { getDataset: mocks.getTransportDataset } }))

const admin = { userId: 1, userName: '管理员', deptId: 'admin', roles: ['ADMIN'] }
const finance = { userId: 3, userName: '财务', deptId: 'finance', roles: ['FINANCE_MANAGER'] }
const user = { userId: 2, userName: '普通用户', deptId: 'none', roles: ['USER'] }

describe('office vehicle store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.submit.mockResolvedValue({ instance: { id: 'APV-1', code: 'APV001' } })
    mocks.getTransportDataset.mockResolvedValue({ baseVehicles: [] })
  })

  it('enforces vehicle visibility by role, owner, driver and department', async () => {
    expect((await officeVehicleStore.listVehicles(admin)).total).toBeGreaterThanOrEqual(3)
    expect((await officeVehicleStore.listVehicles(user)).records.map(item => item.id)).toContain('veh1')
    await expect(officeVehicleStore.getVehicle('veh2', user)).rejects.toThrow('无权查看该车辆')
    await expect(officeVehicleStore.saveVehicle({ plateNo: 'X', brandModel: 'X' }, user)).rejects.toThrow('无车辆档案维护权限')
  })

  it('validates vehicle fields and duplicate plates', async () => {
    await expect(officeVehicleStore.saveVehicle({ brandModel: '测试' }, admin)).rejects.toThrow('车牌号不能为空')
    await expect(officeVehicleStore.saveVehicle({ plateNo: '测试牌' }, admin)).rejects.toThrow('品牌型号不能为空')
    await expect(officeVehicleStore.saveVehicle({ plateNo: '沪A·8899', brandModel: '重复' }, admin)).rejects.toThrow('车牌号不能重复')
  })

  it('rejects vehicles that already exist in transport base vehicle data', async () => {
    mocks.getTransportDataset.mockResolvedValue({ baseVehicles: [{ code: '青A·12345' }] })
    await expect(officeVehicleStore.saveVehicle({ plateNo: ' 青a.12345 ', brandModel: '重复车辆' }, admin))
      .rejects
      .toThrow('该车辆已存在于基础资料车辆信息中，不能增加到办公用车')
  })

  it('creates and deletes an unreferenced vehicle but protects linked vehicles', async () => {
    await expect(officeVehicleStore.deleteVehicle('veh1', admin)).rejects.toThrow('存在关联业务记录')
    const created = await officeVehicleStore.saveVehicle({ plateNo: `TEST-${Date.now()}`, brandModel: '测试车型', ownerName: '管理员' }, admin)
    await expect(officeVehicleStore.deleteVehicle(created.id, admin)).resolves.toMatchObject({ deletedAt: expect.any(String) })
  })

  it('saves one vehicle with multiple related records in one persistence operation', async () => {
    const plateNo = `BATCH-${Date.now()}`
    const result = await officeVehicleStore.saveBatch({
      vehicle: { plateNo, brandModel: '批量录入测试车', ownerName: '管理员' },
      expenses: [
        { expenseType: '停车费', amount: 20, occurredDate: '2026-07-20' },
        { expenseType: '洗车费', amount: 50, occurredDate: '2026-07-21' },
      ],
      licenses: [{ licenseType: '行驶证', licenseNo: `L-${Date.now()}`, expiryDate: '2028-07-20' }],
      insurances: [{ insuranceType: '交强险', policyNo: `P-${Date.now()}`, insurer: '测试保险', amount: 950, startDate: '2026-07-20', endDate: '2027-07-19' }],
      reminders: [{ reminderType: '车辆保养时间', dueDate: '2026-12-20', remindDays: 15 }],
    }, admin)

    expect(result.vehicle).toMatchObject({ plateNo, brandModel: '批量录入测试车' })
    expect(result.expenses).toHaveLength(2)
    expect(result.licenses).toHaveLength(1)
    expect(result.insurances).toHaveLength(1)
    expect(result.reminders).toHaveLength(1)
    expect(mocks.writeFileSync).toHaveBeenCalledTimes(1)
  })

  it('rolls back the whole vehicle batch when a related record is invalid', async () => {
    const plateNo = `ROLLBACK-${Date.now()}`
    await expect(officeVehicleStore.saveBatch({
      vehicle: { plateNo, brandModel: '不应保留的车辆' },
      expenses: [
        { expenseType: '停车费', amount: 20, occurredDate: '2026-07-20' },
        { expenseType: '洗车费', amount: -1, occurredDate: '2026-07-21' },
      ],
    }, admin)).rejects.toThrow('费用第 2 条：费用金额必须为有效的非负数')

    expect((await officeVehicleStore.listVehicles({ ...admin, plateNo })).records).toHaveLength(0)
    expect(mocks.writeFileSync).not.toHaveBeenCalled()
  })

  it('idempotently brings regulatory fee vehicles into office vehicle records', async () => {
    const plateNo = `GF-${Date.now()}`
    const [first, second] = await Promise.all([
      officeVehicleStore.ensureVehicleFromRegulatoryFee(plateNo.replace('-', '.'), '青海'),
      officeVehicleStore.ensureVehicleFromRegulatoryFee(plateNo.replace('-', '·'), '青海'),
    ])
    const normalizedPlateNo = plateNo.replace('-', '·')
    expect(first).toMatchObject({ plateNo: normalizedPlateNo, vehicleType: '办公用车', brandModel: '待补充', departmentName: '青海' })
    expect(second?.id).toBe(first?.id)
  })

  it('skips regulatory fee vehicles that already exist in transport base data', async () => {
    mocks.getTransportDataset.mockResolvedValue({ baseVehicles: [{ code: '青H31702' }] })
    await expect(officeVehicleStore.ensureVehicleFromRegulatoryFee(' 青h.31702 ', '青海')).resolves.toBeUndefined()
  })

  it('loads transport base vehicles once for a regulatory fee batch', async () => {
    mocks.getTransportDataset.mockResolvedValue({ baseVehicles: [{ code: '青H31702' }, { code: '青H31712' }] })
    await expect(officeVehicleStore.ensureVehiclesFromRegulatoryFees([
      { plateNo: '青H31702', area: '青海' },
      { plateNo: '青H31712', area: '青海' },
    ])).resolves.toEqual([undefined, undefined])
    expect(mocks.getTransportDataset).toHaveBeenCalledTimes(1)
  })

  it('validates expense inputs and role permissions', async () => {
    await expect(officeVehicleStore.saveExpense({ vehicleId: 'veh1', expenseType: '停车费', occurredDate: '2026-07-01', amount: 1 }, user)).rejects.toThrow('无费用维护权限')
    await expect(officeVehicleStore.saveExpense({ vehicleId: 'veh1', expenseType: '停车费', occurredDate: '2026-07-01', amount: Number.NaN }, finance)).rejects.toThrow('费用金额必须为有效的非负数')
    await expect(officeVehicleStore.saveExpense({ vehicleId: 'veh1', expenseType: '停车费', occurredDate: '2026-07-01', amount: -1 }, finance)).rejects.toThrow('费用金额必须为有效的非负数')
    await expect(officeVehicleStore.saveExpense({ vehicleId: 'missing', expenseType: '停车费', occurredDate: '2026-07-01' }, finance)).rejects.toThrow('车辆不存在')
  })

  it('awaits approval submission and writes the returned instance id', async () => {
    const expense = await officeVehicleStore.saveExpense({ vehicleId: 'veh1', expenseType: '维修费', occurredDate: '2026-07-10', amount: 800, needApproval: true }, finance)
    const submitted = await officeVehicleStore.submitExpenseApproval(expense.id, finance)
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ businessType: 'office_vehicle_expense', businessId: expense.id, amount: 800 }))
    expect(submitted).toMatchObject({ approvalStatus: '审批中', approvalInstanceId: 'APV-1' })
    await expect(officeVehicleStore.submitExpenseApproval(expense.id, finance)).rejects.toThrow('已提交审批')
    await expect(officeVehicleStore.deleteExpense(expense.id, finance)).rejects.toThrow('审批中的费用不能删除')
  })

  it('validates confirmation status at runtime', async () => {
    const expense = await officeVehicleStore.saveExpense({ vehicleId: 'veh1', expenseType: '洗车费', occurredDate: '2026-07-10', amount: 50, needApproval: true }, finance)
    await expect(officeVehicleStore.confirmExpense(expense.id, 'invalid' as any, finance)).rejects.toThrow('费用状态不合法')
    await expect(officeVehicleStore.confirmExpense(expense.id, '已确认', finance)).resolves.toMatchObject({ approvalStatus: '已确认' })
    await expect(officeVehicleStore.saveExpense({ ...expense, amount: 60 }, finance)).rejects.toThrow('已确认费用不能编辑')
  })

  it('validates license chronology and supports license lifecycle', async () => {
    await expect(officeVehicleStore.saveLicense({ vehicleId: 'veh1', licenseType: '行驶证', licenseNo: 'X', issueDate: '2026-07-02', expiryDate: '2026-07-01' }, admin)).rejects.toThrow('到期日期不能早于签发日期')
    const license = await officeVehicleStore.saveLicense({ vehicleId: 'veh1', licenseType: '年检证', licenseNo: `L-${Date.now()}`, issueDate: '2026-01-01', expiryDate: '2028-01-01' }, admin)
    expect(license).toMatchObject({ plateNo: '沪A·8899', status: '有效' })
    await officeVehicleStore.deleteLicense(license.id, admin)
    expect((await officeVehicleStore.listLicenses({ ...admin, vehicleId: 'veh1' })).records.some(item => item.id === license.id)).toBe(false)
  })

  it('validates insurance amounts and date order', async () => {
    const base = { vehicleId: 'veh1', insuranceType: '商业险', policyNo: 'P1', insurer: '保险公司', startDate: '2026-07-01', endDate: '2027-07-01' }
    await expect(officeVehicleStore.saveInsurance({ ...base, amount: Number.NaN }, admin)).rejects.toThrow('保险金额必须为有效的非负数')
    await expect(officeVehicleStore.saveInsurance({ ...base, startDate: '2027-07-02', endDate: '2027-07-01' }, admin)).rejects.toThrow('结束日期不能早于开始日期')
    await expect(officeVehicleStore.saveInsurance({ ...base, policyNo: `P-${Date.now()}`, amount: 1000, attachmentName: '保单.pdf', attachmentUrl: '/uploads/2026/07/policy.pdf' }, admin)).resolves.toMatchObject({
      amount: 1000,
      plateNo: '沪A·8899',
      attachmentName: '保单.pdf',
      attachmentUrl: '/uploads/2026/07/policy.pdf',
    })
  })

  it('restricts reminder handling to finance or vehicle administrators', async () => {
    await expect(officeVehicleStore.handleReminder('rem1', {}, user)).rejects.toThrow('无费用维护权限')
    await expect(officeVehicleStore.handleReminder('rem1', { handleRemark: '已续保' }, finance)).resolves.toMatchObject({ handled: true, status: '已处理', handleRemark: '已续保' })
  })

  it('creates, edits and deletes vehicle due items', async () => {
    await expect(officeVehicleStore.saveReminder({ vehicleId: 'veh1', reminderType: '车辆年审到期' }, admin)).rejects.toThrow('请选择到期或保养日期')
    await expect(officeVehicleStore.saveReminder({ vehicleId: 'veh1', reminderType: '车辆年审到期', dueDate: '2027-01-01' }, user)).rejects.toThrow('无车辆档案维护权限')
    const reminder = await officeVehicleStore.saveReminder({
      vehicleId: 'veh1',
      reminderType: '车辆保养时间',
      dueDate: '2027-01-15',
      remindDays: 15,
      targetNames: ['车队负责人'],
    }, admin)
    expect(reminder).toMatchObject({ plateNo: '沪A·8899', reminderType: '车辆保养时间', sourceType: 'maintenance', targetNames: ['车队负责人'] })
    const updated = await officeVehicleStore.saveReminder({ ...reminder, reminderType: '车辆保险到期', dueDate: '2027-02-01' }, admin)
    expect(updated).toMatchObject({ reminderType: '车辆保险到期', sourceType: 'insurance' })
    await officeVehicleStore.deleteReminder(reminder.id, admin)
    expect((await officeVehicleStore.listReminders({ ...admin, vehicleId: 'veh1' })).records.some(item => item.id === reminder.id)).toBe(false)
  })

  it('produces summary and export data from visible expenses', async () => {
    const summary = await officeVehicleStore.summary(admin)
    expect(summary.vehicleCount).toBeGreaterThan(0)
    expect(summary.monthExpense).toBeGreaterThan(0)
    expect(summary.byVehicle[0]).toHaveProperty('amount')
    const exported = await officeVehicleStore.exportExpenses({ ...admin, vehicleId: 'veh1' })
    expect(exported[0]).toHaveProperty('车牌号', '沪A·8899')
  })
})

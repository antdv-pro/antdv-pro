import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dispatchApprovalBusinessCallback } from './approval-callback-dispatcher'
import {
  calculateValidMonths,
  changeRegulatoryFeeManualStatus,
  createRegulatoryFee,
  deleteRegulatoryFee,
  getRegulatoryFee,
  importRegulatoryFees,
  isDuplicateFeeName,
  listRegulatoryFeeOverview,
  listRegulatoryFees,
  resolveQueryDateRange,
  submitRegulatoryFeeApproval,
  summarizeRegulatoryFees,
  updateRegulatoryFee,
} from './regulatory-fee-store'

const mocks = vi.hoisted(() => ({ submit: vi.fn(), writeFileSync: vi.fn(), mkdirSync: vi.fn() }))
vi.mock('node:fs', () => ({ existsSync: () => false, readFileSync: vi.fn(), writeFileSync: mocks.writeFileSync, mkdirSync: mocks.mkdirSync }))
vi.mock('./mysql', () => ({ getMysqlPool: () => undefined, isDatabaseRequired: () => false }))
vi.mock('./approval-store', () => ({ approvalStore: { submit: mocks.submit } }))

function payload(overrides: Record<string, any> = {}) {
  return {
    feeName: `测试规费-${Date.now()}-${Math.random()}`,
    feeType: '保险费',
    plateNo: '青A.1234',
    totalAmount: 1200,
    validStartDate: '2026-07-01',
    validEndDate: '2027-06-30',
    ...overrides,
  }
}

describe('regulatory fee store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.submit.mockResolvedValue({ instance: { id: 'APV-FEE', code: 'APV001' } })
  })

  it('validates amounts and validity dates at runtime', async () => {
    await expect(createRegulatoryFee(payload({ feeType: '' }))).rejects.toThrow('规费类型不能为空')
    await expect(createRegulatoryFee(payload({ plateNo: '' }))).rejects.toThrow('车号不能为空')
    await expect(createRegulatoryFee(payload({ totalAmount: Number.NaN }))).rejects.toThrow('有效的非负数')
    await expect(createRegulatoryFee(payload({ totalAmount: -1 }))).rejects.toThrow('有效的非负数')
    await expect(createRegulatoryFee(payload({ validStartDate: 'invalid' }))).rejects.toThrow('日期格式不合法')
    await expect(createRegulatoryFee(payload({ validStartDate: '2027-01-01', validEndDate: '2026-01-01' }))).rejects.toThrow('截止日期不能早于开始日期')
  })

  it('creates normalized records with calculated monthly amortization', async () => {
    const input = payload({ totalAmount: 1200, validStartDate: '2026-01-01', validEndDate: '2026-12-31', area: ' 青海 ' })
    const record = await createRegulatoryFee(input)
    expect(record).toMatchObject({ plateNo: '青A·1234', area: '青海', validMonths: 12, monthlyAmortizedAmount: 100, approvalStatus: '草稿' })
    expect(await getRegulatoryFee(record.id)).toMatchObject({ id: record.id })
    expect(await isDuplicateFeeName(input.feeName)).toBe(true)
    expect(await isDuplicateFeeName(input.feeName, record.id)).toBe(false)
  })

  it('calculates inclusive validity terms instead of touched calendar months', () => {
    expect(calculateValidMonths('2025-07-23', '2026-07-22')).toBe(12)
    expect(calculateValidMonths('2026-01-01', '2026-12-31')).toBe(12)
    expect(calculateValidMonths('2026-01-15', '2026-02-14')).toBe(1)
    expect(calculateValidMonths('2026-01-15', '2026-02-15')).toBe(2)
  })

  it('imports multiple validated records in one batch', async () => {
    const records = await importRegulatoryFees([
      payload({ feeName: '批量规费-1', feeType: '交强险', plateNo: '青A.10001' }),
      payload({ feeName: '批量规费-2', feeType: 'GPS年费', plateNo: '青A.10002' }),
    ])
    expect(records).toHaveLength(2)
    expect(records.map(item => item.plateNo)).toEqual(['青A·10001', '青A·10002'])
    await Promise.all(records.map(item => deleteRegulatoryFee(item.id)))
  })

  it('rejects duplicates against existing records and within an import batch', async () => {
    const existing = await createRegulatoryFee(payload({ feeName: '重复校验', feeType: '交强险', plateNo: '青A.20001' }))
    await expect(importRegulatoryFees([
      payload({ feeType: '交强险', plateNo: '青A·20001' }),
    ])).rejects.toThrow('已存在')

    const repeated = payload({ feeType: 'GPS年费', plateNo: '青A.20002' })
    await expect(importRegulatoryFees([repeated, { ...repeated, totalAmount: 999 }])).rejects.toThrow('本次文件中重复')

    const list = await listRegulatoryFees({ current: 1, pageSize: 100000 })
    expect(list.records.filter(item => item.plateNo === '青A·20002')).toHaveLength(0)
    await deleteRegulatoryFee(existing.id)
  })

  it('updates mutable drafts and blocks confirmed records', async () => {
    const record = await createRegulatoryFee(payload())
    const updated = await updateRegulatoryFee(record.id, payload({ feeName: record.feeName, totalAmount: 2400 }))
    expect(updated.totalAmount).toBe(2400)
    const raw = (globalThis as any).__regulatoryFeeStore.find((item: any) => item.id === record.id)
    raw.approvalStatus = '已确认'
    await expect(updateRegulatoryFee(record.id, payload())).rejects.toThrow('已确认')
    await expect(deleteRegulatoryFee(record.id)).rejects.toThrow('已确认')
  })

  it('validates manual status and derives disabled status', async () => {
    const record = await createRegulatoryFee(payload())
    await expect(changeRegulatoryFeeManualStatus(record.id, 'bad' as any)).rejects.toThrow('手工状态不合法')
    await expect(changeRegulatoryFeeManualStatus(record.id, 'disabled')).resolves.toMatchObject({ manualStatus: 'disabled', status: '停用' })
    await expect(changeRegulatoryFeeManualStatus(record.id, 'enabled')).resolves.toMatchObject({ manualStatus: 'enabled' })
    await deleteRegulatoryFee(record.id)
    expect(await getRegulatoryFee(record.id)).toBeUndefined()
  })

  it('awaits approval creation and applies approval callbacks', async () => {
    const record = await createRegulatoryFee(payload({ totalAmount: 500 }))
    const submitted = await submitRegulatoryFeeApproval(record.id, { userId: 7, userName: '申请人', deptId: 'D1', deptName: '运输部' })
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ businessType: 'transport_fee', businessId: String(record.id), amount: 500 }))
    expect(submitted).toMatchObject({ approvalStatus: '审批中', approvalInstanceId: 'APV-FEE' })
    await expect(submitRegulatoryFeeApproval(record.id)).rejects.toThrow('已提交审批')
    await dispatchApprovalBusinessCallback('approved', {
      id: 'APV-FEE',
      code: 'APV-FEE',
      businessType: 'transport_fee',
      businessId: String(record.id),
      businessNo: record.code,
      title: record.feeName,
      applicantName: '申请人',
      amount: 500,
      submittedAt: '2026-07-17T00:00:00.000Z',
      formSnapshot: { supplierName: '规费供应商' },
    } as any)
    expect(await getRegulatoryFee(record.id)).toMatchObject({ approvalStatus: '已确认', approvedAt: expect.any(String) })
  })

  it('filters, paginates and summarizes active records', async () => {
    const first = await createRegulatoryFee(payload({ feeType: '测试分类', totalAmount: 1200, validStartDate: '2026-01-01', validEndDate: '2026-12-31' }))
    const list = await listRegulatoryFees({ feeType: '测试分类', current: 1, pageSize: 1 })
    expect(list.records).toHaveLength(1)
    expect(list.total).toBeGreaterThanOrEqual(1)
    const summary = await summarizeRegulatoryFees({ feeType: '测试分类', startDate: '2026-01-01', endDate: '2027-01-01' })
    expect(summary.totalAmount).toBeGreaterThanOrEqual(1200)
    expect(summary.typeAmounts[0]).toMatchObject({ feeType: '测试分类' })
    await deleteRegulatoryFee(first.id)
  })

  it('excludes pending, expired and disabled fees from active summaries', async () => {
    const active = await createRegulatoryFee(payload({ feeType: '生效统计', validStartDate: '2026-01-01', validEndDate: '2026-12-31' }))
    const pending = await createRegulatoryFee(payload({ feeType: '生效统计', plateNo: '青A.40002', validStartDate: '2027-01-01', validEndDate: '2027-12-31' }))
    const disabled = await createRegulatoryFee(payload({ feeType: '生效统计', plateNo: '青A.40003', validStartDate: '2026-01-01', validEndDate: '2026-12-31' }))
    await changeRegulatoryFeeManualStatus(disabled.id, 'disabled')
    const summary = await summarizeRegulatoryFees({ feeType: '生效统计', financialYear: 2026, financialMonth: 7 })
    expect(summary.totalCount).toBe(1)
    expect(summary.activeCount).toBe(1)
    expect(summary.totalAmount).toBe(100)
    await Promise.all([active, pending, disabled].map(item => deleteRegulatoryFee(item.id).catch(() => undefined)))
  })

  it('filters main and trailer plates independently', async () => {
    const record = await createRegulatoryFee(payload({ plateNo: '青A.30001', trailerNo: '青A.9001挂' }))
    expect((await listRegulatoryFees({ plateNo: '30001' })).records).toContainEqual(expect.objectContaining({ id: record.id }))
    expect((await listRegulatoryFees({ plateNo: '9001' })).records).not.toContainEqual(expect.objectContaining({ id: record.id }))
    expect((await listRegulatoryFees({ trailerNo: '9001' })).records).toContainEqual(expect.objectContaining({ id: record.id }))
    await deleteRegulatoryFee(record.id)
  })

  it('allocates fees by financial months split on the 26th', async () => {
    const record = await createRegulatoryFee(payload({
      feeType: '财务月平摊测试',
      totalAmount: 1200,
      validStartDate: '2026-06-26',
      validEndDate: '2027-06-25',
    }))
    const july = await summarizeRegulatoryFees({ feeType: '财务月平摊测试', financialYear: 2026, financialMonth: 7 })
    const june = await summarizeRegulatoryFees({ feeType: '财务月平摊测试', financialYear: 2026, financialMonth: 6 })
    expect(july.totalAmount).toBe(100)
    expect(june.totalAmount).toBe(0)
    await deleteRegulatoryFee(record.id)
  })

  it('builds vehicle overview and normalizes plate separators', async () => {
    const record = await createRegulatoryFee(payload({ feeName: '交强险', plateNo: '青A.7788', area: '青海', validEndDate: '2027-06-30' }))
    const overview = await listRegulatoryFeeOverview({ plateNo: '青A·7788' })
    expect(overview.records).toEqual([expect.objectContaining({ plateNo: '青A·7788', trafficInsurance: '2027-06-30' })])
    await deleteRegulatoryFee(record.id)
  })

  it('resolves custom, financial-month and financial-year right-open ranges', () => {
    expect(resolveQueryDateRange({ startDate: '2026-01-01', endDate: '2026-02-01' })).toEqual({ startDate: '2026-01-01', endDate: '2026-02-01' })
    expect(resolveQueryDateRange({ financialYear: 2026, financialMonth: 1 })).toEqual({ startDate: '2025-12-26', endDate: '2026-01-26' })
    expect(resolveQueryDateRange({ financialYear: 2026 })).toEqual({ startDate: '2025-12-26', endDate: '2026-12-26' })
  })
})

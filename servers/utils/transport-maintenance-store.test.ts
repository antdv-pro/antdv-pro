import { describe, expect, it } from 'vitest'
import { normalizeMaintenanceRecord } from './transport-maintenance-store'

describe('transport maintenance record normalization', () => {
  it('normalizes a server-authoritative maintenance record', () => {
    expect(normalizeMaintenanceRecord({
      repairDate: '2026-07-24',
      financialMonth: '2026-07',
      plateNo: '青 H 12345',
      project: '轮胎更换',
      amount: 800,
      status: '待审核',
      permissions: { edit: true },
    }, { id: 12, createdBy: 7 })).toMatchObject({
      id: 12,
      repairDate: '2026-07-24',
      financialMonth: '202607',
      plateNo: '青H12345',
      project: '轮胎更换',
      amount: 800,
      createdBy: 7,
    })
  })

  it('rejects invalid dates and incomplete records', () => {
    expect(() => normalizeMaintenanceRecord({ repairDate: '2026-02-30', plateNo: '青H12345', project: '保养' }, { id: 1 })).toThrow('日期格式无效')
    expect(() => normalizeMaintenanceRecord({ repairDate: '2026-07-24', plateNo: '', project: '保养' }, { id: 1 })).toThrow('车牌号不能为空')
    expect(() => normalizeMaintenanceRecord({ repairDate: '2026-07-24', plateNo: '青H12345', project: '' }, { id: 1 })).toThrow('维修项目不能为空')
  })
})

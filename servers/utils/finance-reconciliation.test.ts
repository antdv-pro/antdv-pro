import { beforeEach, describe, expect, it, vi } from 'vitest'

import { approvalStore } from './approval-store'
import { inspectFinanceReconciliation, reconcileApprovedFinanceRecords } from './finance-reconciliation'
import { oaModuleStore } from './oa-module-store'

vi.mock('./mysql', () => ({ getMysqlPool: () => undefined, isDatabaseRequired: () => false, withMysqlTransaction: (_pool: any, handler: any) => handler({}) }))

describe('finance reconciliation', () => {
  beforeEach(async () => {
    await approvalStore.resetForTest()
    await oaModuleStore.replaceState({})
  })

  it('finds and idempotently repairs approved finance approvals', async () => {
    const instance = await approvalStore.submit({
      businessType: 'expense',
      businessId: 'expense-backfill',
      businessNo: 'EXP-BACKFILL',
      title: '历史费用',
      applicantId: 1,
      applicantName: '管理员',
      amount: 800,
      formData: { supplierName: '供应商' },
    })
    await approvalStore.applyExternalStatus(instance.instance.id, 'APPROVED', 'test', 'approved')
    await oaModuleStore.replaceState({})

    await expect(inspectFinanceReconciliation()).resolves.toMatchObject({ missingCount: 1 })
    await expect(reconcileApprovedFinanceRecords()).resolves.toMatchObject({ repairedCount: 1, missingCount: 0 })
    await expect(reconcileApprovedFinanceRecords()).resolves.toMatchObject({ repairedCount: 0, missingCount: 0 })
    expect((await oaModuleStore.getState()).modules.receivable).toEqual([
      expect.objectContaining({ billType: '应付', sourceApprovalId: instance.instance.id, amount: 800 }),
    ])
  })
})

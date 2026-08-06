import { describe, expect, it } from 'vitest'
import { mergeOaStructuredRecord, oaStructuredRecordConfigs, toOaExtensionRecord } from './oa-structured-record'

describe('oA structured record compatibility', () => {
  it('stores only fields without dedicated columns in extension JSON', () => {
    expect(toOaExtensionRecord({ id: 'ar-1', amount: 20, status: '未收', sourceApprovalId: 'approval-1' }, oaStructuredRecordConfigs.receivable))
      .toEqual({ sourceApprovalId: 'approval-1' })
  })

  it('lets structured columns override stale extension values', () => {
    const row = mergeOaStructuredRecord(
      { amount: 1, sourceApprovalId: 'approval-1' },
      { id: 'ar-1', record_json: {}, amount: '20.50', bill_date: '2026-07-18T00:00:00.000Z', status: '未收' },
      oaStructuredRecordConfigs.receivable,
    )
    expect(row).toMatchObject({ id: 'ar-1', amount: 20.5, date: '2026-07-18', status: '未收', sourceApprovalId: 'approval-1' })
  })

  it('preserves cash-balance snake case contracts', () => {
    const row = mergeOaStructuredRecord({}, { id: 'cb-1', balance_amount: '99.5', balance_date: '2026-07-18' }, oaStructuredRecordConfigs.cashBalance)
    expect(row).toMatchObject({ id: 'cb-1', balance_amount: 99.5, balance_date: '2026-07-18' })
  })

  it('maps salary approval_status to the page status contract', () => {
    const row = mergeOaStructuredRecord({ status: '草稿' }, { approval_status: '审批通过' }, oaStructuredRecordConfigs.salary)
    expect(row.status).toBe('审批通过')
    expect(toOaExtensionRecord({ status: '审批通过', employeeName: '员工' }, oaStructuredRecordConfigs.salary)).toEqual({})
  })
})

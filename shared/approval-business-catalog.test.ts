import { describe, expect, it } from 'vitest'
import { APPROVAL_BUSINESS_CATALOG, APPROVAL_FINANCE_POLICY_MAP, approvalFinancePolicy, approvalInitiationSource, approvalOaModuleKey, inferApprovalBusinessType, requiredWecomDirection } from './approval-business-catalog'

describe('approval initiation policy', () => {
  it.each([
    ['expense', 'dashboard'],
    ['payment', 'receivable'],
    ['receivable', 'receivable'],
    ['receipt', 'receivable'],
    ['cash_expense', 'cash'],
    ['salary', 'salary'],
    ['attendance_adjustment', 'salary'],
    ['leave', 'salary'],
    ['overtime', 'salary'],
    ['travel', 'salary'],
    ['hr_change', 'org'],
    ['office_vehicle_expense', 'vehicle'],
  ])('routes %s results to the %s OA module', (businessType, moduleKey) => {
    expect(approvalOaModuleKey(businessType)).toBe(moduleKey)
  })

  it.each(['leave', 'overtime', 'travel', 'attendance_adjustment', 'hr_change', 'transport_fuel', 'transport_etc', 'transport_maintenance', 'transport_fee', 'vehicle_loan', 'purchase', 'payment', 'receivable', 'receipt', 'cash_expense', 'expense', 'salary', 'asset_purchase'])('routes %s from WeCom into the management system', (businessType) => {
    expect(approvalInitiationSource(businessType)).toBe('WECOM')
    expect(requiredWecomDirection(businessType)).toBe('WECOM_TO_CENTER')
  })

  it.each([
    ['酒店6月份员工工资', 'salary'],
    ['车辆保险规费审批', 'transport_fee'],
    ['驾驶员请假申请', 'leave'],
    ['ETC通行费报销', 'transport_etc'],
    ['供应商付款申请', 'payment'],
    ['客户运输费应收确认', 'receivable'],
  ])('infers %s as %s', (text, businessType) => {
    expect(inferApprovalBusinessType(text)).toBe(businessType)
  })

  it.each([
    ['transport_fuel', 'OUT', 'CREATE_PAYABLE', 'receivable'],
    ['vehicle_loan', 'OUT', 'CREATE_PAYABLE', 'receivable'],
    ['expense', 'OUT', 'CREATE_PAYABLE', 'receivable'],
    ['salary', 'OUT', 'CREATE_PAYABLE', 'receivable'],
    ['payment', 'OUT', 'REQUEST_PAYMENT', 'receivable'],
    ['receivable', 'IN', 'CREATE_RECEIVABLE', 'receivable'],
    ['cash_expense', 'OUT', 'REGISTER_CASH_EXPENSE', 'cash'],
    ['receipt', 'IN', 'REGISTER_RECEIPT', 'cash'],
    ['contract', 'NONE', 'NONE', 'none'],
  ])('maps %s to its finance policy', (businessType, direction, action, targetModule) => {
    expect(approvalFinancePolicy(businessType)).toMatchObject({ direction, action, targetModule })
  })

  it('defines an explicit finance policy for every approval type', () => {
    for (const item of APPROVAL_BUSINESS_CATALOG)
      expect(APPROVAL_FINANCE_POLICY_MAP).toHaveProperty(item.businessType)
  })
})

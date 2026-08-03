import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { buildExpiryWarnings, classifyRegulatoryFee } from './expiry-warnings'

describe('expiry warning aggregation', () => {
  const today = dayjs('2026-07-27')

  it('classifies regulatory records by business meaning', () => {
    expect(classifyRegulatoryFee({ feeName: '交强险' })).toBe('保险')
    expect(classifyRegulatoryFee({ feeType: '气瓶年审' })).toBe('年检')
    expect(classifyRegulatoryFee({ feeName: '营运证费' })).toBe('证照')
    expect(classifyRegulatoryFee({ feeName: 'GPS年费' })).toBe('规费')
  })

  it('uses licenses and insurances directly without independent reminder records', () => {
    const result = buildExpiryWarnings({
      officeLicenses: [{ id: 'L1', vehicleId: 'V1', plateNo: '青A1', licenseType: '行驶证', expiryDate: '2026-08-01' }],
      officeInsurances: [{ id: 'I1', vehicleId: 'V1', plateNo: '青A1', insuranceType: '交强险', endDate: '2026-08-11' }],
    }, today)

    expect(result.map(item => [item.category, item.title, item.days])).toEqual([
      ['证照', '行驶证', 5],
      ['保险', '交强险', 15],
    ])
  })

  it('keeps the latest renewal and includes overdue records plus the next 30 days', () => {
    const result = buildExpiryWarnings({
      officeLicenses: [
        { id: 'OLD', vehicleId: 'V1', plateNo: '青A1', licenseType: '营运证', expiryDate: '2025-08-01' },
        { id: 'NEW', vehicleId: 'V1', plateNo: '青A1', licenseType: '营运证', expiryDate: '2026-08-10' },
      ],
      regulatoryFees: [
        { id: 1, plateNo: '青A2', feeName: 'GPS年费', feeType: '其他规费', validEndDate: '2026-07-20', manualStatus: 'enabled' },
        { id: 2, plateNo: '青A3', feeName: '交强险', feeType: '保险费', validEndDate: '2026-09-01', manualStatus: 'enabled' },
      ],
    }, today)

    expect(result.map(item => item.key)).toEqual(['regulatory-fee-1', 'office-license-NEW'])
    expect(result[0].days).toBe(-7)
  })

  it('includes transport vehicle insurance and inspection dates', () => {
    const result = buildExpiryWarnings({
      transportVehicles: [{ code: '青A4', insuranceExpireDate: '2026-08-02', inspectionExpireDate: '2026-08-03' }],
    }, today)
    expect(result.map(item => item.category)).toEqual(['保险', '年检'])
    expect(result.every(item => item.route === '/transport/base-data')).toBe(true)
  })

  it('includes the next unpaid vehicle-loan installment and unsettled receivables or payables', () => {
    const result = buildExpiryWarnings({
      vehicleLoans: [{
        id: 8,
        contractNo: 'LOAN-8',
        plateNo: '青A8',
        firstDueDate: '2026-06-30',
        totalPeriods: 3,
        monthlyPayment: 1000,
        payments: [
          { periodNo: 1, amount: 400 },
          { periodNo: 1, amount: 600 },
        ],
      }],
      receivablePayables: [
        { id: 'AR-1', billType: '应收', counterparty: '客户甲', unpaidAmount: 5000, dueDate: '2026-07-25', status: '部分收款' },
        { id: 'AP-1', billType: '应付', counterparty: '供应商乙', unpaidAmount: 0, dueDate: '2026-07-20', status: '已结清' },
      ],
    }, today)

    expect(result.map(item => [item.category, item.title, item.dueDate])).toEqual([
      ['应收应付', '应收款', '2026-07-25'],
      ['车贷', '第 2 期还款', '2026-07-30'],
    ])
  })
})

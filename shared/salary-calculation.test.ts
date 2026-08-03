import { describe, expect, it } from 'vitest'
import { calculateCumulativeTax, calculateSalary } from './salary-calculation'

describe('salary calculation', () => {
  it('calculates attendance, payable salary, social insurance and net salary', () => {
    const result = calculateSalary({
      fixedSalary: 6200,
      requiredAttendanceDays: 31,
      actualAttendanceDays: 30,
      bonus: 500,
      subsidy: 300,
      overtimePay: 200,
      socialSecurityBase: 5000,
      financialMonth: 1,
      otherDeduction: 100,
    })
    expect(result.attendanceSalary).toBe(6000)
    expect(result.grossSalary).toBe(7000)
    expect(result.personalSocialSecurityTotal).toBe(435)
    expect(result.companySocialSecurityTotal).toBe(1198.75)
    expect(result.tax).toBe(46.95)
    expect(result.netSalary).toBe(6418.05)
  })

  it('uses the official cumulative withholding brackets', () => {
    expect(calculateCumulativeTax(36000)).toBe(1080)
    expect(calculateCumulativeTax(100000)).toBe(7480)
  })

  it('includes seniority salary separately from travel subsidy and recalculates social insurance', () => {
    const result = calculateSalary({
      fixedSalary: 7500,
      requiredAttendanceDays: 31,
      actualAttendanceDays: 31,
      senioritySalary: 500,
      subsidy: 400,
      socialSecurityBase: 5000,
      financialMonth: 1,
    })

    expect(result.grossSalary).toBe(8400)
    expect(result.companySocialSecurityTotal).toBe(1198.75)
    expect(result.personalSocialSecurityTotal).toBe(435)
  })
})

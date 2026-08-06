export interface SalaryCalculationRecord extends Record<string, any> {}

const taxBrackets = [
  { limit: 36000, rate: 0.03, quickDeduction: 0 },
  { limit: 144000, rate: 0.1, quickDeduction: 2520 },
  { limit: 300000, rate: 0.2, quickDeduction: 16920 },
  { limit: 420000, rate: 0.25, quickDeduction: 31920 },
  { limit: 660000, rate: 0.3, quickDeduction: 52920 },
  { limit: 960000, rate: 0.35, quickDeduction: 85920 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.45, quickDeduction: 181920 },
]

function amount(value: unknown) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number : 0
}

function round(value: number) {
  return Number(value.toFixed(2))
}

export function calculateCumulativeTax(taxableIncome: number) {
  if (taxableIncome <= 0)
    return 0
  const bracket = taxBrackets.find(item => taxableIncome <= item.limit)!
  return round(Math.max(0, taxableIncome * bracket.rate - bracket.quickDeduction))
}

export function calculateSalary(record: SalaryCalculationRecord) {
  const requiredDays = Math.min(31, Math.max(0, amount(record.requiredAttendanceDays || 31)))
  const actualDays = Math.min(requiredDays, Math.max(0, amount(record.actualAttendanceDays ?? record.attendanceDays ?? requiredDays)))
  const fixedSalary = amount(record.fixedSalary) || amount(record.basicSalary) + amount(record.performanceSalary)
  const senioritySalary = amount(record.senioritySalary)
  const subsidy = amount(record.subsidy) || amount(record.travelAllowance)
  const bonus = amount(record.bonus) || amount(record.retroactiveSalary)
  const overtimePay = amount(record.overtimePay) || amount(record.overtimeAllowance)
  const otherDeduction = amount(record.otherDeduction)

  record.fixedSalary = round(fixedSalary)
  record.requiredAttendanceDays = requiredDays
  record.actualAttendanceDays = actualDays
  record.attendanceDays = actualDays
  record.attendanceSalary = round(fixedSalary / Math.max(requiredDays, 1) * actualDays)
  record.senioritySalary = round(senioritySalary)
  record.subsidy = round(subsidy)
  record.bonus = round(bonus)
  record.overtimePay = round(overtimePay)
  record.grossSalary = round(record.attendanceSalary + senioritySalary + bonus + subsidy + overtimePay)
  record.totalAmount = record.grossSalary

  const fallbackBase = amount(record.socialSecurityBase)
  const pensionBase = amount(record.pensionBase) || fallbackBase
  const medicalBase = amount(record.medicalBase) || fallbackBase
  const injuryBase = amount(record.injuryBase) || fallbackBase
  const unemploymentBase = amount(record.unemploymentBase) || fallbackBase
  record.companyPension = round(pensionBase * 0.16)
  record.companyMedical = round(medicalBase * 0.069)
  record.companyInjury = round(injuryBase * 0.00575)
  record.companyUnemployment = round(unemploymentBase * 0.005)
  record.companySocialSecurityTotal = round(record.companyPension + record.companyMedical + record.companyInjury + record.companyUnemployment)
  record.personalPension = round(pensionBase * 0.08)
  record.personalMedical = round(medicalBase * 0.002)
  record.personalInjury = 0
  record.personalUnemployment = round(unemploymentBase * 0.005)
  record.personalSocialSecurityTotal = round(record.personalPension + record.personalMedical + record.personalUnemployment)

  // 公积金已从工资规则中取消，保留字段仅用于兼容历史记录。
  record.companyHousingFund = 0
  record.personalHousingFund = 0

  const financialMonth = Math.min(12, Math.max(1, amount(record.financialMonth) || new Date().getMonth() + 1))
  const currentTaxableIncome = Math.max(0, record.grossSalary
    - record.personalSocialSecurityTotal
    - amount(record.specialAdditionalDeduction)
    - amount(record.otherPreTaxDeduction)
    - 5000)
  record.currentTaxableIncome = round(currentTaxableIncome)
  record.cumulativeIncome = round(amount(record.cumulativePriorIncome) + record.grossSalary)
  record.cumulativeTaxableIncome = round(Math.max(0, record.cumulativeIncome
  - 5000 * financialMonth
  - amount(record.cumulativePriorSocialFund)
  - record.personalSocialSecurityTotal
  - amount(record.cumulativeSpecialAdditionalDeduction)
  - amount(record.specialAdditionalDeduction)
  - amount(record.cumulativeOtherPreTaxDeduction)
  - amount(record.otherPreTaxDeduction)))
  record.cumulativeTaxPayable = calculateCumulativeTax(record.cumulativeTaxableIncome)
  record.tax = round(Math.max(0, record.cumulativeTaxPayable - amount(record.cumulativeTaxPaid)))
  record.otherDeduction = round(otherDeduction)
  record.netSalary = round(record.grossSalary - record.personalSocialSecurityTotal - record.tax - otherDeduction)
  record.attendanceStatus = actualDays >= requiredDays ? '已完成' : '待补录'
  record.calculatedAt = new Date().toISOString()
  return record
}

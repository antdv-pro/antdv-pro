import dayjs from 'dayjs'

export type ExpiryWarningCategory = '证照' | '保险' | '年检' | '规费' | '车贷' | '应收应付'
export type ExpiryWarningSourceType = 'office-license' | 'office-insurance' | 'regulatory-fee' | 'transport-vehicle' | 'vehicle-loan' | 'receivable-payable'

export interface ExpiryWarningItem {
  key: string
  recordId: string | number
  sourceType: ExpiryWarningSourceType
  source: string
  category: ExpiryWarningCategory
  title: string
  target: string
  dueDate: string
  days: number
  route: string
  query: Record<string, string>
}

interface ExpiryWarningSources {
  officeLicenses?: Array<Record<string, any>>
  officeInsurances?: Array<Record<string, any>>
  regulatoryFees?: Array<Record<string, any>>
  transportVehicles?: Array<Record<string, any>>
  vehicleLoans?: Array<Record<string, any>>
  receivablePayables?: Array<Record<string, any>>
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function targetOf(record: Record<string, any>, fallback: string) {
  return text(record.plateNo || record.code || record.trailerNo || record.area) || fallback
}

function latestByKey<T>(records: T[], keyOf: (record: T) => string, dueDateOf: (record: T) => string) {
  const latest = new Map<string, T>()
  records.forEach((record) => {
    const key = keyOf(record)
    const current = latest.get(key)
    if (!current || dueDateOf(record) > dueDateOf(current))
      latest.set(key, record)
  })
  return [...latest.values()]
}

export function classifyRegulatoryFee(record: Record<string, any>): ExpiryWarningCategory {
  const value = `${text(record.feeName)} ${text(record.feeType)}`
  if (/保险|交强险|商业险|责任险/.test(value))
    return '保险'
  if (/年审|年检|检定|检测|校验/.test(value))
    return '年检'
  if (/证|牌照/.test(value))
    return '证照'
  return '规费'
}

export function buildExpiryWarnings(sources: ExpiryWarningSources, today = dayjs(), warningDays = 30): ExpiryWarningItem[] {
  const items: Omit<ExpiryWarningItem, 'days'>[] = []

  latestByKey(
    sources.officeLicenses || [],
    record => `${text(record.vehicleId)}\u0001${text(record.licenseType)}`,
    record => text(record.expiryDate),
  ).forEach((record) => {
    const target = targetOf(record, '办公车辆')
    const title = text(record.licenseType) || '证照'
    items.push({
      key: `office-license-${record.id}`,
      recordId: record.id,
      sourceType: 'office-license',
      source: '办公用车',
      category: '证照',
      title,
      target,
      dueDate: text(record.expiryDate),
      route: '/oa-approval/vehicle',
      query: { plateNo: target, licenseType: title, expirySource: 'license' },
    })
  })

  latestByKey(
    sources.officeInsurances || [],
    record => `${text(record.vehicleId)}\u0001${text(record.insuranceType)}`,
    record => text(record.endDate),
  ).forEach((record) => {
    const target = targetOf(record, '办公车辆')
    const title = text(record.insuranceType) || '车辆保险'
    items.push({
      key: `office-insurance-${record.id}`,
      recordId: record.id,
      sourceType: 'office-insurance',
      source: '办公用车',
      category: '保险',
      title,
      target,
      dueDate: text(record.endDate),
      route: '/oa-approval/vehicle',
      query: { plateNo: target, insuranceType: title, expirySource: 'insurance' },
    })
  })

  latestByKey(
    (sources.regulatoryFees || []).filter(record => record.manualStatus !== 'disabled'),
    record => `${targetOf(record, '运输规费')}\u0001${text(record.feeName || record.feeType)}`,
    record => text(record.validEndDate),
  ).forEach((record) => {
    const target = targetOf(record, '运输规费')
    const title = text(record.feeName || record.feeType) || '其他规费'
    items.push({
      key: `regulatory-fee-${record.id}`,
      recordId: record.id,
      sourceType: 'regulatory-fee',
      source: '规费管理',
      category: classifyRegulatoryFee(record),
      title,
      target,
      dueDate: text(record.validEndDate),
      route: '/transport/fees',
      query: { recordId: text(record.id), plateNo: target, feeType: text(record.feeType || title), tab: 'records' },
    })
  })

  ;(sources.transportVehicles || []).forEach((record, index) => {
    const target = targetOf(record, '运输车辆')
    const recordId = record.id || record.code || record.plateNo || index
    const insuranceDate = text(record.insuranceExpireDate)
    const inspectionDate = text(record.inspectionExpireDate)
    if (insuranceDate) {
      items.push({
        key: `transport-vehicle-insurance-${recordId}`,
        recordId,
        sourceType: 'transport-vehicle',
        source: '运输基础资料',
        category: '保险',
        title: '车辆保险',
        target,
        dueDate: insuranceDate,
        route: '/transport/base-data',
        query: { tab: 'vehicle', plateNo: target, expirySource: 'insurance' },
      })
    }
    if (inspectionDate) {
      items.push({
        key: `transport-vehicle-inspection-${recordId}`,
        recordId,
        sourceType: 'transport-vehicle',
        source: '运输基础资料',
        category: '年检',
        title: '车辆年检',
        target,
        dueDate: inspectionDate,
        route: '/transport/base-data',
        query: { tab: 'vehicle', plateNo: target, expirySource: 'inspection' },
      })
    }
  })

  ;(sources.vehicleLoans || []).forEach((record, index) => {
    const totalPeriods = Math.max(0, Number(record.totalPeriods || 0))
    const firstDueDate = text(record.firstDueDate)
    if (!firstDueDate || totalPeriods === 0)
      return
    const paidAmountByPeriod = (Array.isArray(record.payments) ? record.payments : [])
      .reduce((amounts: Map<number, number>, payment: Record<string, any>) => {
        const periodNo = Number(payment.periodNo)
        amounts.set(periodNo, (amounts.get(periodNo) || 0) + Number(payment.amount || 0))
        return amounts
      }, new Map<number, number>())
    const monthlyPayment = Number(record.monthlyPayment || 0)
    const paidPeriods = new Set([...paidAmountByPeriod.entries()]
      .filter(([, amount]) => amount >= monthlyPayment)
      .map(([periodNo]) => periodNo))
    const nextPeriod = Array.from({ length: totalPeriods }, (_, periodIndex) => periodIndex + 1)
      .find(periodNo => !paidPeriods.has(periodNo))
    if (!nextPeriod)
      return
    const target = targetOf(record, '运输车辆')
    const recordId = record.id || record.contractNo || index
    const dueDate = dayjs(firstDueDate).add(nextPeriod - 1, 'month').format('YYYY-MM-DD')
    items.push({
      key: `vehicle-loan-${recordId}-${nextPeriod}`,
      recordId,
      sourceType: 'vehicle-loan',
      source: '车贷费用',
      category: '车贷',
      title: `第 ${nextPeriod} 期还款`,
      target,
      dueDate,
      route: '/transport/vehicle-loans',
      query: { contractNo: text(record.contractNo), plateNo: target, dueDate },
    })
  })

  ;(sources.receivablePayables || []).forEach((record, index) => {
    if (!text(record.dueDate) || Number(record.unpaidAmount || 0) <= 0 || /已结清|作废|已撤回|已驳回/.test(text(record.status)))
      return
    const billType = text(record.billType) || '应收应付'
    const target = text(record.counterparty) || '往来单位'
    const recordId = record.id || record.code || index
    items.push({
      key: `receivable-payable-${recordId}`,
      recordId,
      sourceType: 'receivable-payable',
      source: '应收应付',
      category: '应收应付',
      title: `${billType}款`,
      target,
      dueDate: text(record.dueDate),
      route: '/oa-approval/receivable-payable',
      query: { recordId: text(recordId), billType },
    })
  })

  const start = today.startOf('day')
  const end = start.add(warningDays, 'day')
  const unique = new Map<string, ExpiryWarningItem>()
  items.forEach((item) => {
    const due = dayjs(item.dueDate).startOf('day')
    if (!due.isValid() || due.isAfter(end, 'day'))
      return
    const warning = { ...item, days: due.diff(start, 'day') }
    const duplicateKey = `${item.category}\u0001${item.title}\u0001${item.target}\u0001${item.dueDate}`
    if (!unique.has(duplicateKey))
      unique.set(duplicateKey, warning)
  })
  return [...unique.values()].sort((a, b) => a.days - b.days || a.category.localeCompare(b.category, 'zh-CN'))
}

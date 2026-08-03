<script setup lang="ts">
import type { Dayjs } from 'dayjs'
import type { ApprovalInstance } from '~@/api/approval'
import type { RegulatoryFeeModel } from '~@/api/transport/fees'
import type { SummaryCardItem } from '~@/components/summary-cards/index.vue'
import { Column, Pie } from '@antv/g2plot'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { getApprovalInstancesApi } from '~@/api/approval'
import { getRegulatoryFeeListApi } from '~@/api/transport/fees'
import BusinessDetailDrawer from '~@/components/business-detail-drawer/index.vue'
import SummaryCards from '~@/components/summary-cards/index.vue'
import { createFinancialMonthOptions, createOccurredFinancialYearOptions, useFinancialPeriodFilter } from '~@/composables/financial-period-filter'
import {
  loadTransportOperationData,
  transportBaseVehicleRows,
  transportDriverPayrollRows,
  transportEtcRows,
  transportFuelRows,
  transportMaintenanceRows,
  transportOperationError,
  transportOperationHydrated,
  transportOperationLoading,
  transportOrderRows,
  transportVehicleLoanRows,
} from '~@/composables/transport-operation-data'
import { createBusinessTableScrollX } from '~@/utils/business-table'
import { createFinancialComparison } from '~@/utils/financial-comparison'
import { getCurrentFinancialMonthRange, getFinancialMonthByDate, parseFinancialMonthKey } from '~@/utils/financialPeriod'
import { calculateTransportFreightExcludingTax, matchesOperationPeriod, matchesOperationQuery, normalizeOperationPlateNo, operationAggregationKey } from '~@/utils/transport-operation'

interface VehicleOperationRecord {
  id: string
  date: string
  financialYear: number
  financialMonth: number
  plateNo: string
  trailerNo: string
  driver: string
  orderCount: number
  totalFreight: number
  taxedFreight: number
  fuelQuantityLiters: number
  fuelQuantityKg: number
  fuelFee: number
  maintenanceFee: number
  etcFee: number
  salaryFee: number
  regulatoryFee: number
  loanFee: number
  managementFee: number
  approvedAmount: number
  usedAmount: number
  remark: string
}

type OperationFeeType = '燃油费' | '维保费' | 'ETC费' | '工资' | '规费' | '车贷' | '管理费'
type ApprovalFeeType = Exclude<OperationFeeType, '管理费'>

interface TransportOrderLine {
  code: string
  date: string
  financialYear: number
  financialMonth: number
  plateNo: string
  driver: string
  routeLine: string
  totalFreight: number
  taxedFreight: number
}

interface VehicleFeeLine {
  code: string
  date: string
  financialYear: number
  financialMonth: number
  plateNo: string
  driver: string
  feeType: OperationFeeType
  quantity?: number
  quantityUnit?: 'L' | 'kg'
  amount: number
  source: string
}

interface ApprovalLine {
  code: string
  date: string
  financialYear: number
  financialMonth: number
  plateNo: string
  driver: string
  businessType: ApprovalFeeType
  approvedAmount: number
  usedAmount: number
  source: string
  status: string
}

const message = useMessage()
const route = useRoute()
const detailOpen = ref(false)
const detailRecord = ref<VehicleOperationRecord>()
const detailFocusField = ref('')
const costDetailOpen = ref(false)
const selectedCostType = ref<OperationFeeType>()
const currentFinancialPeriod = getCurrentFinancialMonthRange()
const initialFinancialYear = Number(route.query.financialYear) || Number(currentFinancialPeriod.key.slice(0, 4))
const initialFinancialMonth = Number(route.query.financialMonth) || Number(currentFinancialPeriod.key.slice(4, 6))
const { model: financialFilter, resetFinancialPeriodFilter } = useFinancialPeriodFilter({ financialYear: initialFinancialYear, financialMonth: initialFinancialMonth })
const loading = ref(false)
const regulatoryFeeRows = ref<RegulatoryFeeModel[]>([])
const approvalInstances = ref<ApprovalInstance[]>([])
const queryModel = reactive({
  plateNo: '',
  driver: '',
})
const appliedQuery = reactive({
  plateNo: '',
  driver: '',
})
const tablePagination = reactive({
  current: 1,
  pageSize: 20,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 辆车`,
})
const approvalBusinessKeySet = computed(() => new Set(approvalInstances.value.map(instance => `${instance.businessType}:${instance.businessId}`)))

const _feeTypes: OperationFeeType[] = ['燃油费', '维保费', 'ETC费', '工资', '规费', '车贷', '管理费']
void _feeTypes

const orderLines = computed<TransportOrderLine[]>(() => transportOrderRows.value
  .map((row) => {
    const range = parseFinancialMonthKey(row.financeMonth) || getFinancialMonthByDate(row.shipDate)
    return {
      code: row.code,
      date: row.shipDate,
      financialYear: Number(range.key.slice(0, 4)),
      financialMonth: Number(range.key.slice(4, 6)),
      plateNo: row.plateNo,
      driver: row.driver,
      routeLine: row.routeLine,
      totalFreight: toNumber(row.freightTotal),
      taxedFreight: toNumber(row.taxedFreight) || calculateTransportFreightExcludingTax(toNumber(row.freightTotal)),
    }
  })
  .filter(row => row.code && row.date && row.plateNo))

const driverByPlateNo = computed(() => {
  const map = new Map<string, string>()
  transportMaintenanceRows.value.forEach((row) => {
    const key = normalizePlateNo(row.plateNo)
    if (key && row.driver)
      map.set(key, row.driver)
  })
  orderLines.value.forEach((row) => {
    const key = normalizePlateNo(row.plateNo)
    if (key && row.driver)
      map.set(key, row.driver)
  })
  return map
})

const feeLines = computed<VehicleFeeLine[]>(() => [
  ...transportFuelRows.value.map((row) => {
    const range = getFinancialMonthByDate(row.date)
    return {
      code: row.code,
      date: row.date,
      financialYear: Number(range.key.slice(0, 4)),
      financialMonth: Number(range.key.slice(4, 6)),
      plateNo: row.plateNo,
      driver: row.driver,
      feeType: '燃油费' as const,
      quantity: toNumber(row.quantity),
      quantityUnit: row.quantityUnit || (/kg|公斤/i.test(row.quantity) ? 'kg' : 'L'),
      amount: toNumber(row.amount),
      source: '加油明细',
    }
  }),
  ...transportEtcRows.value.map((row) => {
    const range = getFinancialMonthByDate(row.updatedAt)
    return {
      code: row.code,
      date: row.updatedAt,
      financialYear: Number(range.key.slice(0, 4)),
      financialMonth: Number(range.key.slice(4, 6)),
      plateNo: row.plateNo,
      driver: resolveDriver(row.plateNo),
      feeType: 'ETC费' as const,
      amount: toNumber(row.amount),
      source: 'ETC费用',
    }
  }),
  ...transportDriverPayrollRows.value.map((row) => {
    const plateNo = resolvePayrollPlateNo(row)
    const range = parseFinancialMonthKey(row.financeMonth || '') || getFinancialMonthByDate(row.updatedAt)
    return {
      code: row.code,
      date: row.updatedAt,
      financialYear: Number(range.key.slice(0, 4)),
      financialMonth: Number(range.key.slice(4, 6)),
      plateNo,
      driver: row.name,
      feeType: '工资' as const,
      amount: toNumber(row.amount),
      source: '司机薪酬',
    }
  }),
  ...transportMaintenanceRows.value.map((row) => {
    const range = parseFinancialMonthKey(row.financialMonth) || getFinancialMonthByDate(row.repairDate)
    return {
      code: `MT-${row.id}`,
      date: row.repairDate,
      financialYear: Number(range.key.slice(0, 4)),
      financialMonth: Number(range.key.slice(4, 6)),
      plateNo: row.plateNo,
      driver: row.driver,
      feeType: '维保费' as const,
      amount: Number(row.amount || 0),
      source: '维保管理',
    }
  }),
  ...buildRegulatoryFeeLines(regulatoryFeeRows.value),
  ...buildLoanFeeLines(),
])

const approvalLines = computed<ApprovalLine[]>(() => {
  const approvalRows: ApprovalLine[] = approvalInstances.value.filter(instance => instance.status === 'APPROVED').flatMap((instance) => {
    const mappedType = mapApprovalBusinessType(instance.businessType)
    if (!mappedType)
      return []
    const snapshot = instance.formSnapshot ?? {}
    const occurredDate = String(snapshot.occurredDate || instance.businessAppliedAt || instance.submittedAt || instance.updatedAt || '')
    const range = getFinancialMonthByDate(occurredDate)
    return [{
      code: instance.code,
      date: occurredDate,
      financialYear: Number(range.key.slice(0, 4)),
      financialMonth: Number(range.key.slice(4, 6)),
      plateNo: String(snapshot.plateNo || ''),
      driver: String(snapshot.driver || resolveDriver(String(snapshot.plateNo || ''))),
      businessType: mappedType,
      approvedAmount: Number(instance.amount || snapshot.amount || 0),
      usedAmount: Number(instance.amount || snapshot.amount || 0),
      source: instance.businessModule || instance.businessType,
      status: instance.status,
    }]
  })

  return [
    ...approvalRows,
    ...transportEtcRows.value
      .filter(row => !approvalBusinessKeySet.value.has(`transport_etc:${row.code}`))
      .filter(row => /已匹配|已入账/.test(row.status))
      .map((row) => {
        const range = getFinancialMonthByDate(row.updatedAt)
        const amount = toNumber(row.amount)
        return {
          code: `AP-${row.code}`,
          date: row.updatedAt,
          financialYear: Number(range.key.slice(0, 4)),
          financialMonth: Number(range.key.slice(4, 6)),
          plateNo: row.plateNo,
          driver: resolveDriver(row.plateNo),
          businessType: 'ETC费' as const,
          approvedAmount: amount,
          usedAmount: amount,
          source: 'ETC费用',
          status: row.status,
        }
      }),
    ...transportDriverPayrollRows.value
      .filter(row => !approvalBusinessKeySet.value.has(`salary:${row.code}`))
      .filter(row => /审批通过|已发放/.test(row.status))
      .map((row) => {
        const range = parseFinancialMonthKey(row.financeMonth || '') || getFinancialMonthByDate(row.updatedAt)
        const amount = toNumber(row.amount)
        const plateNo = resolvePayrollPlateNo(row)
        return {
          code: `AP-${row.code}`,
          date: row.updatedAt,
          financialYear: Number(range.key.slice(0, 4)),
          financialMonth: Number(range.key.slice(4, 6)),
          plateNo,
          driver: row.name,
          businessType: '工资' as const,
          approvedAmount: amount,
          usedAmount: /已发放/.test(row.status) ? amount : 0,
          source: '司机薪酬',
          status: row.status,
        }
      }),
    ...transportMaintenanceRows.value
      .filter(row => !approvalBusinessKeySet.value.has(`transport_maintenance:MT-${row.id}`))
      .filter(row => row.status === '已审核')
      .map((row) => {
        const range = parseFinancialMonthKey(row.financialMonth) || getFinancialMonthByDate(row.repairDate)
        return {
          code: `AP-MT-${row.id}`,
          date: row.repairDate,
          financialYear: Number(range.key.slice(0, 4)),
          financialMonth: Number(range.key.slice(4, 6)),
          plateNo: row.plateNo,
          driver: row.driver,
          businessType: '维保费' as const,
          approvedAmount: Number(row.amount || 0),
          usedAmount: Number(row.amount || 0),
          source: '维保管理',
          status: row.status,
        }
      }),
    ...buildRegulatoryFeeApprovals(regulatoryFeeRows.value),
    ...buildLoanApprovals(),
  ]
})

function normalizePlateNo(value: unknown) {
  return normalizeOperationPlateNo(value)
}

const baseVehicleMap = computed(() => {
  const vehicles = new Map<string, { plateNo: string, trailerNo: string }>()
  transportBaseVehicleRows.value.forEach((row) => {
    const plateNo = String(row.plateNo || row.code || '').trim()
    const key = normalizePlateNo(plateNo)
    if (key)
      vehicles.set(key, { plateNo, trailerNo: String(row.trailerNo || '').trim() })
  })
  // 兼容旧数据：基础车辆未建档时，运营汇总仍保留已录入订单的真实车牌。
  transportOrderRows.value.forEach((row) => {
    const plateNo = String(row.plateNo || '').trim()
    const key = normalizePlateNo(plateNo)
    if (key && !vehicles.has(key))
      vehicles.set(key, { plateNo, trailerNo: String(row.trailerNo || '').trim() })
  })
  return vehicles
})

const operationRows = computed<VehicleOperationRecord[]>(() => {
  const builtRows = buildOperationRows(orderLines.value, feeLines.value, approvalLines.value)
    .filter(row => baseVehicleMap.value.has(normalizePlateNo(row.plateNo)))
    .map((row) => {
      const vehicle = baseVehicleMap.value.get(normalizePlateNo(row.plateNo))!
      return { ...row, plateNo: vehicle.plateNo, trailerNo: vehicle.trailerNo }
    })
  const rowsByPeriodAndPlate = new Map(builtRows.map(row => [operationRowKey(row), row]))
  const year = financialFilter.financialYear || dayjs().year()
  const month = financialFilter.financialMonth || (dayjs().month() + 1)
  baseVehicleMap.value.forEach((vehicle, key) => {
    const rowKey = `${year}-${month}-${key}`
    if (rowsByPeriodAndPlate.has(rowKey))
      return
    rowsByPeriodAndPlate.set(rowKey, {
      id: `vehicle-${key}`,
      date: '',
      financialYear: year,
      financialMonth: month,
      plateNo: vehicle.plateNo,
      trailerNo: vehicle.trailerNo,
      driver: '',
      orderCount: 0,
      totalFreight: 0,
      taxedFreight: 0,
      fuelQuantityLiters: 0,
      fuelQuantityKg: 0,
      fuelFee: 0,
      maintenanceFee: 0,
      etcFee: 0,
      salaryFee: 0,
      regulatoryFee: 0,
      loanFee: 0,
      managementFee: 0,
      approvedAmount: 0,
      usedAmount: 0,
      remark: '基础资料车辆，当前筛选范围内暂无运营记录',
    })
  })
  return [...rowsByPeriodAndPlate.values()]
})
const availableMonthKeys = computed(() => [...new Set(operationRows.value.map(row => `${row.financialYear}${String(row.financialMonth).padStart(2, '0')}`))].sort())
const operationYearOptions = computed(() => createOccurredFinancialYearOptions(availableMonthKeys.value))
const operationMonthOptions = computed(() => createFinancialMonthOptions(financialFilter.financialYear, availableMonthKeys.value))
watch(() => financialFilter.financialYear, () => {
  if (financialFilter.financialMonth && !operationMonthOptions.value.some(item => item.value === financialFilter.financialMonth))
    financialFilter.financialMonth = undefined
})
function updateOperationDateRange(value?: [string, string] | [Dayjs, Dayjs] | null) {
  if (!value) {
    financialFilter.dateRange = null
    return
  }
  financialFilter.dateRange = [
    typeof value[0] === 'string' ? dayjs(value[0]) : value[0],
    typeof value[1] === 'string' ? dayjs(value[1]) : value[1],
  ]
}

function aggregateOperationRows(rows: VehicleOperationRecord[]) {
  const grouped = new Map<string, VehicleOperationRecord>()
  rows.forEach((row) => {
    const key = normalizePlateNo(row.plateNo)
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...row })
      return
    }
    existing.orderCount += row.orderCount
    existing.totalFreight += row.totalFreight
    existing.taxedFreight += row.taxedFreight
    existing.fuelQuantityLiters += row.fuelQuantityLiters
    existing.fuelQuantityKg += row.fuelQuantityKg
    existing.fuelFee += row.fuelFee
    existing.maintenanceFee += row.maintenanceFee
    existing.etcFee += row.etcFee
    existing.salaryFee += row.salaryFee
    existing.regulatoryFee += row.regulatoryFee
    existing.loanFee += row.loanFee
    existing.managementFee += row.managementFee
    existing.approvedAmount += row.approvedAmount
    existing.usedAmount += row.usedAmount
    if (dayjs(row.date).isAfter(dayjs(existing.date), 'day')) {
      existing.date = row.date
      existing.financialYear = row.financialYear
      existing.financialMonth = row.financialMonth
    }
    if (!existing.driver && row.driver)
      existing.driver = row.driver
  })
  return [...grouped.values()]
}

const filteredRows = computed(() => aggregateOperationRows(operationRows.value.filter(row => matchesCurrentQuery(row))))

const previousMonthRows = computed(() => {
  const currentKey = financialFilter.financialYear && financialFilter.financialMonth
    ? `${financialFilter.financialYear}-${String(financialFilter.financialMonth).padStart(2, '0')}-01`
    : `${currentFinancialPeriod.key.slice(0, 4)}-${currentFinancialPeriod.key.slice(4, 6)}-01`
  const previous = dayjs(currentKey).subtract(1, 'month')
  return aggregateOperationRows(operationRows.value.filter(row =>
    row.financialYear === previous.year()
    && row.financialMonth === previous.month() + 1
    && matchesOperationQuery(row, { plateNo: appliedQuery.plateNo, driver: appliedQuery.driver }),
  ))
})

const operationSummary = computed(() => {
  const rows = filteredRows.value
  const taxedFreight = sum(rows, 'taxedFreight')
  const profit = rows.reduce((total, row) => total + vehicleProfit(row), 0)
  return {
    orderCount: sum(rows, 'orderCount'),
    totalFreight: sum(rows, 'totalFreight'),
    taxedFreight,
    fuelQuantityLiters: sum(rows, 'fuelQuantityLiters'),
    fuelQuantityKg: sum(rows, 'fuelQuantityKg'),
    fuelFee: sum(rows, 'fuelFee'),
    maintenanceFee: sum(rows, 'maintenanceFee'),
    etcFee: sum(rows, 'etcFee'),
    salaryFee: sum(rows, 'salaryFee'),
    regulatoryFee: sum(rows, 'regulatoryFee'),
    loanFee: sum(rows, 'loanFee'),
    managementFee: sum(rows, 'managementFee'),
    totalCost: sumCosts(rows),
    profit,
    profitRate: taxedFreight ? profit / taxedFreight : 0,
  }
})

const summaryCards = computed<SummaryCardItem[]>(() => {
  const cost = sumCosts(filteredRows.value)
  const freight = sum(filteredRows.value, 'totalFreight')
  const taxed = sum(filteredRows.value, 'taxedFreight')
  const previousCost = sumCosts(previousMonthRows.value)
  const previousFreight = sum(previousMonthRows.value, 'totalFreight')
  const previousTaxed = sum(previousMonthRows.value, 'taxedFreight')
  const vehicleCount = new Set(filteredRows.value.filter(row => row.orderCount || vehicleCost(row)).map(row => row.plateNo)).size
  const previousVehicleCount = new Set(previousMonthRows.value.filter(row => row.orderCount || vehicleCost(row)).map(row => row.plateNo)).size
  const orderCount = sum(filteredRows.value, 'orderCount')
  const previousOrderCount = sum(previousMonthRows.value, 'orderCount')
  const profit = taxed - cost
  const previousProfit = previousTaxed - previousCost
  const approved = sum(filteredRows.value, 'approvedAmount')
  const previousApproved = sum(previousMonthRows.value, 'approvedAmount')
  const used = sum(filteredRows.value, 'usedAmount')
  const previousUsed = sum(previousMonthRows.value, 'usedAmount')
  return [
    { label: '运营车辆数', value: vehicleCount, comparison: createFinancialComparison(vehicleCount, previousVehicleCount, `${previousVehicleCount} 辆`), tone: 'primary' },
    { label: '订单数', value: orderCount, comparison: createFinancialComparison(orderCount, previousOrderCount, `${previousOrderCount} 单`), tone: 'default' },
    { label: '总运费', value: money(freight), comparison: createFinancialComparison(freight, previousFreight, money(previousFreight)), tone: 'success' },
    { label: '税后运费', value: money(taxed), comparison: createFinancialComparison(taxed, previousTaxed, money(previousTaxed)), tone: 'success' },
    { label: '总成本', value: money(cost), comparison: createFinancialComparison(cost, previousCost, money(previousCost)), tone: 'danger' },
    { label: '总利润', value: money(profit), comparison: createFinancialComparison(profit, previousProfit, money(previousProfit)), tone: profit >= 0 ? 'success' : 'danger' },
    { label: '审批通过金额', value: money(approved), comparison: createFinancialComparison(approved, previousApproved, money(previousApproved)), tone: 'primary' },
    { label: '已使用金额', value: money(used), comparison: createFinancialComparison(used, previousUsed, money(previousUsed)), tone: 'warning' },
  ]
})

const profitRankingRows = computed(() => {
  const ranked = filteredRows.value
    .filter(row => row.orderCount > 0)
    .map(row => ({ ...row, profit: vehicleProfit(row), cost: vehicleCost(row) }))
    .sort((a, b) => b.profit - a.profit)
  const highest = ranked.slice(0, 5).map(row => ({ ...row, rankGroup: '利润前5' }))
  const highestKeys = new Set(highest.map(row => normalizePlateNo(row.plateNo)))
  const lowest = [...ranked]
    .reverse()
    .filter(row => !highestKeys.has(normalizePlateNo(row.plateNo)))
    .slice(0, 5)
    .map(row => ({ ...row, rankGroup: '利润后5' }))
  return [...highest, ...lowest]
})

const revenueCostChartData = computed(() => profitRankingRows.value.flatMap(row => [
  {
    plateNo: row.plateNo,
    type: '收入',
    amount: Number((row.taxedFreight / 10000).toFixed(2)),
  },
  {
    plateNo: row.plateNo,
    type: '成本',
    amount: Number((row.cost / 10000).toFixed(2)),
  },
  {
    plateNo: row.plateNo,
    type: '利润',
    amount: Number((row.profit / 10000).toFixed(2)),
  },
]))

const costStructureChartData = computed(() => [
  { type: '燃油费', amount: sum(filteredRows.value, 'fuelFee') },
  { type: '维保费', amount: sum(filteredRows.value, 'maintenanceFee') },
  { type: 'ETC费', amount: sum(filteredRows.value, 'etcFee') },
  { type: '工资', amount: sum(filteredRows.value, 'salaryFee') },
  { type: '规费', amount: sum(filteredRows.value, 'regulatoryFee') },
  { type: '车贷', amount: sum(filteredRows.value, 'loanFee') },
  { type: '管理费', amount: sum(filteredRows.value, 'managementFee') },
].map(item => ({
  ...item,
  amount: Number((item.amount / 10000).toFixed(2)),
})).filter(item => item.amount > 0))

const performanceHighlights = computed(() => [
  { label: '营业收入', value: operationSummary.value.taxedFreight, tone: 'revenue', note: '税后运费' },
  { label: '总成本', value: operationSummary.value.totalCost, tone: 'cost', note: '7类费用合计' },
  { label: '总利润', value: operationSummary.value.profit, tone: operationSummary.value.profit >= 0 ? 'profit' : 'loss', note: '收入 - 成本' },
])

const costStructureSummary = computed(() => {
  const total = costStructureChartData.value.reduce((sum, item) => sum + item.amount, 0)
  const items = [...costStructureChartData.value]
    .sort((a, b) => b.amount - a.amount)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      share: total ? item.amount / total : 0,
    }))
  return { total, items, largest: items[0] }
})

const costTypeFieldMap: Record<OperationFeeType, keyof VehicleOperationRecord> = {
  '燃油费': 'fuelFee',
  '维保费': 'maintenanceFee',
  'ETC费': 'etcFee',
  '工资': 'salaryFee',
  '规费': 'regulatoryFee',
  '车贷': 'loanFee',
  '管理费': 'managementFee',
}

const selectedCostVehicleRows = computed(() => {
  if (!selectedCostType.value)
    return []
  const field = costTypeFieldMap[selectedCostType.value]
  return filteredRows.value
    .map(row => ({ ...row, selectedCostAmount: Number(row[field] || 0) }))
    .filter(row => row.selectedCostAmount > 0)
    .sort((a, b) => b.selectedCostAmount - a.selectedCostAmount)
})

const tableColumns = [
  { title: '序号', dataIndex: 'index', width: 72, fixed: 'left' as const, align: 'center' as const },
  { title: '车牌号', dataIndex: 'plateNo', width: 132, fixed: 'left' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => a.plateNo.localeCompare(b.plateNo), ellipsis: true },
  { title: '订单数', dataIndex: 'orderCount', width: 96, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => a.orderCount - b.orderCount },
  { title: '总运费', dataIndex: 'totalFreight', width: 128, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => a.totalFreight - b.totalFreight },
  { title: '税后运费', dataIndex: 'taxedFreight', width: 128, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => a.taxedFreight - b.taxedFreight, defaultSortOrder: 'descend' as const },
  { title: '油料数量', dataIndex: 'fuelQuantity', width: 150, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => (a.fuelQuantityLiters - b.fuelQuantityLiters) || (a.fuelQuantityKg - b.fuelQuantityKg) },
  { title: '油料总价', dataIndex: 'fuelFee', width: 116, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => a.fuelFee - b.fuelFee },
  { title: '维保费', dataIndex: 'maintenanceFee', width: 116, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => a.maintenanceFee - b.maintenanceFee },
  { title: 'ETC费', dataIndex: 'etcFee', width: 116, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => a.etcFee - b.etcFee },
  { title: '工资', dataIndex: 'salaryFee', width: 116, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => a.salaryFee - b.salaryFee },
  { title: '规费', dataIndex: 'regulatoryFee', width: 116, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => a.regulatoryFee - b.regulatoryFee },
  { title: '车贷', dataIndex: 'loanFee', width: 116, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => a.loanFee - b.loanFee },
  { title: '管理费', dataIndex: 'managementFee', width: 116, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => a.managementFee - b.managementFee },
  { title: '总成本', dataIndex: 'totalCost', width: 128, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => vehicleCost(a) - vehicleCost(b) },
  { title: '利润', dataIndex: 'profit', width: 128, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => vehicleProfit(a) - vehicleProfit(b) },
  { title: '利润率', dataIndex: 'profitRate', width: 112, align: 'right' as const, sorter: (a: VehicleOperationRecord, b: VehicleOperationRecord) => vehicleProfitRate(a) - vehicleProfitRate(b) },
  { title: '操作', dataIndex: 'action', width: 88, fixed: 'right' as const, align: 'center' as const },
]

const tableScrollX = computed(() => createBusinessTableScrollX(tableColumns, 1900))
const revenueCostChartContainer = ref<HTMLElement>()
const costStructureChartContainer = ref<HTMLElement>()
const revenueCostChart = shallowRef<Column>()
const costStructureChart = shallowRef<Pie>()
let chartRenderTimer: ReturnType<typeof setTimeout> | undefined

const moneyFields = new Set(['totalFreight', 'taxedFreight', 'fuelFee', 'maintenanceFee', 'etcFee', 'salaryFee', 'regulatoryFee', 'loanFee', 'managementFee', 'totalCost', 'approvedAmount', 'usedAmount', 'unusedAmount', 'profit'])
const operationColumnModuleMap: Record<string, string> = {
  orderCount: '运输订单',
  totalFreight: '运输订单',
  taxedFreight: '运输订单',
  fuelQuantity: '加油明细',
  fuelFee: '加油明细',
  maintenanceFee: '维保管理',
  etcFee: 'ETC费用',
  salaryFee: '工资管理',
  regulatoryFee: '规费管理',
  loanFee: '车贷费用',
  managementFee: '费用管理',
  totalCost: '成本汇总',
  profit: '经营结果',
  profitRate: '经营结果',
}

function buildOperationRows(orders: TransportOrderLine[], fees: VehicleFeeLine[], approvals: ApprovalLine[]) {
  const map = new Map<string, VehicleOperationRecord>()
  const ensureRow = (financialYear: number, financialMonth: number, plateNo: string, driver: string, date: string) => {
    const key = operationAggregationKey({ financialYear, financialMonth, plateNo })
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        date,
        financialYear,
        financialMonth,
        plateNo: String(plateNo || '').trim(),
        trailerNo: '',
        driver,
        orderCount: 0,
        totalFreight: 0,
        taxedFreight: 0,
        fuelQuantityLiters: 0,
        fuelQuantityKg: 0,
        fuelFee: 0,
        maintenanceFee: 0,
        etcFee: 0,
        salaryFee: 0,
        regulatoryFee: 0,
        loanFee: 0,
        managementFee: 0,
        approvedAmount: 0,
        usedAmount: 0,
        remark: '由运输订单、加油、ETC、维保、规费、车贷和司机薪酬聚合生成',
      })
    }
    const row = map.get(key)!
    if (!row.driver && driver)
      row.driver = driver
    if (dayjs(date).isAfter(dayjs(row.date), 'day'))
      row.date = date
    return row
  }

  orders.forEach((order) => {
    const row = ensureRow(order.financialYear, order.financialMonth, order.plateNo, order.driver, order.date)
    row.orderCount += 1
    row.totalFreight += order.totalFreight
    row.taxedFreight += order.taxedFreight
  })

  fees.forEach((fee) => {
    const row = ensureRow(fee.financialYear, fee.financialMonth, fee.plateNo, fee.driver, fee.date)
    if (fee.feeType === '燃油费') {
      if (fee.quantityUnit === 'kg')
        row.fuelQuantityKg += Number(fee.quantity || 0)
      else
        row.fuelQuantityLiters += Number(fee.quantity || 0)
      row.fuelFee += fee.amount
    }
    else if (fee.feeType === '维保费') {
      row.maintenanceFee += fee.amount
    }
    else if (fee.feeType === 'ETC费') {
      row.etcFee += fee.amount
    }
    else if (fee.feeType === '工资') {
      row.salaryFee += fee.amount
    }
    else if (fee.feeType === '规费') {
      row.regulatoryFee += fee.amount
    }
    else if (fee.feeType === '车贷') {
      row.loanFee += fee.amount
    }
    else if (fee.feeType === '管理费') {
      row.managementFee += fee.amount
    }
  })

  approvals.forEach((approval) => {
    const row = ensureRow(approval.financialYear, approval.financialMonth, approval.plateNo, approval.driver, approval.date)
    row.approvedAmount += approval.approvedAmount
    row.usedAmount += approval.usedAmount
  })

  // 管理费按每辆车每个财务月计提；没有运输订单的车辆不计管理费。
  map.forEach((row) => {
    row.managementFee = row.orderCount > 0 ? 3000 : 0
  })

  return Array.from(map.values()).sort((a, b) => `${b.financialYear}${b.financialMonth}${b.plateNo}`.localeCompare(`${a.financialYear}${a.financialMonth}${a.plateNo}`))
}

function sum(list: VehicleOperationRecord[], field: keyof VehicleOperationRecord) {
  return list.reduce((total, row) => total + Number(row[field] || 0), 0)
}

function sumCosts(list: VehicleOperationRecord[]) {
  return list.reduce((total, row) => total + vehicleCost(row), 0)
}

function vehicleCost(row: VehicleOperationRecord) {
  return row.fuelFee + row.maintenanceFee + row.etcFee + row.salaryFee + row.regulatoryFee + row.loanFee + row.managementFee
}

function vehicleProfit(row: VehicleOperationRecord) {
  return row.taxedFreight - vehicleCost(row)
}

function vehicleProfitRate(row: VehicleOperationRecord) {
  return row.taxedFreight ? vehicleProfit(row) / row.taxedFreight : 0
}

function unusedAmount(row: VehicleOperationRecord) {
  return row.approvedAmount - row.usedAmount
}

function money(value: unknown) {
  return `¥${Number(value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatFuelQuantity(liters: unknown, kilograms: unknown) {
  const values = [
    Number(liters || 0) ? `${Number(liters).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}L` : '',
    Number(kilograms || 0) ? `${Number(kilograms).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}kg` : '',
  ].filter(Boolean)
  return values.join(' / ') || '0.00L'
}

function displayCell(row: VehicleOperationRecord, dataIndex: string, index: number) {
  if (dataIndex === 'index')
    return index + 1
  if (dataIndex === 'unusedAmount')
    return money(unusedAmount(row))
  if (dataIndex === 'fuelQuantity')
    return formatFuelQuantity(row.fuelQuantityLiters, row.fuelQuantityKg)
  if (dataIndex === 'totalCost')
    return money(vehicleCost(row))
  if (dataIndex === 'profit')
    return money(vehicleProfit(row))
  if (dataIndex === 'profitRate')
    return `${(vehicleProfitRate(row) * 100).toFixed(2)}%`
  if (moneyFields.has(dataIndex))
    return money(row[dataIndex as keyof VehicleOperationRecord])
  return row[dataIndex as keyof VehicleOperationRecord] ?? '-'
}

function getOperationColumnModule(dataIndex: unknown) {
  return operationColumnModuleMap[String(dataIndex ?? '')] ?? ''
}

function isModuleLinkedColumn(dataIndex: unknown) {
  return Boolean(getOperationColumnModule(dataIndex))
}

function tableCellClass(dataIndex: unknown) {
  const key = String(dataIndex ?? '')
  if (key === 'action')
    return 'table-cell-action'
  if (key === 'index')
    return 'table-cell-number'
  if (moneyFields.has(key) || ['orderCount', 'fuelQuantity', 'profitRate'].includes(key))
    return 'table-cell-money'
  if (/date|time|At|Month|Year/i.test(key))
    return 'table-cell-date'
  return ''
}

function _displayText(value: unknown) {
  const text = value == null || value === '' ? '-' : String(value)
  return text
}
void _displayText

function renderRevenueCostChart() {
  if (!revenueCostChartContainer.value)
    return

  if (!revenueCostChart.value) {
    revenueCostChart.value = new Column(revenueCostChartContainer.value, {
      data: revenueCostChartData.value,
      xField: 'plateNo',
      yField: 'amount',
      seriesField: 'type',
      isGroup: true,
      height: 260,
      columnWidthRatio: 0.42,
      color: ['#1677ff', '#ef4444', '#16a34a'],
      xAxis: {
        label: {
          autoHide: true,
          autoRotate: false,
        },
      },
      yAxis: {
        label: {
          formatter: value => `${value}万`,
        },
        grid: {
          line: {
            style: { stroke: '#edf1f7' },
          },
        },
      },
      legend: {
        position: 'top-right',
      },
      tooltip: {
        formatter: datum => ({ name: datum.type, value: `¥${Number(datum.amount).toFixed(2)}万` }),
      },
    })
    revenueCostChart.value.on('element:click', (event: any) => {
      const datum = event?.data?.data as { plateNo?: string, type?: string } | undefined
      const record = filteredRows.value.find(row => row.plateNo === datum?.plateNo)
      if (!record)
        return
      const focusField = datum?.type === '收入' ? 'taxedFreight' : datum?.type === '成本' ? 'totalCost' : 'profit'
      openDetail(record, focusField)
    })
    revenueCostChart.value.render()
    return
  }

  revenueCostChart.value.changeData(revenueCostChartData.value)
}

function renderCostStructureChart() {
  if (!costStructureChartContainer.value)
    return

  if (!costStructureChart.value) {
    costStructureChart.value = new Pie(costStructureChartContainer.value, {
      data: costStructureChartData.value,
      angleField: 'amount',
      colorField: 'type',
      radius: 0.88,
      innerRadius: 0.62,
      height: 300,
      color: ['#1677ff', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b', '#06b6d4'],
      legend: false,
      label: {
        type: 'outer',
        offset: 14,
        content: datum => `${datum.type}  ¥${Number(datum.amount).toFixed(2)}万`,
        style: { fill: '#475569', fontSize: 12 },
      },
      statistic: { title: false, content: false },
      tooltip: {
        formatter: datum => ({
          name: datum.type,
          value: `¥${Number(datum.amount).toFixed(2)}万 · ${costStructureSummary.value.total ? (Number(datum.amount) / costStructureSummary.value.total * 100).toFixed(1) : '0.0'}%`,
        }),
      },
    })
    costStructureChart.value.on('element:click', (event: any) => {
      const type = event?.data?.data?.type as OperationFeeType | undefined
      if (type)
        openCostDetail(type)
    })
    costStructureChart.value.render()
    return
  }

  costStructureChart.value.changeData(costStructureChartData.value)
}

function renderCharts() {
  if (chartRenderTimer)
    clearTimeout(chartRenderTimer)
  chartRenderTimer = setTimeout(() => nextTick(() => {
    renderRevenueCostChart()
    renderCostStructureChart()
  }), 120)
}

async function ensureOperationDataLoaded() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await loadTransportOperationData()
    if (transportOperationHydrated.value)
      break
    if (attempt < 2)
      await new Promise(resolve => setTimeout(resolve, 600))
  }
}

function asVehicleOperationRecord(record: Record<string, any>) {
  return record as VehicleOperationRecord
}

async function loadRegulatoryFees() {
  loading.value = true
  try {
    const res = await getRegulatoryFeeListApi({ current: 1, pageSize: 100000 })
    regulatoryFeeRows.value = res.data?.records ?? []
  }
  finally {
    loading.value = false
  }
}

async function loadApprovalInstances() {
  const businessTypes = new Set(['transport_fuel', 'transport_etc', 'transport_maintenance', 'transport_fee', 'vehicle_loan', 'salary'])
  const res = await getApprovalInstancesApi({ status: 'APPROVED' })
  approvalInstances.value = (res.data ?? []).filter(instance => businessTypes.has(instance.businessType))
}

function toNumber(value: unknown) {
  const normalized = String(value ?? '').replace(/[^\d.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function resolveDriver(plateNo: string) {
  return driverByPlateNo.value.get(normalizePlateNo(plateNo)) || ''
}

function resolvePayrollPlateNo(row: { plateNo?: string, plateNos?: string, owner?: string }) {
  return String(row.plateNo || row.plateNos || row.owner || '').split(/[/,，]/)[0]?.trim() || ''
}

function operationRowKey(row: Pick<VehicleOperationRecord, 'financialYear' | 'financialMonth' | 'plateNo'>) {
  return `${row.financialYear}-${row.financialMonth}-${normalizePlateNo(row.plateNo)}`
}

function buildRegulatoryFeeLines(records: RegulatoryFeeModel[]) {
  const lines: VehicleFeeLine[] = []
  records.forEach((record) => {
    iterateFeeMonths(record).forEach(({ date, financialYear, financialMonth }) => {
      lines.push({
        code: `REG-${record.id}-${financialYear}${String(financialMonth).padStart(2, '0')}`,
        date,
        financialYear,
        financialMonth,
        plateNo: resolveRegulatoryFeePlateNo(record),
        driver: resolveDriver(resolveRegulatoryFeePlateNo(record)),
        feeType: '规费',
        amount: Number(record.monthlyAmortizedAmount || 0),
        source: '规费管理',
      })
    })
  })
  return lines
}

function buildRegulatoryFeeApprovals(records: RegulatoryFeeModel[]) {
  const lines: ApprovalLine[] = []
  records
    .filter(record => record.approvalStatus === '已确认')
    .forEach((record) => {
      iterateFeeMonths(record).forEach(({ date, financialYear, financialMonth }) => {
        const plateNo = resolveRegulatoryFeePlateNo(record)
        const amount = Number(record.monthlyAmortizedAmount || 0)
        lines.push({
          code: `APR-REG-${record.id}-${financialYear}${String(financialMonth).padStart(2, '0')}`,
          date,
          financialYear,
          financialMonth,
          plateNo,
          driver: resolveDriver(plateNo),
          businessType: '规费',
          approvedAmount: amount,
          usedAmount: amount,
          source: '规费管理',
          status: String(record.approvalStatus || '已确认'),
        })
      })
    })
  return lines
}

function iterateFeeMonths(record: RegulatoryFeeModel) {
  const items: Array<{ date: string, financialYear: number, financialMonth: number }> = []
  const startRange = getFinancialMonthByDate(record.validStartDate)
  const endRange = getFinancialMonthByDate(record.validEndDate)
  for (let cursor = startRange.startAt; !cursor.isAfter(endRange.startAt, 'day'); cursor = cursor.add(1, 'month')) {
    const range = getFinancialMonthByDate(cursor)
    items.push({
      date: cursor.format('YYYY-MM-DD'),
      financialYear: Number(range.key.slice(0, 4)),
      financialMonth: Number(range.key.slice(4, 6)),
    })
  }
  return items
}

function extractPlateNo(text?: string) {
  const matched = String(text ?? '').match(/[A-Z\u4E00-\u9FA5]{0,2}[·.]?[A-Z0-9\u4E00-\u9FA5]{4,6}/)
  return matched?.[0]?.replace('.', '·') || ''
}

function resolveRegulatoryFeePlateNo(record: RegulatoryFeeModel) {
  return String(record.plateNo || '').trim() || extractPlateNo(record.remark)
}

function buildLoanFeeLines() {
  const lines: VehicleFeeLine[] = []
  transportVehicleLoanRows.value.forEach((record) => {
    record.payments.forEach((payment) => {
      const range = getFinancialMonthByDate(payment.paymentDate)
      lines.push({
        code: `LOAN-${record.id}-${payment.periodNo}`,
        date: payment.paymentDate,
        financialYear: Number(range.key.slice(0, 4)),
        financialMonth: Number(range.key.slice(4, 6)),
        plateNo: record.plateNo,
        driver: resolveDriver(record.plateNo),
        feeType: '车贷',
        amount: Number(payment.amount || 0),
        source: '车贷费用',
      })
    })
  })
  return lines
}

function buildLoanApprovals() {
  return transportVehicleLoanRows.value
    .filter(record => !approvalBusinessKeySet.value.has(`vehicle_loan:VL-${record.id}`))
    .flatMap(record =>
      record.payments.map((payment) => {
        const range = getFinancialMonthByDate(payment.paymentDate)
        return {
          code: `APR-LOAN-${record.id}-${payment.periodNo}`,
          date: payment.paymentDate,
          financialYear: Number(range.key.slice(0, 4)),
          financialMonth: Number(range.key.slice(4, 6)),
          plateNo: record.plateNo,
          driver: resolveDriver(record.plateNo),
          businessType: '车贷' as const,
          approvedAmount: Number(payment.amount || 0),
          usedAmount: Number(payment.amount || 0),
          source: '车贷费用',
          status: '已扣款',
        }
      }))
}

function resetQuery() {
  queryModel.plateNo = ''
  queryModel.driver = ''
  appliedQuery.plateNo = ''
  appliedQuery.driver = ''
  tablePagination.current = 1
  resetFinancialPeriodFilter({ financialYear: initialFinancialYear, financialMonth: initialFinancialMonth })
}

function handleQuery() {
  appliedQuery.plateNo = queryModel.plateNo.trim()
  appliedQuery.driver = queryModel.driver.trim()
  tablePagination.current = 1
}

function handleTableChange(pagination: { current?: number, pageSize?: number }) {
  tablePagination.current = Number(pagination.current || 1)
  tablePagination.pageSize = Number(pagination.pageSize || tablePagination.pageSize)
}

function openDetail(record: VehicleOperationRecord, focusField = '') {
  detailRecord.value = record
  detailFocusField.value = focusField
  detailOpen.value = true
}

function openCostDetail(type: OperationFeeType) {
  selectedCostType.value = type
  costDetailOpen.value = true
}

function openCostVehicleDetail(record: VehicleOperationRecord) {
  const type = selectedCostType.value
  costDetailOpen.value = false
  openDetail(record, type ? String(costTypeFieldMap[type]) : 'totalCost')
}

function matchesRecordPeriod(row: { financialYear: number, financialMonth: number, plateNo: string, driver: string }, record: VehicleOperationRecord) {
  return matchesOperationPeriod({ ...row, date: '' }, record)
}

const detailOrderLines = computed(() => detailRecord.value ? orderLines.value.filter(row => matchesRecordPeriod(row, detailRecord.value!)) : [])
const detailFeeLines = computed(() => detailRecord.value ? feeLines.value.filter(row => matchesRecordPeriod(row, detailRecord.value!)) : [])
const detailApprovalLines = computed(() => detailRecord.value ? approvalLines.value.filter(row => matchesRecordPeriod(row, detailRecord.value!)) : [])
const focusedDetailFeeLines = computed(() => {
  if (!detailFocusField.value)
    return detailFeeLines.value
  const feeType = getDetailFocusFeeType(detailFocusField.value)
  return feeType ? detailFeeLines.value.filter(row => row.feeType === feeType) : detailFeeLines.value
})
const shouldShowOrderDetail = computed(() => !detailFocusField.value || ['orderCount', 'totalFreight', 'taxedFreight'].includes(detailFocusField.value))
const shouldShowFeeDetail = computed(() => !detailFocusField.value || ['fuelQuantity', 'fuelFee', 'maintenanceFee', 'etcFee', 'salaryFee', 'regulatoryFee', 'loanFee', 'managementFee', 'totalCost', 'profit', 'profitRate'].includes(detailFocusField.value))
const shouldShowApprovalDetail = computed(() => !detailFocusField.value || ['approvedAmount', 'usedAmount', 'unusedAmount', 'totalCost', 'profit', 'profitRate'].includes(detailFocusField.value))
function getDetailFocusFeeType(field: string): OperationFeeType | undefined {
  const map: Record<string, OperationFeeType> = {
    fuelQuantity: '燃油费',
    fuelFee: '燃油费',
    maintenanceFee: '维保费',
    etcFee: 'ETC费',
    salaryFee: '工资',
    regulatoryFee: '规费',
    loanFee: '车贷',
    managementFee: '管理费',
  }
  return map[field]
}

function matchesCurrentQuery(row: { date: string, financialYear: number, financialMonth: number, plateNo: string, driver: string }) {
  return matchesOperationQuery(row, {
    ...financialFilter,
    plateNo: appliedQuery.plateNo,
    driver: appliedQuery.driver,
  })
}

watch(filteredRows, (rows) => {
  const maxPage = Math.max(1, Math.ceil(rows.length / tablePagination.pageSize))
  if (tablePagination.current > maxPage)
    tablePagination.current = maxPage
})

onMounted(() => {
  void ensureOperationDataLoaded()
  void loadRegulatoryFees()
  void loadApprovalInstances()
})

onActivated(() => {
  void ensureOperationDataLoaded()
})

watch([revenueCostChartData, costStructureChartData], () => {
  renderCharts()
}, { deep: true, immediate: true })

onBeforeUnmount(() => {
  if (chartRenderTimer)
    clearTimeout(chartRenderTimer)
  revenueCostChart.value?.destroy()
  costStructureChart.value?.destroy()
  revenueCostChart.value = undefined
  costStructureChart.value = undefined
})

function mapApprovalBusinessType(businessType: string): ApprovalFeeType | undefined {
  if (businessType === 'transport_fuel')
    return '燃油费' as const
  if (businessType === 'transport_etc')
    return 'ETC费' as const
  if (businessType === 'transport_maintenance')
    return '维保费' as const
  if (businessType === 'transport_fee')
    return '规费' as const
  if (businessType === 'vehicle_loan')
    return '车贷' as const
  if (businessType === 'salary')
    return '工资' as const
  return undefined
}

function exportRows() {
  handleQuery()
  const rows = filteredRows.value.map((row, index) => ({
    序号: index + 1,
    车牌号: row.plateNo,
    挂车号: row.trailerNo,
    司机: row.driver,
    财务年: row.financialYear,
    财务月: row.financialMonth,
    订单数: row.orderCount,
    总运费: row.totalFreight.toFixed(2),
    税后运费: row.taxedFreight.toFixed(2),
    油料数量_L: row.fuelQuantityLiters.toFixed(2),
    油料数量_kg: row.fuelQuantityKg.toFixed(2),
    油料总价: row.fuelFee.toFixed(2),
    维保费: row.maintenanceFee.toFixed(2),
    ETC费: row.etcFee.toFixed(2),
    工资: row.salaryFee.toFixed(2),
    规费: row.regulatoryFee.toFixed(2),
    车贷: row.loanFee.toFixed(2),
    管理费: row.managementFee.toFixed(2),
    总成本: vehicleCost(row).toFixed(2),
    利润: vehicleProfit(row).toFixed(2),
    利润率: `${(vehicleProfitRate(row) * 100).toFixed(2)}%`,
  }))
  const conditions = [{
    财务年: financialFilter.financialYear ?? '全部',
    财务月: financialFilter.financialMonth ?? '全部',
    日期范围: financialFilter.dateRange?.length ? `${financialFilter.dateRange[0].format('YYYY-MM-DD')} 至 ${financialFilter.dateRange[1].format('YYYY-MM-DD')}` : '未选择',
    车牌号: queryModel.plateNo || '全部',
    司机: queryModel.driver || '全部',
  }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(conditions), '筛选条件')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '车辆运营数据')
  XLSX.writeFile(workbook, `车辆运营数据_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
  message.success('导出成功')
}
</script>

<template>
  <page-container>
    <a-alert v-if="transportOperationError" class="operation-card" type="error" show-icon :message="transportOperationError" />

    <SummaryCards :cards="summaryCards" :xl-span="6" compact :loading="transportOperationLoading" :data-state="filteredRows.length ? 'ready' : 'empty'" />

    <a-card class="operation-card" :bordered="false">
      <a-form :model="queryModel" class="operation-query" @finish="handleQuery">
        <a-row :gutter="[16, 12]">
          <a-col :xs="24" :md="8" :xl="5">
            <a-form-item label="车牌号">
              <a-input v-model:value="queryModel.plateNo" allow-clear placeholder="请输入车牌号" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="5">
            <a-form-item label="司机">
              <a-input v-model:value="queryModel.driver" allow-clear placeholder="请输入司机" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :xl="14" class="query-actions">
            <a-space>
              <a-button type="primary" html-type="submit">
                查询
              </a-button>
              <a-button @click="resetQuery">
                重置
              </a-button>
              <a-button @click="exportRows">
                导出运营数据
              </a-button>
            </a-space>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <a-row :gutter="[16, 16]" class="operation-chart-grid">
      <a-col :span="24">
        <a-card class="operation-card chart-card" title="收入、成本与利润排名" :bordered="false">
          <template #extra>
            <div class="profit-chart-filters">
              <span class="chart-extra">仅统计有运单车辆 · 利润前5 / 后5 · 万元</span>
              <a-range-picker
                :value="financialFilter.dateRange || undefined"
                class="operation-date-range"
                allow-clear
                :placeholder="['开始日期', '结束日期']"
                @update:value="updateOperationDateRange"
              />
            </div>
          </template>
          <div class="performance-strip">
            <div v-for="item in performanceHighlights" :key="item.label" class="performance-item" :class="`performance-item--${item.tone}`">
              <span>{{ item.label }}</span>
              <strong>{{ money(item.value) }}</strong>
              <small>{{ item.note }}</small>
            </div>
            <div class="performance-item performance-item--rate">
              <span>利润率</span>
              <strong>{{ (operationSummary.profitRate * 100).toFixed(1) }}%</strong>
              <small>{{ operationSummary.profitRate >= 0 ? '当前经营为盈利' : '当前经营为亏损' }}</small>
            </div>
          </div>
          <div class="profit-ranking-layout">
            <div class="profit-chart-panel">
              <div ref="revenueCostChartContainer" class="chart-box profit-chart-box" />
            </div>
            <div class="profit-detail-panel">
              <div class="profit-ranking-table" role="table" aria-label="车辆利润排名对照表">
                <div class="profit-ranking-row profit-ranking-head" role="row">
                  <span>排名</span><span>车号</span><span>收入</span><span>成本</span><span>利润</span>
                </div>
                <button v-for="(row, index) in profitRankingRows" :key="`${row.rankGroup}-${row.plateNo}`" type="button" class="profit-ranking-row profit-ranking-button" :class="row.rankGroup === '利润前5' ? 'profit-ranking-row--high' : 'profit-ranking-row--low'" role="row" :aria-label="`查看${row.plateNo}经营明细`" @click="openDetail(row, 'profit')">
                  <span :class="row.rankGroup === '利润前5' ? 'rank-high' : 'rank-low'">
                    <b>{{ row.rankGroup === '利润前5' ? index + 1 : index - 4 }}</b>{{ row.rankGroup === '利润前5' ? '前五' : '后五' }}
                  </span>
                  <strong>{{ row.plateNo }}</strong>
                  <span>{{ money(row.taxedFreight) }}</span>
                  <span>{{ money(row.cost) }}</span>
                  <span :class="row.profit >= 0 ? 'amount-profit' : 'amount-loss'">{{ money(row.profit) }}</span>
                </button>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="24">
        <a-card class="operation-card chart-card" title="成本构成" :bordered="false">
          <template #extra>
            <span class="chart-extra">当前筛选 · 按金额从高到低 · 万元</span>
          </template>
          <div class="cost-structure-layout">
            <div class="cost-chart-panel">
              <div ref="costStructureChartContainer" class="chart-box cost-chart-box" />
              <div class="cost-chart-total" aria-live="polite">
                <span>总成本</span>
                <strong>¥{{ costStructureSummary.total.toFixed(2) }}万</strong>
                <small>共 {{ costStructureSummary.items.length }} 项费用</small>
              </div>
            </div>
            <div class="cost-breakdown-panel">
              <div class="cost-breakdown-summary">
                <span>最大成本项</span>
                <strong>{{ costStructureSummary.largest?.type || '暂无数据' }}</strong>
                <b>{{ costStructureSummary.largest ? `${(costStructureSummary.largest.share * 100).toFixed(1)}%` : '0.0%' }}</b>
              </div>
              <div class="cost-breakdown-list">
                <button v-for="item in costStructureSummary.items" :key="item.type" type="button" class="cost-breakdown-row cost-breakdown-button" :aria-label="`查看${item.type}车辆明细`" @click="openCostDetail(item.type as OperationFeeType)">
                  <span class="cost-rank">{{ item.rank }}</span>
                  <div class="cost-name-share">
                    <div><strong>{{ item.type }}</strong><span>{{ (item.share * 100).toFixed(1) }}%</span></div>
                    <i><b :style="{ width: `${item.share * 100}%` }" /></i>
                  </div>
                  <strong>¥{{ item.amount.toFixed(2) }}万</strong>
                </button>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-card class="operation-card" title="车辆运营数据" :bordered="false">
      <template #extra>
        <div class="operation-table-extra">
          <a-select v-model:value="financialFilter.financialYear" class="operation-period-select" :options="operationYearOptions" placeholder="财务年" allow-clear />
          <a-select v-model:value="financialFilter.financialMonth" class="operation-period-select" :options="operationMonthOptions" placeholder="财务月" allow-clear :disabled="!financialFilter.financialYear" />
          <a-tag color="blue">
            审批通过：{{ money(sum(filteredRows, 'approvedAmount')) }}
          </a-tag>
          <a-tag color="orange">
            已使用：{{ money(sum(filteredRows, 'usedAmount')) }}
          </a-tag>
        </div>
      </template>
      <a-table
        row-key="id"
        :loading="transportOperationLoading"
        :columns="tableColumns"
        :data-source="filteredRows"
        :scroll="{ x: tableScrollX }"
        :pagination="tablePagination"
        @change="handleTableChange"
      >
        <template #headerCell="{ column }">
          <template v-if="isModuleLinkedColumn(column.dataIndex)">
            <a-tooltip :title="`${column.title}关联${getOperationColumnModule(column.dataIndex)}模块`">
              <span class="module-linked-header">
                <span>{{ column.title }}</span>
              </span>
            </a-tooltip>
          </template>
          <template v-else>
            {{ column.title }}
          </template>
        </template>
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.dataIndex === 'plateNo'">
            <div class="vehicle-number-cell">
              <span class="vehicle-number-cell__plate">{{ asVehicleOperationRecord(record).plateNo }}</span>
              <span class="vehicle-number-cell__trailer">{{ asVehicleOperationRecord(record).trailerNo || '-' }}</span>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'profit'">
            <span :class="vehicleProfit(asVehicleOperationRecord(record)) >= 0 ? 'amount-profit' : 'amount-loss'">
              {{ money(vehicleProfit(asVehicleOperationRecord(record))) }}
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'action'">
            <a @click="openDetail(asVehicleOperationRecord(record))">查看</a>
          </template>
          <template v-else-if="isModuleLinkedColumn(column.dataIndex)">
            <a-tooltip :title="`查看${getOperationColumnModule(column.dataIndex)}明细`">
              <a class="module-linked-cell" @click="openDetail(asVehicleOperationRecord(record), String(column.dataIndex))">
                {{ displayCell(asVehicleOperationRecord(record), String(column.dataIndex), index) }}
              </a>
            </a-tooltip>
          </template>
          <template v-else>
            <a-tooltip :title="displayCell(asVehicleOperationRecord(record), String(column.dataIndex), index)">
              <span class="cell-ellipsis" :class="tableCellClass(column.dataIndex)">
                {{ displayCell(asVehicleOperationRecord(record), String(column.dataIndex), index) }}
              </span>
            </a-tooltip>
          </template>
        </template>
        <template #summary>
          <a-table-summary fixed>
            <a-table-summary-row class="operation-summary-row">
              <a-table-summary-cell :index="0" :col-span="2">
                合计
              </a-table-summary-cell>
              <a-table-summary-cell :index="2">
                {{ operationSummary.orderCount }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="3">
                {{ money(operationSummary.totalFreight) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="4">
                {{ money(operationSummary.taxedFreight) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="5">
                {{ formatFuelQuantity(operationSummary.fuelQuantityLiters, operationSummary.fuelQuantityKg) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="6">
                {{ money(operationSummary.fuelFee) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="7">
                {{ money(operationSummary.maintenanceFee) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="8">
                {{ money(operationSummary.etcFee) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="9">
                {{ money(operationSummary.salaryFee) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="10">
                {{ money(operationSummary.regulatoryFee) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="11">
                {{ money(operationSummary.loanFee) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="12">
                {{ money(operationSummary.managementFee) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="13">
                {{ money(operationSummary.totalCost) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="14">
                {{ money(operationSummary.profit) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="15">
                {{ (operationSummary.profitRate * 100).toFixed(2) }}%
              </a-table-summary-cell>
              <a-table-summary-cell :index="16" />
            </a-table-summary-row>
          </a-table-summary>
        </template>
      </a-table>
    </a-card>

    <BusinessDetailDrawer
      v-model:open="detailOpen"
      :title="detailRecord ? `${detailRecord.plateNo} 运营详情` : '车辆运营详情'"
      :subtitle="detailRecord ? `${detailRecord.financialYear}年${detailRecord.financialMonth}月 · ${detailRecord.driver || '未关联司机'}` : ''"
      :status="detailRecord ? (vehicleProfit(detailRecord) >= 0 ? '盈利' : '亏损') : ''"
      :status-color="detailRecord && vehicleProfit(detailRecord) >= 0 ? 'success' : 'error'"
      :width="900"
    >
      <template v-if="detailRecord">
        <a-descriptions bordered :column="2" size="small">
          <a-descriptions-item label="车牌号">
            {{ detailRecord.plateNo }}
          </a-descriptions-item>
          <a-descriptions-item label="挂车号">
            {{ detailRecord.trailerNo || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="司机">
            {{ detailRecord.driver }}
          </a-descriptions-item>
          <a-descriptions-item label="财务期间">
            {{ detailRecord.financialYear }}年{{ detailRecord.financialMonth }}月
          </a-descriptions-item>
          <a-descriptions-item label="订单数">
            {{ detailRecord.orderCount }}
          </a-descriptions-item>
          <a-descriptions-item label="税后运费">
            {{ money(detailRecord.taxedFreight) }}
          </a-descriptions-item>
          <a-descriptions-item label="油料数量">
            {{ displayCell(detailRecord, 'fuelQuantity', 0) }}
          </a-descriptions-item>
          <a-descriptions-item label="油料总价">
            {{ money(detailRecord.fuelFee) }}
          </a-descriptions-item>
          <a-descriptions-item label="总成本">
            {{ money(vehicleCost(detailRecord)) }}
          </a-descriptions-item>
          <a-descriptions-item label="审批通过金额">
            {{ money(detailRecord.approvedAmount) }}
          </a-descriptions-item>
          <a-descriptions-item label="已使用金额">
            {{ money(detailRecord.usedAmount) }}
          </a-descriptions-item>
          <a-descriptions-item label="未使用金额">
            {{ money(unusedAmount(detailRecord)) }}
          </a-descriptions-item>
          <a-descriptions-item label="利润">
            {{ money(vehicleProfit(detailRecord)) }}
          </a-descriptions-item>
          <a-descriptions-item label="备注" :span="2">
            {{ detailRecord.remark }}
          </a-descriptions-item>
        </a-descriptions>
        <a-alert
          v-if="detailFocusField"
          class="detail-module-alert"
          type="info"
          show-icon
          :message="`当前关联模块：${getOperationColumnModule(detailFocusField)}`"
          :description="`来自车辆运营数据表头「${tableColumns.find(column => column.dataIndex === detailFocusField)?.title || ''}」的明细查看。`"
        />
        <a-divider v-if="shouldShowOrderDetail" orientation="left">
          运输订单明细
        </a-divider>
        <a-table
          v-if="shouldShowOrderDetail"
          size="small"
          row-key="code"
          :pagination="false"
          :data-source="detailOrderLines"
          :columns="[
            { title: '订单编号', dataIndex: 'code' },
            { title: '出车日期', dataIndex: 'date' },
            { title: '路线', dataIndex: 'routeLine' },
            { title: '总运费', dataIndex: 'totalFreight' },
            { title: '税后运费', dataIndex: 'taxedFreight' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'totalFreight'">
              {{ money(record.totalFreight) }}
            </template>
            <template v-else-if="column.dataIndex === 'taxedFreight'">
              {{ money(record.taxedFreight) }}
            </template>
          </template>
        </a-table>

        <a-divider v-if="shouldShowFeeDetail" orientation="left">
          各类费用明细
        </a-divider>
        <a-table
          v-if="shouldShowFeeDetail"
          size="small"
          row-key="code"
          :pagination="false"
          :data-source="focusedDetailFeeLines"
          :columns="[
            { title: '费用编号', dataIndex: 'code' },
            { title: '日期', dataIndex: 'date' },
            { title: '费用类型', dataIndex: 'feeType' },
            { title: '来源模块', dataIndex: 'source' },
            { title: '油量', dataIndex: 'quantity' },
            { title: '金额', dataIndex: 'amount' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'quantity'">
              {{ record.quantity ? `${Number(record.quantity).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${record.quantityUnit || 'L'}` : '-' }}
            </template>
            <template v-else-if="column.dataIndex === 'amount'">
              {{ money(record.amount) }}
            </template>
          </template>
        </a-table>

        <a-divider v-if="shouldShowApprovalDetail" orientation="left">
          审批记录明细
        </a-divider>
        <a-table
          v-if="shouldShowApprovalDetail"
          size="small"
          row-key="code"
          :pagination="false"
          :data-source="detailApprovalLines"
          :columns="[
            { title: '审批单号', dataIndex: 'code' },
            { title: '审批日期', dataIndex: 'date' },
            { title: '业务类型', dataIndex: 'businessType' },
            { title: '审批通过金额', dataIndex: 'approvedAmount' },
            { title: '已使用金额', dataIndex: 'usedAmount' },
            { title: '未使用金额', dataIndex: 'unusedAmount' },
            { title: '状态', dataIndex: 'status' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'approvedAmount'">
              {{ money(record.approvedAmount) }}
            </template>
            <template v-else-if="column.dataIndex === 'usedAmount'">
              {{ money(record.usedAmount) }}
            </template>
            <template v-else-if="column.dataIndex === 'unusedAmount'">
              {{ money(record.approvedAmount - record.usedAmount) }}
            </template>
          </template>
        </a-table>

        <a-divider orientation="left">
          利润构成
        </a-divider>
        <a-row :gutter="[12, 12]">
          <a-col
            v-for="item in [
              ['税后运费', detailRecord.taxedFreight],
              ['油料总价', detailRecord.fuelFee],
              ['维保费', detailRecord.maintenanceFee],
              ['ETC费', detailRecord.etcFee],
              ['工资', detailRecord.salaryFee],
              ['规费', detailRecord.regulatoryFee],
              ['车贷', detailRecord.loanFee],
              ['管理费', detailRecord.managementFee],
              ['总成本', vehicleCost(detailRecord)],
              ['利润', vehicleProfit(detailRecord)],
            ]"
            :key="item[0]"
            :xs="24"
            :md="8"
          >
            <div class="cost-item">
              <span>{{ item[0] }}</span>
              <strong>{{ money(item[1]) }}</strong>
            </div>
          </a-col>
        </a-row>
      </template>
      <template #footer>
        <a-button @click="detailOpen = false">
          关闭
        </a-button>
      </template>
    </BusinessDetailDrawer>

    <a-drawer v-model:open="costDetailOpen" :title="selectedCostType ? `${selectedCostType}车辆明细` : '成本明细'" width="720">
      <a-alert mb-4 type="info" show-icon :message="`当前筛选范围内共 ${selectedCostVehicleRows.length} 辆车产生${selectedCostType || ''}`" description="按金额从高到低排列，点击任意车辆可继续查看原始费用明细。" />
      <a-table :data-source="selectedCostVehicleRows" row-key="id" size="middle" :pagination="{ pageSize: 10, showSizeChanger: false }">
        <a-table-column title="车牌号" data-index="plateNo" width="150" />
        <a-table-column title="司机" data-index="driver" />
        <a-table-column title="金额" data-index="selectedCostAmount" align="right" width="160">
          <template #default="{ record }">
            <strong>{{ money(record.selectedCostAmount) }}</strong>
          </template>
        </a-table-column>
        <a-table-column title="操作" align="center" width="90">
          <template #default="{ record }">
            <a @click="openCostVehicleDetail(asVehicleOperationRecord(record))">查看明细</a>
          </template>
        </a-table-column>
      </a-table>
    </a-drawer>
  </page-container>
</template>

<style scoped lang="less">
.operation-card {
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(15 23 42 / 6%);
}

.operation-chart-grid {
  margin-bottom: 0;
}

.chart-card {
  :deep(.ant-card-head) {
    min-height: 48px;
    border-bottom-color: rgb(15 23 42 / 8%);
  }
}

.profit-chart-filters {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.chart-extra {
  color: #64748b;
  font-size: 13px;
}

.chart-box {
  width: 100%;
  height: 260px;
}

.performance-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 18px;
  overflow: hidden;
  background: #f8fafc;
  border-radius: 8px;
}

.performance-item {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 15px 18px;

  & + &::before {
    position: absolute;
    top: 15px;
    bottom: 15px;
    left: 0;
    width: 1px;
    background: #e2e8f0;
    content: '';
  }

  > span {
    color: #475569;
    font-size: 13px;
  }

  > strong {
    margin-top: 2px;
    color: #0f172a;
    font-size: 24px;
    line-height: 1.35;
  }

  > small {
    color: #64748b;
    font-size: 12px;
  }
}

.performance-item--revenue > strong {
  color: #1677ff;
}
.performance-item--cost > strong,
.performance-item--loss > strong {
  color: #dc2626;
}
.performance-item--profit > strong,
.performance-item--rate > strong {
  color: #059669;
}

.profit-ranking-layout {
  display: grid;
  grid-template-columns: minmax(0, 11fr) minmax(520px, 9fr);
  gap: 18px;
  align-items: stretch;
}

.profit-chart-panel,
.profit-detail-panel {
  min-width: 0;
}

.profit-chart-box {
  height: 392px;
}

.profit-detail-panel {
  display: flex;
  align-items: stretch;
}

.profit-ranking-table {
  width: 100%;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.profit-ranking-row {
  display: grid;
  grid-template-columns: 76px minmax(92px, 1fr) repeat(3, minmax(92px, 1fr));
  min-height: 36px;
  align-items: center;
  border-top: 1px solid #eef2f7;

  > span,
  > strong {
    min-width: 0;
    padding: 7px 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span:nth-child(n + 3) {
    text-align: right;
  }
}

.profit-ranking-row--high {
  background: rgb(22 163 74 / 2.5%);
}
.profit-ranking-row--low {
  background: rgb(220 38 38 / 2.5%);
}

.profit-ranking-button,
.cost-breakdown-button {
  width: 100%;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  border: 0;
}

.profit-ranking-button:hover,
.profit-ranking-button:focus-visible,
.cost-breakdown-button:hover,
.cost-breakdown-button:focus-visible {
  background: #f0f6ff;
  outline: 2px solid #91caff;
  outline-offset: -2px;
}

.profit-ranking-head {
  min-height: 34px;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  background: #f8fafc;
  border-top: 0;
}

.rank-high {
  color: #15803d;
  font-weight: 600;
}

.rank-high,
.rank-low {
  display: flex;
  align-items: center;
  gap: 6px;

  b {
    display: inline-grid;
    width: 22px;
    height: 22px;
    place-items: center;
    color: currentcolor;
    font-size: 12px;
    background: currentcolor;
    border-radius: 50%;
    box-shadow: inset 0 0 0 20px rgb(255 255 255 / 88%);
  }
}

.cost-structure-layout {
  display: grid;
  grid-template-columns: minmax(300px, 4fr) minmax(520px, 6fr);
  gap: 28px;
  align-items: center;
}

.cost-chart-panel {
  position: relative;
  min-width: 0;
}

.cost-chart-box {
  height: 340px;
}

.cost-chart-total {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  width: 150px;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -50%);
  pointer-events: none;

  span {
    color: #64748b;
    font-size: 13px;
  }
  strong {
    color: #0f172a;
    font-size: 22px;
    line-height: 1.4;
    white-space: nowrap;
  }
  small {
    color: #94a3b8;
    font-size: 11px;
  }
}

.cost-breakdown-summary {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;

  span {
    grid-column: 1 / -1;
    color: #64748b;
    font-size: 12px;
  }
  strong {
    color: #0f172a;
    font-size: 20px;
  }
  b {
    align-self: end;
    color: #dc2626;
    font-size: 20px;
  }
}

.cost-breakdown-list {
  margin-top: 8px;
}

.cost-breakdown-row {
  display: grid;
  grid-template-columns: 24px minmax(160px, 1fr) minmax(100px, auto);
  gap: 10px;
  align-items: center;
  min-height: 38px;
  background: transparent;
  border-radius: 4px;

  > strong {
    color: #334155;
    text-align: right;
  }
}

.cost-rank {
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
}

.cost-name-share {
  min-width: 0;

  div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  div strong {
    color: #334155;
  }
  div span {
    color: #64748b;
    font-size: 12px;
  }
  i {
    display: block;
    height: 4px;
    margin-top: 4px;
    overflow: hidden;
    background: #e2e8f0;
    border-radius: 2px;
  }
  i b {
    display: block;
    height: 100%;
    background: #1677ff;
    border-radius: inherit;
  }
}

.rank-low {
  color: #b91c1c;
  font-weight: 600;
}

.operation-query {
  :deep(.ant-form-item) {
    margin-bottom: 0;
  }

  :deep(.ant-picker),
  :deep(.ant-input),
  :deep(.ant-select) {
    width: 100%;
  }
}

.query-actions {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}

.operation-table-extra {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.operation-period-select {
  width: 150px;
}

.operation-date-range {
  width: 280px;
}

@media (max-width: 768px) {
  .profit-chart-filters {
    align-items: stretch;
    flex-direction: column;
  }

  .operation-date-range {
    width: 100%;
  }

  .profit-ranking-table {
    min-width: 580px;
    overflow-x: auto;
  }
}

@media (max-width: 1200px) {
  .performance-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .profit-ranking-layout {
    grid-template-columns: 1fr;
  }

  .profit-chart-box {
    height: 320px;
  }

  .profit-detail-panel {
    overflow-x: auto;
  }

  .cost-structure-layout {
    grid-template-columns: 1fr;
  }
}

.amount-profit {
  color: #16a34a;
  font-weight: 600;
}

.amount-loss {
  color: #dc2626;
  font-weight: 600;
}

.vehicle-number-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  line-height: 1.25;
}

.vehicle-number-cell__plate {
  overflow: hidden;
  color: #111827;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vehicle-number-cell__trailer {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.operation-summary-row {
  font-weight: 600;

  :deep(.ant-table-cell) {
    text-align: right;
    white-space: nowrap;
  }

  :deep(.ant-table-cell:first-child) {
    text-align: center;
  }
}

.module-linked-header {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.2;
}

.module-linked-header__source {
  color: #64748b;
  font-size: 12px;
  font-weight: 400;
}

.module-linked-cell {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: #1677ff;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-module-alert {
  margin-top: 12px;
}

.cost-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

@media (max-width: 768px) {
  .performance-strip {
    grid-template-columns: 1fr;
  }

  .performance-item + .performance-item::before {
    top: 0;
    right: 18px;
    bottom: auto;
    left: 18px;
    width: auto;
    height: 1px;
  }

  .query-actions {
    justify-content: flex-start;
  }

  .operation-table-extra {
    justify-content: flex-start;
  }

  .operation-date-range {
    width: 100%;
  }
}
</style>

<script setup lang="ts">
import type { Dayjs } from 'dayjs'
import type { OrderRecord } from '~@/composables/transport-operation-data'
import { DownloadOutlined, InboxOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { h } from 'vue'
import * as XLSX from 'xlsx'
import SummaryCards from '~@/components/summary-cards/index.vue'
import { transportOrderRows } from '~@/composables/transport-operation-data'
import { BILL_RECONCILIATION_CHECKS, isSameBillValue } from '~@/utils/bill-reconciliation'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { createFinancialComparison } from '~@/utils/financial-comparison'
import { getCurrentFinancialMonthRange } from '~@/utils/financialPeriod'

type ReconciliationStatus = '未处理' | '已确认系统正确' | '已确认客户正确' | '已修改' | '忽略'
type ArchiveStatus = '待确认' | '已归档'
type ProblemSide = '系统数据可能有问题' | '客户账单可能有问题' | '双方都需要人工确认'

interface BillRow {
  id: string
  waybillNo: string
  customer: string
  routeLine: string
  weight: number
  unitPrice: number
  distance: number
  freightAmount: number
  taxedFreight: number
  source?: Record<string, unknown>
}

interface DifferenceRow {
  id: string
  waybillNo: string
  type: string
  problemSide: ProblemSide
  systemValue: string
  customerValue: string
  status: ReconciliationStatus
  remark: string
}

interface ArchiveRecord {
  id: string
  period: string
  customerName: string
  status: ArchiveStatus
  systemRows: BillRow[]
  customerRows: BillRow[]
  differences: DifferenceRow[]
  operator: string
  savedAt: string
}

interface MappingOption {
  label: string
  value: keyof BillRow
  candidates: string[]
}

const message = useMessage()

const fieldOptions: MappingOption[] = [
  { label: '运单号', value: 'waybillNo', candidates: ['运单号', '订单编号', '订单号', '运单编号', '单号'] },
  { label: '客户', value: 'customer', candidates: ['客户', '客户名称', '结算客户'] },
  { label: '路线', value: 'routeLine', candidates: ['路线', '线路', '运输线路'] },
  { label: '吨位', value: 'weight', candidates: ['吨位', '实发重量', '实收重量', '货物实收重量', '重量'] },
  { label: '单价', value: 'unitPrice', candidates: ['单价', '运费单价', '运输单价'] },
  { label: '运距', value: 'distance', candidates: ['运距', '运输里程', '里程', '距离'] },
  { label: '运费', value: 'freightAmount', candidates: ['运费', '运费合计', '运费总价', '金额'] },
  { label: '税后运费', value: 'taxedFreight', candidates: ['税后运费', '税后总价', '不含税运费'] },
]

const statusOptions: ReconciliationStatus[] = ['未处理', '已确认系统正确', '已确认客户正确', '已修改', '忽略']
const archiveStatusOptions: ArchiveStatus[] = ['待确认', '已归档']

const currentFinancialPeriod = getCurrentFinancialMonthRange()
const dateRange = ref<[string, string]>([currentFinancialPeriod.displayStartDate, currentFinancialPeriod.displayEndDate])
const selectedCustomers = ref<string[]>([])
const systemRows = ref<BillRow[]>([])
const rawCustomerRows = ref<Array<Record<string, unknown>>>([])
const customerRows = ref<BillRow[]>([])
const differences = ref<DifferenceRow[]>([])
const importedColumns = ref<string[]>([])
const fieldMapping = reactive<Record<string, string>>({})
const activeTab = ref('current')
const hasCompared = ref(false)
const archiveLoading = ref(false)
const historyQuery = reactive({ customer: undefined as string | undefined, status: undefined as ArchiveStatus | undefined, range: undefined as [Dayjs, Dayjs] | undefined })
const archiveRows = ref<ArchiveRecord[]>([])

const customerOptions = computed(() => {
  const [start, end] = dateRange.value || []
  const sourceRows = start && end && isValidDateText(start) && isValidDateText(end)
    ? transportOrderRows.value.filter(row => isDateInRange(row.shipDate, dayjs(start), dayjs(end)))
    : transportOrderRows.value
  return [...new Set(sourceRows.map(row => String(row.customer || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map(value => ({ label: value, value }))
})
const allCustomersSelected = computed(() => customerOptions.value.length > 0 && selectedCustomers.value.length === customerOptions.value.length)

const filteredSystemRows = computed(() => {
  if (!selectedCustomers.value.length)
    return systemRows.value
  const selected = new Set(selectedCustomers.value)
  return systemRows.value.filter(row => selected.has(row.customer))
})

const filteredCustomerRows = computed(() => {
  if (!selectedCustomers.value.length || !customerRows.value.some(row => row.customer))
    return customerRows.value
  const selected = new Set(selectedCustomers.value)
  return customerRows.value.filter(row => selected.has(row.customer))
})

const unresolvedCount = computed(() => differences.value.filter(row => row.status === '未处理').length)
const canArchive = computed(() => hasCompared.value && unresolvedCount.value === 0 && filteredSystemRows.value.length > 0 && filteredCustomerRows.value.length > 0)

const currentMonthSystemRows = computed(() => transportOrderRows.value
  .filter(row => isDateInRange(row.shipDate, currentFinancialPeriod.startAt, currentFinancialPeriod.displayEndAt))
  .map(mapOrderToBillRow))
const previousFinancialStart = currentFinancialPeriod.startAt.subtract(1, 'month')
const previousFinancialEnd = currentFinancialPeriod.displayEndAt.subtract(1, 'month')
const previousMonthSystemRows = computed(() => transportOrderRows.value
  .filter(row => isDateInRange(row.shipDate, previousFinancialStart, previousFinancialEnd))
  .map(mapOrderToBillRow))
const previousMonthArchives = computed(() => archiveRows.value.filter((row) => {
  const [start, end] = row.period.split(' 至 ')
  return start === previousFinancialStart.format('YYYY-MM-DD') && end === previousFinancialEnd.format('YYYY-MM-DD')
}))
const previousCustomerCount = computed(() => previousMonthArchives.value.reduce((sum, row) => sum + row.customerRows.length, 0))
const previousDifferenceCount = computed(() => previousMonthArchives.value.reduce((sum, row) => sum + row.differences.length, 0))

const simpleMetrics = computed(() => [
  { label: '系统运单', value: currentMonthSystemRows.value.length, comparison: createFinancialComparison(currentMonthSystemRows.value.length, previousMonthSystemRows.value.length, `${previousMonthSystemRows.value.length} 单`), tone: 'primary' as const },
  { label: '系统运费', value: formatAmount(sumRows(currentMonthSystemRows.value, 'freightAmount')), comparison: createFinancialComparison(sumRows(currentMonthSystemRows.value, 'freightAmount'), sumRows(previousMonthSystemRows.value, 'freightAmount'), formatAmount(sumRows(previousMonthSystemRows.value, 'freightAmount'))), tone: 'success' as const },
  { label: '客户账单', value: filteredCustomerRows.value.length, comparison: createFinancialComparison(filteredCustomerRows.value.length, previousCustomerCount.value, `${previousCustomerCount.value} 单`), tone: filteredCustomerRows.value.length ? 'success' as const : 'default' as const },
  { label: '核对差异', value: differences.value.length, comparison: createFinancialComparison(differences.value.length, previousDifferenceCount.value, `${previousDifferenceCount.value} 条`), tag: unresolvedCount.value ? `${unresolvedCount.value} 条待确认` : undefined, tone: unresolvedCount.value ? 'warning' as const : 'default' as const },
])

const reconciliationStep = computed(() => {
  if (hasCompared.value && !unresolvedCount.value)
    return 3
  if (hasCompared.value)
    return 2
  if (customerRows.value.length)
    return 1
  return 0
})

const reconciliationSteps = [
  { title: '带入系统订单' },
  { title: '导入客户账单' },
  { title: '查看差异具体内容' },
  { title: '保存归档' },
]

const reconciliationState = computed(() => {
  if (!customerRows.value.length)
    return { text: '等待导入客户账单', color: 'blue' }
  if (!hasCompared.value)
    return { text: '等待比对', color: 'orange' }
  if (unresolvedCount.value)
    return { text: '待人工确认', color: 'red' }
  return { text: '可保存归档', color: 'green' }
})

const mappingColumns = [
  { title: '系统字段', dataIndex: 'label', width: 140 },
  { title: '客户账单字段', dataIndex: 'value', width: 220 },
  { title: '自动识别候选', dataIndex: 'candidates' },
]
const mappingTableColumns = computed(() => enhanceBusinessTableColumns(mappingColumns, { noSortFields: ['value'] }))
const mappingTableScrollX = computed(() => createBusinessTableScrollX(mappingTableColumns.value, 760))

const simpleBillColumns = [
  { title: '运单号', dataIndex: 'waybillNo', width: 160 },
  { title: '客户', dataIndex: 'customer', width: 160, ellipsis: true },
  { title: '路线', dataIndex: 'routeLine', width: 220, ellipsis: true },
  { title: '吨位', dataIndex: 'weight', width: 100, align: 'right' as const },
  { title: '单价', dataIndex: 'unitPrice', width: 110, align: 'right' as const },
  { title: '运距', dataIndex: 'distance', width: 100, align: 'right' as const },
  { title: '运费', dataIndex: 'freightAmount', width: 130, align: 'right' as const },
  { title: '税后运费', dataIndex: 'taxedFreight', width: 130, align: 'right' as const },
]
const simpleBillTableColumns = computed(() => enhanceBusinessTableColumns(simpleBillColumns))
const simpleBillTableScrollX = computed(() => createBusinessTableScrollX(simpleBillTableColumns.value, 1110))

const simpleDifferenceColumns = [
  { title: '运单号', dataIndex: 'waybillNo', width: 150 },
  { title: '差异字段', dataIndex: 'type', width: 120 },
  { title: '系统值', dataIndex: 'systemValue', width: 180, ellipsis: true },
  { title: '客户账单值', dataIndex: 'customerValue', width: 180, ellipsis: true },
  { title: '责任判断', dataIndex: 'problemSide', width: 180 },
  { title: '处理状态', dataIndex: 'status', width: 170 },
  { title: '备注', dataIndex: 'remark' },
]
const simpleDifferenceTableColumns = computed(() => enhanceBusinessTableColumns(simpleDifferenceColumns, { noSortFields: ['status', 'remark'] }))
const simpleDifferenceTableScrollX = computed(() => createBusinessTableScrollX(simpleDifferenceTableColumns.value, 1280))

const archiveColumns = [
  { title: '核对时间段', dataIndex: 'period', width: 210 },
  { title: '客户名称', dataIndex: 'customerName', width: 150 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '系统运单', dataIndex: 'systemCount', width: 100 },
  { title: '客户账单', dataIndex: 'customerCount', width: 100 },
  { title: '差异', dataIndex: 'differenceCount', width: 90 },
  { title: '操作人', dataIndex: 'operator', width: 110 },
  { title: '保存时间', dataIndex: 'savedAt', width: 170 },
]
const archiveTableColumns = computed(() => enhanceBusinessTableColumns(archiveColumns))
const archiveTableScrollX = computed(() => createBusinessTableScrollX(archiveTableColumns.value, 1050))

const filteredArchives = computed(() => {
  return archiveRows.value.filter((row) => {
    if (historyQuery.customer && !row.customerName.includes(historyQuery.customer))
      return false
    if (historyQuery.status && row.status !== historyQuery.status)
      return false
    if (historyQuery.range?.length) {
      const saved = dayjs(row.savedAt)
      if (saved.isBefore(historyQuery.range[0], 'day') || saved.isAfter(historyQuery.range[1], 'day'))
        return false
    }
    return true
  }).map(row => ({
    ...row,
    systemCount: row.systemRows.length,
    customerCount: row.customerRows.length,
    differenceCount: row.differences.length,
  }))
})

function loadSystemWaybills() {
  const [start, end] = dateRange.value || []
  if (!start || !end)
    return message.warning('请先选择核对时间段')
  if (!isValidDateText(start) || !isValidDateText(end))
    return message.warning('请按 YYYY-MM-DD 格式填写核对时间段')

  systemRows.value = transportOrderRows.value
    .filter(row => isDateInRange(row.shipDate, dayjs(start), dayjs(end)))
    .map(mapOrderToBillRow)
  const availableCustomers = new Set(customerOptions.value.map(option => option.value))
  selectedCustomers.value = selectedCustomers.value.filter(customer => availableCustomers.has(customer))
  differences.value = []
  hasCompared.value = false
  message.success(`已带入 ${systemRows.value.length} 条系统运输订单`)
}

function selectAllCustomers() {
  selectedCustomers.value = customerOptions.value.map(option => option.value)
}

function mapOrderToBillRow(row: OrderRecord): BillRow {
  return {
    id: `system-${row.code}`,
    waybillNo: row.code,
    customer: row.customer,
    routeLine: row.routeLine,
    weight: toNumber(row.receivedWeight || row.sentWeight),
    unitPrice: toNumber(row.freightPrice),
    distance: toNumber(row.distance),
    freightAmount: toNumber(row.freightTotal),
    taxedFreight: toNumber(row.taxedFreight),
    source: row,
  }
}

async function beforeUploadCustomerBill(file: File) {
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!worksheet) {
    message.error('未识别到客户账单工作表')
    return false
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
  applyImportedRows(rows)
  message.success(`已导入客户账单 ${rows.length} 条`)
  return false
}

function applyImportedRows(rows: Array<Record<string, unknown>>) {
  rawCustomerRows.value = rows
  importedColumns.value = rows.length ? Object.keys(rows[0]) : []
  autoMapFields()
  normalizeCustomerRows()
  differences.value = []
  hasCompared.value = false
}

function autoMapFields() {
  fieldOptions.forEach((option) => {
    fieldMapping[option.value] = importedColumns.value.find(column =>
      option.candidates.some(candidate => normalizeHeader(candidate) === normalizeHeader(column))
      || option.candidates.some(candidate => normalizeHeader(column).includes(normalizeHeader(candidate))),
    ) || ''
  })
}

function normalizeCustomerRows() {
  customerRows.value = rawCustomerRows.value.map((row, index) => {
    return {
      id: `customer-${index}`,
      waybillNo: String(readMappedCell(row, 'waybillNo') || '').trim(),
      customer: String(readMappedCell(row, 'customer') || '').trim(),
      routeLine: String(readMappedCell(row, 'routeLine') || '').trim(),
      weight: toNumber(readMappedCell(row, 'weight')),
      unitPrice: toNumber(readMappedCell(row, 'unitPrice')),
      distance: toNumber(readMappedCell(row, 'distance')),
      freightAmount: toNumber(readMappedCell(row, 'freightAmount')),
      taxedFreight: toNumber(readMappedCell(row, 'taxedFreight')),
      source: row,
    }
  }).filter(row => row.waybillNo)
}

function compareBills() {
  normalizeCustomerRows()
  const systemList = filteredSystemRows.value
  if (!systemList.length)
    return message.warning('请先带入系统运输订单')
  if (!filteredCustomerRows.value.length)
    return message.warning('请先导入客户账单并完成字段映射')

  const next: DifferenceRow[] = []
  const customerMap = new Map(filteredCustomerRows.value.map(row => [row.waybillNo, row]))
  const systemMap = new Map(systemList.map(row => [row.waybillNo, row]))

  systemList.forEach((systemRow) => {
    const customerRow = customerMap.get(systemRow.waybillNo)
    if (!customerRow) {
      next.push(createDifference(systemRow.waybillNo, '系统有，客户账单没有', '客户账单可能有问题', describeRow(systemRow), '-'))
      return
    }
    compareSameWaybill(systemRow, customerRow, next)
  })

  filteredCustomerRows.value.forEach((customerRow) => {
    if (!systemMap.has(customerRow.waybillNo))
      next.push(createDifference(customerRow.waybillNo, '客户账单有，系统没有', '系统数据可能有问题', '-', describeRow(customerRow)))
  })

  differences.value = next
  hasCompared.value = true
  message.success(next.length ? `发现 ${next.length} 条差异，请逐条确认` : '未发现差异，可直接保存归档')
}

function compareSameWaybill(systemRow: BillRow, customerRow: BillRow, target: DifferenceRow[]) {
  BILL_RECONCILIATION_CHECKS.forEach(({ label, key, kind }) => {
    const systemValue = systemRow[key]
    const customerValue = customerRow[key]

    if (!isSameBillValue(systemValue, customerValue, kind)) {
      target.push(createDifference(
        systemRow.waybillNo,
        label,
        '双方都需要人工确认',
        formatDiffValue(systemValue, kind),
        formatDiffValue(customerValue, kind),
      ))
    }
  })
}

async function loadArchives() {
  archiveLoading.value = true
  try {
    const result = await useGet<ArchiveRecord[]>('/transport/bill-reconciliation/archives')
    if (result.code !== 200)
      throw new Error(result.msg || '归档记录加载失败')
    archiveRows.value = result.data || []
  }
  catch (error: any) {
    archiveRows.value = []
    message.error(error?.message || '归档记录加载失败')
  }
  finally {
    archiveLoading.value = false
  }
}

async function saveArchive() {
  if (differences.value.some(row => row.status === '未处理'))
    return message.warning('请先确认全部差异后再保存归档')
  if (!filteredSystemRows.value.length || !filteredCustomerRows.value.length)
    return message.warning('归档需要包含系统运单数据和客户导入数据')

  const customerName = selectedCustomers.value.join('、')
    || [...new Set(filteredSystemRows.value.map(row => row.customer).filter(Boolean))].join('、')
    || '全部客户'
  const [start, end] = dateRange.value
  const record: ArchiveRecord = {
    id: `BR${dayjs().format('YYYYMMDDHHmmss')}`,
    period: `${start} 至 ${end}`,
    customerName,
    status: '已归档',
    systemRows: cloneRows(filteredSystemRows.value),
    customerRows: cloneRows(filteredCustomerRows.value),
    differences: cloneRows(differences.value),
    operator: '超级管理员',
    savedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  }

  const result = await usePost<ArchiveRecord[]>('/transport/bill-reconciliation/archives', record)
  if (result.code !== 200)
    return message.error(result.msg || '归档保存失败')
  archiveRows.value = result.data || [record, ...archiveRows.value]
  activeTab.value = 'history'
  message.success('本次账单核对已保存归档')
}

function exportDifferences() {
  const workbook = XLSX.utils.book_new()
  const rows = differences.value.map(row => ({
    运单号: row.waybillNo,
    差异字段: row.type,
    系统值: row.systemValue,
    客户账单值: row.customerValue,
    责任判断: row.problemSide,
    处理状态: row.status,
    备注: row.remark,
  }))
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '差异明细')
  XLSX.writeFile(workbook, `账单核对差异_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
}

function resetHistoryQuery() {
  historyQuery.customer = undefined
  historyQuery.status = undefined
  historyQuery.range = undefined
}

function createDifference(waybillNo: string, type: string, problemSide: ProblemSide, systemValue: string, customerValue: string): DifferenceRow {
  return {
    id: `${waybillNo}-${type}-${Math.random().toString(36).slice(2, 8)}`,
    waybillNo,
    type,
    problemSide,
    systemValue,
    customerValue,
    status: '未处理',
    remark: '',
  }
}

function readMappedCell(row: Record<string, unknown>, key: keyof BillRow) {
  const column = fieldMapping[key]
  return column ? row[column] : ''
}

function isDateInRange(value: string, start: Dayjs, end: Dayjs) {
  const current = dayjs(value)
  return current.isValid() && !current.isBefore(start, 'day') && !current.isAfter(end, 'day')
}

function isValidDateText(value: string) {
  const parsed = dayjs(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && parsed.isValid() && parsed.format('YYYY-MM-DD') === value
}

function normalizeHeader(value: string) {
  return String(value).replace(/\s+/g, '').toLowerCase()
}

function toNumber(value: unknown) {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : 0
  const normalized = String(value ?? '').replace(/[¥￥,\s吨票件]/g, '')
  const numberValue = Number.parseFloat(normalized)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function sumRows(rows: BillRow[], key: keyof Pick<BillRow, 'freightAmount' | 'taxedFreight'>) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0)
}

function formatAmount(value: number) {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDiffValue(value: unknown, kind: 'number' | 'text') {
  if (kind === 'number')
    return formatNumber(Number(value || 0))
  return String(value || '-')
}

function getMoneyCell(record: Record<string, any>, dataIndex: unknown) {
  if (dataIndex === 'freightAmount' || dataIndex === 'taxedFreight')
    return record[dataIndex]
  return 0
}

function formatBillCell(record: Record<string, any>, dataIndex: unknown) {
  const key = String(dataIndex)
  const value = record[key]
  if (key === 'freightAmount' || key === 'taxedFreight')
    return formatAmount(Number(value || 0))
  if (key === 'weight' || key === 'unitPrice' || key === 'distance')
    return formatNumber(Number(value || 0))
  return displayBusinessTableValue(value)
}

function describeRow(row: BillRow) {
  return `${row.customer || '-'} / ${row.routeLine || '-'} / ${formatNumber(row.weight)} 吨 / ${formatAmount(row.freightAmount)}`
}

function cloneRows<T>(rows: T[]): T[] {
  return JSON.parse(JSON.stringify(rows))
}

function formatDateRange(range: [string, string]) {
  const [start, end] = range
  return start && end ? `${start} 至 ${end}` : '-'
}

function statusColor(status: ReconciliationStatus | ArchiveStatus) {
  const colorMap: Record<string, string> = {
    未处理: 'red',
    已确认系统正确: 'blue',
    已确认客户正确: 'cyan',
    已修改: 'green',
    忽略: 'default',
    已归档: 'green',
    待确认: 'orange',
  }
  return colorMap[status] || 'default'
}

onMounted(() => {
  void loadArchives()
})
</script>

<template>
  <page-container>
    <SummaryCards :cards="simpleMetrics" compact />

    <a-tabs v-model:active-key="activeTab" class="bill-tabs">
      <a-tab-pane key="current" tab="本次核对">
        <a-card class="bill-card primary-workspace" title="核对设置" :bordered="false">
          <template #extra>
            <a-tag :color="reconciliationState.color">
              {{ reconciliationState.text }}
            </a-tag>
          </template>
          <a-row :gutter="[24, 24]">
            <a-col :xs="24" :xl="10">
              <div class="section-label">
                系统订单
              </div>
              <a-form layout="vertical">
                <a-form-item label="核对时间段">
                  <a-range-picker
                    v-model:value="dateRange"
                    class="full-control"
                    value-format="YYYY-MM-DD"
                    format="YYYY-MM-DD"
                    :placeholder="['开始日期', '截止日期']"
                    :allow-clear="false"
                  />
                </a-form-item>
                <a-form-item label="客户">
                  <div class="customer-select-row">
                    <a-select
                      v-model:value="selectedCustomers"
                      mode="multiple"
                      allow-clear
                      show-search
                      option-filter-prop="label"
                      :max-tag-count="2"
                      :options="customerOptions"
                      placeholder="请选择客户；不选择时核对全部客户"
                    />
                    <a-button :disabled="!customerOptions.length || allCustomersSelected" @click="selectAllCustomers">
                      {{ allCustomersSelected ? '已全选' : '全选' }}
                    </a-button>
                  </div>
                </a-form-item>
                <a-button type="primary" :icon="h(SearchOutlined)" @click="loadSystemWaybills">
                  带入系统运单
                </a-button>
              </a-form>
            </a-col>
            <a-col :xs="24" :xl="8">
              <div class="section-label">
                客户账单
              </div>
              <a-upload-dragger class="compact-upload" :show-upload-list="false" accept=".xlsx,.xls" :before-upload="beforeUploadCustomerBill">
                <p class="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p class="ant-upload-text">
                  导入 Excel
                </p>
                <p class="ant-upload-hint">
                  字段自动识别，必要时可展开调整。
                </p>
              </a-upload-dragger>
            </a-col>
            <a-col :xs="24" :xl="6">
              <div class="section-label">
                自动比对
              </div>
              <div class="compare-panel">
                <div class="compare-summary">
                  <span>当前差异</span>
                  <strong>{{ differences.length }} 条</strong>
                </div>
                <a-button type="primary" :icon="h(SearchOutlined)" block @click="compareBills">
                  查找差异
                </a-button>
              </div>
            </a-col>
          </a-row>
          <a-divider />
          <a-steps class="reconciliation-steps" size="small" :current="reconciliationStep" :items="reconciliationSteps" />
        </a-card>

        <a-card class="bill-card" title="差异具体内容" :bordered="false">
          <template #extra>
            <a-space>
              <a-button :icon="h(DownloadOutlined)" :disabled="!differences.length" @click="exportDifferences">
                导出差异
              </a-button>
            </a-space>
          </template>

          <a-alert
            v-if="differences.length"
            class="bill-alert"
            :type="unresolvedCount ? 'warning' : 'success'"
            show-icon
            :message="unresolvedCount ? `还有 ${unresolvedCount} 条差异未处理，全部确认后才能保存归档。` : '全部差异已确认，可以保存归档。'"
          />
          <a-alert
            v-else-if="hasCompared"
            class="bill-alert"
            type="success"
            show-icon
            message="未发现差异，可以保存归档。"
          />
          <a-empty v-else description="尚未查找差异，系统将优先按运单号匹配。" />

          <a-table
            v-if="differences.length"
            row-key="id"
            size="small"
            :columns="simpleDifferenceTableColumns"
            :data-source="differences"
            :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
            :scroll="{ x: simpleDifferenceTableScrollX }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'problemSide'">
                <a-tag :color="record.problemSide === '双方都需要人工确认' ? 'orange' : 'blue'">
                  {{ record.problemSide }}
                </a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-select v-model:value="record.status" class="full-control">
                  <a-select-option v-for="status in statusOptions" :key="status" :value="status">
                    {{ status }}
                  </a-select-option>
                </a-select>
              </template>
              <template v-else-if="column.dataIndex === 'remark'">
                <a-input v-model:value="record.remark" placeholder="填写问题原因或处理说明" />
              </template>
              <template v-else>
                <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                  <span class="cell-ellipsis">
                    {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                  </span>
                </a-tooltip>
              </template>
            </template>
          </a-table>
        </a-card>

        <a-card class="bill-card archive-card" title="保存归档" :bordered="false">
          <template #extra>
            <a-button type="primary" :icon="h(SaveOutlined)" :disabled="!canArchive" @click="saveArchive">
              保存归档
            </a-button>
          </template>
          <a-descriptions size="small" :column="{ xs: 1, sm: 1, md: 3 }">
            <a-descriptions-item label="核对时间段">
              {{ formatDateRange(dateRange) }}
            </a-descriptions-item>
            <a-descriptions-item label="客户">
              {{ selectedCustomers.length ? selectedCustomers.join('、') : '全部客户' }}
            </a-descriptions-item>
            <a-descriptions-item label="操作人">
              超级管理员
            </a-descriptions-item>
          </a-descriptions>
        </a-card>

        <a-card class="bill-card" :bordered="false">
          <template #title>
            <span>高级信息</span>
          </template>
          <a-collapse ghost>
            <a-collapse-panel key="mapping" header="字段映射">
              <a-table row-key="value" size="small" :columns="mappingTableColumns" :data-source="fieldOptions" :pagination="false" :scroll="{ x: mappingTableScrollX }">
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'value'">
                    <a-select
                      v-model:value="fieldMapping[record.value]"
                      allow-clear
                      class="full-control"
                      :options="importedColumns.map(columnName => ({ label: columnName, value: columnName }))"
                      @change="normalizeCustomerRows"
                    />
                  </template>
                  <template v-else-if="column.dataIndex === 'candidates'">
                    <a-space wrap>
                      <a-tag v-for="item in record.candidates" :key="item">
                        {{ item }}
                      </a-tag>
                    </a-space>
                  </template>
                  <template v-else>
                    <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                      <span class="cell-ellipsis">
                        {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                      </span>
                    </a-tooltip>
                  </template>
                </template>
              </a-table>
            </a-collapse-panel>
            <a-collapse-panel key="system" header="系统运单明细">
              <a-table
                row-key="id"
                size="small"
                :columns="simpleBillTableColumns"
                :data-source="filteredSystemRows"
                :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
                :scroll="{ x: simpleBillTableScrollX }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'freightAmount' || column.dataIndex === 'taxedFreight'">
                    <span font-600>{{ formatAmount(getMoneyCell(record, column.dataIndex)) }}</span>
                  </template>
                  <template v-else>
                    <a-tooltip :title="formatBillCell(record, column.dataIndex)">
                      <span class="cell-ellipsis">
                        {{ formatBillCell(record, column.dataIndex) }}
                      </span>
                    </a-tooltip>
                  </template>
                </template>
              </a-table>
            </a-collapse-panel>
            <a-collapse-panel key="customer" header="客户账单明细">
              <a-table
                row-key="id"
                size="small"
                :columns="simpleBillTableColumns"
                :data-source="customerRows"
                :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
                :scroll="{ x: simpleBillTableScrollX }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'freightAmount' || column.dataIndex === 'taxedFreight'">
                    <span font-600>{{ formatAmount(getMoneyCell(record, column.dataIndex)) }}</span>
                  </template>
                  <template v-else>
                    <a-tooltip :title="formatBillCell(record, column.dataIndex)">
                      <span class="cell-ellipsis">
                        {{ formatBillCell(record, column.dataIndex) }}
                      </span>
                    </a-tooltip>
                  </template>
                </template>
              </a-table>
            </a-collapse-panel>
          </a-collapse>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="history" tab="历史查询">
        <a-card class="bill-card" title="历史核对记录" :bordered="false">
          <a-form class="history-query" layout="vertical" :model="historyQuery">
            <a-row :gutter="[16, 8]">
              <a-col :xs="24" :md="8" :xl="5">
                <a-form-item label="客户名称">
                  <a-input v-model:value="historyQuery.customer" allow-clear placeholder="输入客户关键字" />
                </a-form-item>
              </a-col>
              <a-col :xs="24" :md="8" :xl="5">
                <a-form-item label="核对状态">
                  <a-select v-model:value="historyQuery.status" allow-clear :options="archiveStatusOptions.map(value => ({ label: value, value }))" />
                </a-form-item>
              </a-col>
              <a-col :xs="24" :md="8" :xl="7">
                <a-form-item label="保存时间">
                  <a-range-picker v-model:value="historyQuery.range" class="full-control" />
                </a-form-item>
              </a-col>
              <a-col :xs="24" :md="8" :xl="4">
                <a-form-item label=" ">
                  <a-button block @click="resetHistoryQuery">
                    重置
                  </a-button>
                </a-form-item>
              </a-col>
            </a-row>
          </a-form>

          <a-table
            row-key="id"
            :columns="archiveTableColumns"
            :data-source="filteredArchives"
            :loading="archiveLoading"
            :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
            :scroll="{ x: archiveTableScrollX }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'status'">
                <a-tag :color="statusColor(record.status)">
                  {{ record.status }}
                </a-tag>
              </template>
              <template v-else>
                <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                  <span class="cell-ellipsis">
                    {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                  </span>
                </a-tooltip>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>
    </a-tabs>
  </page-container>
</template>

<style scoped lang="less">
.bill-tabs {
  margin-top: 0;
}

.bill-card {
  margin-bottom: 16px;
  border-radius: var(--admin-radius);
  box-shadow: var(--admin-shadow-card);
}

.primary-workspace {
  :deep(.ant-card-body) {
    padding: 20px 24px;
  }
}

.section-label {
  margin-bottom: 12px;
  color: var(--admin-text);
  font-size: 14px;
  font-weight: 600;
}

.full-control {
  width: 100%;
}

.customer-select-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;

  :deep(.ant-select) {
    min-width: 0;
  }
}

.compact-upload {
  :deep(.ant-upload-drag) {
    height: 154px;
    border-radius: var(--admin-radius);
  }

  :deep(.ant-upload) {
    padding: 18px 14px;
  }

  :deep(.ant-upload-drag-icon) {
    margin-bottom: 8px;
  }

  :deep(.ant-upload-text) {
    margin-bottom: 4px;
    font-size: 14px;
    font-weight: 600;
  }
}

.bill-alert {
  margin-bottom: 16px;
}

.compare-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 154px;
  padding: 18px;
  background: var(--admin-surface-muted);
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
}

.compare-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  color: var(--admin-text-secondary);
  font-size: 14px;

  strong {
    color: var(--admin-text);
    font-size: 20px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
}

.reconciliation-steps {
  max-width: 960px;
}

.history-query {
  padding-bottom: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--admin-border-subtle);
}

.archive-card {
  :deep(.ant-descriptions-item-label) {
    color: var(--admin-text-secondary);
  }
}

@media (max-width: 768px) {
  .primary-workspace :deep(.ant-card-body) {
    padding: 16px;
  }

  .reconciliation-steps {
    :deep(.ant-steps-item-title) {
      font-size: 13px;
    }
  }

  .archive-card :deep(.ant-btn) {
    min-height: 32px;
  }

  .customer-select-row {
    grid-template-columns: 1fr;
  }
}
</style>

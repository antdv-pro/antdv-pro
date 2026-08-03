<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import type { Dayjs } from 'dayjs'
import { AppstoreOutlined, CarOutlined, DeleteOutlined, DollarOutlined, DownloadOutlined, EditOutlined, EyeOutlined, FileOutlined, InboxOutlined, PlusOutlined, SaveOutlined, SearchOutlined, SettingOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { Column, Pie } from '@antv/g2plot'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import BusinessDetailDrawer from '~@/components/business-detail-drawer/index.vue'
import { useBusinessDictionaries } from '~@/composables/business-dictionaries'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { nextTradeOrderStatus, tradeOrderMutationPermission } from '../../../../shared/business-status-rules'

interface TradeOrderRecord {
  code: string
  year: string
  month: string
  carrier: string
  plateNo: string
  vehicleNature: string
  plannedUnit: string
  loadingFactory: string
  loadingDate: string
  loadingTon: number
  unloadingTime: string
  receiver: string
  unloadingStation: string
  unloadingTon: number
  settlementTon: number
  liquidPrice: number
  payableTotal: number
  poundDiff: number
  freightSettlementTon: number
  distance: number
  tonKilometer: number
  freightTotal: number
  receivableLiquidPrice: number
  receivableLiquidTotal: number
  cargoLoss: number
  profit: number
  status: string
  attachmentName?: string
  attachmentUrl?: string
}

interface TradeOrderForm {
  code: string
  year: string
  month: string
  carrier: string
  plateNo: string
  vehicleNature: string
  plannedUnit: string
  loadingFactory: string
  loadingDate?: Dayjs
  loadingTon: number
  unloadingTime?: Dayjs
  receiver: string
  unloadingStation: string
  unloadingTon: number
  settlementTon: number
  liquidPrice: number
  payableTotal: number
  poundDiff: number
  freightSettlementTon: number
  distance: number
  tonKilometer: number
  freightTotal: number
  receivableLiquidPrice: number
  receivableLiquidTotal: number
  cargoLoss: number
  profit: number
  status: string
  attachmentName?: string
  attachmentUrl?: string
}

interface TradeOrderSummary {
  count: number
  loadingTon: number
  unloadingTon: number
  payableTotal: number
  receivableTotal: number
  profit: number
}

interface TradeOrderFacets {
  years: string[]
  statuses: string[]
  plateNos: string[]
}

interface TradeOrderPage {
  records: TradeOrderRecord[]
  total: number
  current: number
  pageSize: number
  summary: TradeOrderSummary
  facets: TradeOrderFacets
  analytics: TradeOrderAnalytics
}

interface TradeOrderAnalytics {
  statuses: Array<{ status: string, count: number, receivable: number, profit: number }>
  months: Array<{ month: string, receivable: number, payable: number, profit: number }>
  customers: Array<{ name: string, count: number, receivable: number, profit: number }>
}

interface TradeOrderFilterState {
  keyword: string
  year: string
  month: string
  status: string
  plateNo: string
}

interface TradeOrderSavedView {
  id: string
  name: string
  filters: TradeOrderFilterState
  visibleColumns: string[]
}

const savedViewsStorageKey = 'trade-orders:saved-views:v1'
const visibleColumnsStorageKey = 'trade-orders:visible-columns:v1'

const message = useMessage()
const businessDictionaries = useBusinessDictionaries()
const route = useRoute()
const linkedFinancialYear = String(route.query.financialYear || '')
const linkedFinancialMonth = Number(route.query.financialMonth || 0)

const queryModel = reactive<TradeOrderFilterState>({
  keyword: '',
  year: /^\d{4}$/.test(linkedFinancialYear) ? linkedFinancialYear : '全部年份',
  month: linkedFinancialMonth >= 1 && linkedFinancialMonth <= 12 ? `${linkedFinancialMonth}月` : '全部月份',
  status: '全部状态',
  plateNo: '全部车辆',
})
const modalOpen = ref(false)
const detailOpen = ref(false)
const detailRecord = ref<TradeOrderRecord>()
const submitting = ref(false)
const statusChanging = ref(false)
const editingCode = ref('')
const editingOriginalStatus = ref('')
const loading = ref(false)
const formRef = ref<FormInstance>()
const attachmentUploading = ref(false)
const tradeImporting = ref(false)

const tradeRows = ref<TradeOrderRecord[]>([])
const total = ref(0)
const summary = reactive<TradeOrderSummary>({ count: 0, loadingTon: 0, unloadingTon: 0, payableTotal: 0, receivableTotal: 0, profit: 0 })
const facets = reactive<TradeOrderFacets>({ years: [], statuses: [], plateNos: [] })
const analytics = reactive<TradeOrderAnalytics>({ statuses: [], months: [], customers: [] })
const monthChartContainer = ref<HTMLElement>()
const statusChartContainer = ref<HTMLElement>()
const monthChart = shallowRef<Column>()
const statusChart = shallowRef<Pie>()
let chartRenderTimer: ReturnType<typeof setTimeout> | undefined
const sortState = reactive({ field: 'loadingDate', order: 'descend' })
const tablePagination = reactive({
  current: 1,
  pageSize: 20,
  pageSizeOptions: ['10', '20', '50', '100', '200'],
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (value: number) => `共 ${value} 条`,
})
const savedViews = ref<TradeOrderSavedView[]>(loadStoredArray(savedViewsStorageKey).filter(isSavedView))
const activeViewId = ref('')
const saveViewOpen = ref(false)
const viewName = ref('')
const columnSettingsOpen = ref(false)

const formData = reactive<TradeOrderForm>(createEmptyForm())
const carrierOptions = computed(() => businessDictionaries.options('trade_carrier'))
const plannedUnitOptions = computed(() => businessDictionaries.options('trade_plan_unit'))
const vehicleNatureOptions = computed(() => businessDictionaries.options('trade_vehicle_nature'))
const statusOptions = computed(() => businessDictionaries.options('trade_order_status'))
const formStatusOptions = computed(() => {
  if (!editingCode.value)
    return statusOptions.value.filter(option => option.value === '待确认')
  const allowed = new Set([editingOriginalStatus.value, nextTradeOrderStatus(editingOriginalStatus.value)].filter(Boolean))
  return statusOptions.value.filter(option => allowed.has(String(option.value)))
})
const monthChartData = computed(() => analytics.months.flatMap(item => [
  { month: item.month, type: '应收', amount: Number((item.receivable / 10000).toFixed(2)) },
  { month: item.month, type: '应付及成本', amount: Number((item.payable / 10000).toFixed(2)) },
  { month: item.month, type: '利润', amount: Number((item.profit / 10000).toFixed(2)) },
]))
const loadingFactoryOptions = computed(() => businessDictionaries.options('trade_loading_factory'))
const formRules: Record<string, Rule[]> = {
  plateNo: [{ required: true, message: '请选择运输车号', trigger: 'change' }],
  carrier: [{ required: true, message: '请选择承运商', trigger: 'change' }],
  loadingDate: [{ required: true, message: '请选择装车日期', trigger: 'change' }],
  loadingTon: [{ required: true, type: 'number', min: 0.01, message: '装车吨位必须大于 0', trigger: 'change' }],
  unloadingTon: [{ required: true, type: 'number', min: 0.01, message: '卸车吨位必须大于 0', trigger: 'change' }],
  settlementTon: [{ required: true, type: 'number', min: 0.01, message: '结算吨位必须大于 0', trigger: 'change' }],
  liquidPrice: [{ required: true, type: 'number', min: 0.01, message: '液款单价必须大于 0', trigger: 'change' }],
}

const columns = [
  { title: '年份', dataIndex: 'year', width: 70, fixed: 'left' as const },
  { title: '月份', dataIndex: 'month', width: 70 },
  { title: '承运商', dataIndex: 'carrier', width: 90 },
  { title: '车号', dataIndex: 'plateNo', width: 110 },
  { title: '车辆性质', dataIndex: 'vehicleNature', width: 100 },
  { title: '计划单位', dataIndex: 'plannedUnit', width: 100 },
  { title: '装车液厂', dataIndex: 'loadingFactory', width: 150 },
  { title: '装车日期', dataIndex: 'loadingDate', width: 120 },
  { title: '装车吨位', dataIndex: 'loadingTon', width: 105 },
  { title: '卸车吨位', dataIndex: 'unloadingTon', width: 105 },
  { title: '结算吨位', dataIndex: 'settlementTon', width: 105 },
  { title: '液款单价', dataIndex: 'liquidPrice', width: 105 },
  { title: '应付总价', dataIndex: 'payableTotal', width: 120 },
  { title: '运费总价', dataIndex: 'freightTotal', width: 120 },
  { title: '应收液款总价', dataIndex: 'receivableLiquidTotal', width: 135 },
  { title: '利润', dataIndex: 'profit', width: 110 },
  { title: '操作', dataIndex: 'action', width: 132, fixed: 'right' as const },
]
const configurableColumns = columns.filter(column => column.dataIndex !== 'action')
const defaultVisibleColumnKeys = configurableColumns.map(column => column.dataIndex)
const storedVisibleColumns = loadStoredArray<string>(visibleColumnsStorageKey).filter(key => defaultVisibleColumnKeys.includes(key))
const visibleColumnKeys = ref<string[]>(storedVisibleColumns.length ? storedVisibleColumns : defaultVisibleColumnKeys)
const columnOptions = configurableColumns.map(column => ({ label: column.title, value: column.dataIndex }))
const tableColumns = computed(() => enhanceBusinessTableColumns(columns)
  .filter(column => column.dataIndex === 'action' || visibleColumnKeys.value.includes(String(column.dataIndex)))
  .map(column => column.dataIndex === 'action'
    ? column
    : {
        ...column,
        sorter: true,
        sortOrder: sortState.field === column.dataIndex ? sortState.order : undefined,
      }))
const tableScrollX = computed(() => createBusinessTableScrollX(tableColumns.value, 900))
const vehicleOptions = computed(() => ['全部车辆', ...facets.plateNos])
const vehicleSelectOptions = computed(() => facets.plateNos.map(value => ({ label: value, value })))
const yearOptions = computed(() => ['全部年份', ...facets.years])
const monthOptions = ['全部月份', ...Array.from({ length: 12 }, (_, index) => `${index + 1}月`)]
const statusFilterOptions = computed(() => ['全部状态', ...facets.statuses])

function loadStoredArray<T = TradeOrderSavedView>(key: string): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  }
  catch {
    return []
  }
}

function isSavedView(value: unknown): value is TradeOrderSavedView {
  if (!value || typeof value !== 'object')
    return false
  const candidate = value as Partial<TradeOrderSavedView>
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && !!candidate.filters
    && typeof candidate.filters === 'object'
    && Array.isArray(candidate.visibleColumns)
}

function persistSavedViews() {
  try {
    localStorage.setItem(savedViewsStorageKey, JSON.stringify(savedViews.value))
  }
  catch {
    message.warning('浏览器未允许保存常用视图')
  }
}

function requestFilters() {
  return {
    keyword: queryModel.keyword.trim(),
    year: queryModel.year === '全部年份' ? '' : queryModel.year,
    month: queryModel.month === '全部月份' ? '' : Number.parseInt(queryModel.month),
    status: queryModel.status === '全部状态' ? '' : queryModel.status,
    plateNo: queryModel.plateNo === '全部车辆' ? '' : queryModel.plateNo,
    sortField: sortState.field,
    sortOrder: sortState.order,
  }
}

function createEmptyForm(): TradeOrderForm {
  return {
    code: `MY${dayjs().format('YYYYMMDDHHmmss')}`,
    year: dayjs().format('YYYY'),
    month: `${dayjs().month() + 1}月`,
    carrier: '',
    plateNo: '',
    vehicleNature: '自有',
    plannedUnit: '',
    loadingFactory: '',
    loadingDate: undefined,
    loadingTon: 0,
    unloadingTime: undefined,
    receiver: '',
    unloadingStation: '',
    unloadingTon: 0,
    settlementTon: 0,
    liquidPrice: 0,
    payableTotal: 0,
    poundDiff: 0,
    freightSettlementTon: 0,
    distance: 0,
    tonKilometer: 0,
    freightTotal: 0,
    receivableLiquidPrice: 0,
    receivableLiquidTotal: 0,
    cargoLoss: 0,
    profit: 0,
    status: '待确认',
    attachmentName: undefined,
    attachmentUrl: undefined,
  }
}

function createRow(partial: Partial<TradeOrderRecord>) {
  const row = { ...createEmptyForm(), ...partial }
  row.profit = round(row.receivableLiquidTotal - row.payableTotal - row.freightTotal - row.cargoLoss)
  return normalizeRow(row as TradeOrderForm | TradeOrderRecord)
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function wan(value: number) {
  return `¥${(value / 10000).toFixed(2)}万`
}

function formatNumber(value: number, digits = 2) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function columnKey(dataIndex: unknown) {
  return Array.isArray(dataIndex) ? String(dataIndex[0] ?? '') : String(dataIndex ?? '')
}

function getNumberCell(record: Record<string, any>, dataIndex: unknown) {
  return Number(record[columnKey(dataIndex)] || 0)
}

function recalculate() {
  formData.payableTotal = round(formData.settlementTon * formData.liquidPrice)
  formData.freightTotal = round(formData.freightSettlementTon * formData.distance * formData.tonKilometer)
  formData.receivableLiquidTotal = round(formData.unloadingTon * formData.receivableLiquidPrice)
  formData.profit = round(formData.receivableLiquidTotal - formData.payableTotal - formData.freightTotal - formData.cargoLoss)
  formData.poundDiff = round(formData.loadingTon - formData.unloadingTon)
}

function openCreateModal() {
  editingCode.value = ''
  editingOriginalStatus.value = ''
  Object.assign(formData, createEmptyForm())
  modalOpen.value = true
}

function copyTradeOrder(record: TradeOrderRecord) {
  editingCode.value = ''
  editingOriginalStatus.value = ''
  Object.assign(formData, {
    ...record,
    code: `MY${dayjs().format('YYYYMMDDHHmmss')}`,
    year: dayjs().format('YYYY'),
    month: `${dayjs().month() + 1}月`,
    loadingDate: dayjs(),
    unloadingTime: undefined,
    status: '待确认',
  })
  recalculate()
  modalOpen.value = true
}

async function uploadTradeAttachment(file: File) {
  attachmentUploading.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const response = await fetch('/api/uploads', { method: 'POST', body })
    const result = await response.json()
    if (!response.ok || result.code !== 200)
      throw new Error(result.msg || '附件上传失败')
    formData.attachmentName = result.data.originalName
    formData.attachmentUrl = result.data.url
    message.success('附件上传成功')
  }
  catch (error: any) { message.error(error?.message || '附件上传失败') }
  finally { attachmentUploading.value = false }
  return false
}

const customerTemplateOptions = computed(() => analytics.customers.map(item => ({ label: item.name, value: item.name })))

function applyCustomerTemplate(value: unknown) {
  const selected = String(value || '')
  const recent = tradeRows.value.find(row => row.receiver === selected || row.plannedUnit === selected)
  if (!recent)
    return
  formData.receiver = recent.receiver
  formData.plannedUnit = recent.plannedUnit
  formData.unloadingStation = recent.unloadingStation
  formData.receivableLiquidPrice = recent.receivableLiquidPrice
  recalculate()
}

function openEditModal(record: TradeOrderRecord) {
  const permission = tradeOrderMutationPermission(record.status)
  if (!permission.allowed) {
    message.warning(permission.reason)
    return
  }
  editingCode.value = record.code
  editingOriginalStatus.value = record.status
  Object.assign(formData, {
    ...record,
    loadingDate: record.loadingDate ? dayjs(record.loadingDate) : undefined,
    unloadingTime: record.unloadingTime ? dayjs(record.unloadingTime) : undefined,
  })
  modalOpen.value = true
}

function openDetail(record: TradeOrderRecord) {
  detailRecord.value = record
  detailOpen.value = true
}

function tradeStatusColor(status: string) {
  if (status === '已结算')
    return 'success'
  if (status === '已确认')
    return 'processing'
  return 'warning'
}

async function advanceTradeStatus() {
  const record = detailRecord.value
  const nextStatus = record ? nextTradeOrderStatus(record.status) : undefined
  if (!record || !nextStatus)
    return
  statusChanging.value = true
  try {
    await saveTradeChanges([{ ...record, status: nextStatus }])
    detailRecord.value = { ...record, status: nextStatus }
    await loadTradeOrders()
    message.success(`订单已流转为${nextStatus}`)
  }
  catch (error: any) {
    message.error(error?.message || '状态流转失败')
  }
  finally {
    statusChanging.value = false
  }
}

function editDetailRecord() {
  if (!detailRecord.value)
    return
  const record = detailRecord.value
  detailOpen.value = false
  openEditModal(record)
}

async function loadTradeOrders(resetPage = false) {
  if (resetPage)
    tablePagination.current = 1
  loading.value = true
  try {
    const result = await useGet<TradeOrderPage>('/trade/orders', {
      current: tablePagination.current,
      pageSize: tablePagination.pageSize,
      ...requestFilters(),
    })
    if (result.code !== 200)
      throw new Error(result.msg || '贸易订单加载失败')
    const data = result.data
    tradeRows.value = (data?.records || []).map(row => createRow(row))
    total.value = Number(data?.total || 0)
    tablePagination.current = Number(data?.current || tablePagination.current)
    tablePagination.pageSize = Number(data?.pageSize || tablePagination.pageSize)
    Object.assign(summary, data?.summary || { count: 0, loadingTon: 0, unloadingTon: 0, payableTotal: 0, receivableTotal: 0, profit: 0 })
    Object.assign(facets, data?.facets || { years: [], statuses: [], plateNos: [] })
    Object.assign(analytics, data?.analytics || { statuses: [], months: [], customers: [] })
  }
  catch (error: any) {
    tradeRows.value = []
    total.value = 0
    message.error(error?.message || '贸易订单加载失败')
  }
  finally {
    loading.value = false
  }
}

function applyStatusChartFilter(status: string) {
  queryModel.status = status
  void loadTradeOrders(true)
}

function applyMonthChartFilter(month: string) {
  const [year, monthNo] = month.split('-')
  queryModel.year = year || '全部年份'
  queryModel.month = monthNo ? `${Number(monthNo)}月` : '全部月份'
  void loadTradeOrders(true)
}

function renderTradeCharts() {
  if (monthChartContainer.value) {
    if (!monthChart.value) {
      monthChart.value = new Column(monthChartContainer.value, {
        data: monthChartData.value,
        xField: 'month',
        yField: 'amount',
        seriesField: 'type',
        isGroup: true,
        height: 280,
        color: ['#1677ff', '#f59e0b', '#16a34a'],
        legend: { position: 'top-right' },
        xAxis: { label: { autoRotate: false, autoHide: true } },
        yAxis: { label: { formatter: value => `${value}万` } },
        tooltip: { formatter: datum => ({ name: datum.type, value: `¥${Number(datum.amount).toFixed(2)}万` }) },
      })
      monthChart.value.on('element:click', (event: any) => {
        const month = String(event?.data?.data?.month || '')
        if (month)
          applyMonthChartFilter(month)
      })
      monthChart.value.render()
    }
    else {
      monthChart.value.changeData(monthChartData.value)
    }
  }
  if (statusChartContainer.value) {
    if (!statusChart.value) {
      statusChart.value = new Pie(statusChartContainer.value, {
        data: analytics.statuses,
        angleField: 'count',
        colorField: 'status',
        radius: 0.86,
        innerRadius: 0.58,
        height: 280,
        legend: { position: 'bottom' },
        label: { type: 'outer', content: datum => `${datum.status} ${datum.count}单` },
        statistic: { title: false, content: false },
        tooltip: { formatter: datum => ({ name: datum.status, value: `${datum.count}单 · ${formatMoney(datum.receivable)}` }) },
      })
      statusChart.value.on('element:click', (event: any) => {
        const status = String(event?.data?.data?.status || '')
        if (status)
          applyStatusChartFilter(status)
      })
      statusChart.value.render()
    }
    else {
      statusChart.value.changeData(analytics.statuses)
    }
  }
}

watch([monthChartData, () => analytics.statuses], () => {
  if (chartRenderTimer)
    clearTimeout(chartRenderTimer)
  chartRenderTimer = setTimeout(() => nextTick(renderTradeCharts), 100)
}, { deep: true })

async function saveTradeChanges(upsert: TradeOrderRecord[] = [], deleteCodes: string[] = []) {
  const result = await usePut<TradeOrderRecord[]>('/trade/orders', { upsert, deleteCodes })
  if (result.code !== 200)
    throw new Error(result.msg || '贸易订单保存失败')
}

function tradeImportValue(row: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim())
      return row[key]
  }
  return ''
}

function downloadTradeImportTemplate() {
  const rows = [{
    订单编号: '',
    承运商: '',
    车号: '',
    车辆性质: '自有',
    计划单位: '',
    装车液厂: '',
    装车日期: '',
    装车吨位: '',
    接收单位: '',
    卸车站点: '',
    卸车吨位: '',
    结算吨位: '',
    液款单价: '',
    运费结算吨位: '',
    运距: '',
    吨公里价: '',
    应收液款单价: '',
    货损: '',
  }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '商品行批量录入')
  XLSX.writeFile(workbook, '贸易订单_商品行批量录入模板.xlsx')
}

async function importTradeRows(file: File) {
  tradeImporting.value = true
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const sourceRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
    const existingCodes = new Set(tradeRows.value.map(row => row.code))
    const errors: string[] = []
    const imported = sourceRows.flatMap((row, index) => {
      const loadingDateValue = tradeImportValue(row, '装车日期', '日期')
      const loadingDate = dayjs(loadingDateValue)
      const code = String(tradeImportValue(row, '订单编号', '订单号') || `MY${dayjs().format('YYYYMMDDHHmmss')}${index + 1}`).trim()
      const carrier = String(tradeImportValue(row, '承运商', '运输公司')).trim()
      const plateNo = String(tradeImportValue(row, '车号', '车牌号')).trim()
      const loadingTon = Number(tradeImportValue(row, '装车吨位'))
      const unloadingTon = Number(tradeImportValue(row, '卸车吨位'))
      if (!loadingDate.isValid() || !carrier || !plateNo || loadingTon <= 0 || unloadingTon <= 0) {
        errors.push(`第 ${index + 2} 行：装车日期、承运商、车号、装卸吨位必须有效`)
        return []
      }
      if (existingCodes.has(code)) {
        errors.push(`第 ${index + 2} 行：订单编号 ${code} 已存在`)
        return []
      }
      existingCodes.add(code)
      const settlementTon = Number(tradeImportValue(row, '结算吨位') || unloadingTon)
      const liquidPrice = Number(tradeImportValue(row, '液款单价'))
      const freightSettlementTon = Number(tradeImportValue(row, '运费结算吨位') || settlementTon)
      const distance = Number(tradeImportValue(row, '运距'))
      const tonKilometer = Number(tradeImportValue(row, '吨公里价', '吨/公里'))
      const receivableLiquidPrice = Number(tradeImportValue(row, '应收液款单价'))
      const cargoLoss = Number(tradeImportValue(row, '货损') || 0)
      return [createRow({
        code,
        year: loadingDate.format('YYYY'),
        month: `${loadingDate.month() + 1}月`,
        carrier,
        plateNo,
        vehicleNature: String(tradeImportValue(row, '车辆性质') || '自有'),
        plannedUnit: String(tradeImportValue(row, '计划单位')),
        loadingFactory: String(tradeImportValue(row, '装车液厂')),
        loadingDate: loadingDate.format('YYYY-MM-DD'),
        loadingTon,
        receiver: String(tradeImportValue(row, '接收单位', '客户')),
        unloadingStation: String(tradeImportValue(row, '卸车站点')),
        unloadingTon,
        settlementTon,
        liquidPrice,
        payableTotal: round(settlementTon * liquidPrice),
        poundDiff: round(loadingTon - unloadingTon),
        freightSettlementTon,
        distance,
        tonKilometer,
        freightTotal: round(freightSettlementTon * distance * tonKilometer),
        receivableLiquidPrice,
        receivableLiquidTotal: round(unloadingTon * receivableLiquidPrice),
        cargoLoss,
        status: '待确认',
      })]
    })
    if (errors.length)
      throw new Error(errors.slice(0, 8).join('；'))
    if (!imported.length)
      throw new Error('未识别到有效商品行')
    await saveTradeChanges(imported)
    await loadTradeOrders(true)
    message.success(`成功批量录入 ${imported.length} 条商品行`)
  }
  catch (error: any) {
    message.error(error?.message || '贸易商品行导入失败')
  }
  finally {
    tradeImporting.value = false
  }
  return false
}

async function submitTradeOrder() {
  if (submitting.value)
    return
  try {
    await formRef.value?.validate()
  }
  catch {
    message.warning('请检查标红的必填项')
    return
  }
  submitting.value = true
  try {
    const payload = normalizeRow(formData)
    const isUpdate = Boolean(editingCode.value)
    await saveTradeChanges([payload])
    modalOpen.value = false
    message.success(isUpdate ? '修改贸易订单成功' : '新增贸易订单成功')
    await loadTradeOrders(!isUpdate)
  }
  catch (error: any) {
    message.error(error?.message || '保存失败')
  }
  finally {
    submitting.value = false
  }
}

function normalizeRow(row: TradeOrderForm | TradeOrderRecord): TradeOrderRecord {
  const loadingDate = row.loadingDate ? dayjs(row.loadingDate) : null
  const unloadingTime = row.unloadingTime ? dayjs(row.unloadingTime) : null
  const normalized = {
    ...row,
    loadingDate: loadingDate?.isValid() ? loadingDate.format('YYYY/M/D') : '',
    unloadingTime: unloadingTime?.isValid() ? unloadingTime.format('YYYY/M/D HH:mm') : '',
    year: loadingDate?.isValid() ? loadingDate.format('YYYY') : row.year || dayjs().format('YYYY'),
    month: loadingDate?.isValid() ? `${loadingDate.month() + 1}月` : row.month || `${dayjs().month() + 1}月`,
  } as TradeOrderRecord

  if (normalized.settlementTon && normalized.liquidPrice)
    normalized.payableTotal = round(normalized.settlementTon * normalized.liquidPrice)
  if (normalized.freightSettlementTon && normalized.distance && normalized.tonKilometer)
    normalized.freightTotal = round(normalized.freightSettlementTon * normalized.distance * normalized.tonKilometer)
  if (normalized.unloadingTon && normalized.receivableLiquidPrice)
    normalized.receivableLiquidTotal = round(normalized.unloadingTon * normalized.receivableLiquidPrice)
  normalized.poundDiff = round(normalized.loadingTon - normalized.unloadingTon)
  normalized.profit = round(normalized.receivableLiquidTotal - normalized.payableTotal - normalized.freightTotal - normalized.cargoLoss)
  return normalized
}

async function exportRows() {
  const result = await useGet<TradeOrderRecord[]>('/trade/orders', { all: true, ...requestFilters() })
  if (result.code !== 200)
    return message.error(result.msg || '贸易订单导出失败')
  const rows = (result.data || []).map(row => createRow(row))
  if (!rows.length)
    return message.warning('当前筛选条件下暂无可导出数据')
  const worksheet = XLSX.utils.json_to_sheet(rows.map(row => ({
    年份: row.year,
    月份: row.month,
    承运商: row.carrier,
    车号: row.plateNo,
    车辆性质: row.vehicleNature,
    计划单位: row.plannedUnit,
    装车液厂: row.loadingFactory,
    装车日期: row.loadingDate,
    装车吨位: row.loadingTon,
    卸车吨位: row.unloadingTon,
    结算吨位: row.settlementTon,
    液款单价: row.liquidPrice,
    应付总价: row.payableTotal,
    运费总价: row.freightTotal,
    应收液款总价: row.receivableLiquidTotal,
    利润: row.profit,
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '贸易订单')
  XLSX.writeFile(workbook, `贸易订单_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
}

async function removeRow(record: TradeOrderRecord) {
  const permission = tradeOrderMutationPermission(record.status)
  if (!permission.allowed) {
    message.warning(permission.reason)
    return
  }
  const previous = tradeRows.value
  tradeRows.value = tradeRows.value.filter(row => row.code !== record.code)
  try {
    await saveTradeChanges([], [record.code])
    if (tradeRows.value.length === 0 && tablePagination.current > 1)
      tablePagination.current -= 1
    await loadTradeOrders()
    message.success('删除成功')
  }
  catch (error: any) {
    tradeRows.value = previous
    message.error(error?.message || '删除失败')
  }
}

function removeTableRow(record: Record<string, any>) {
  removeRow(record as TradeOrderRecord)
}

async function searchOrders() {
  activeViewId.value = ''
  await loadTradeOrders(true)
}

async function resetFilters() {
  queryModel.keyword = ''
  queryModel.year = '全部年份'
  queryModel.month = '全部月份'
  queryModel.status = '全部状态'
  queryModel.plateNo = '全部车辆'
  activeViewId.value = ''
  await loadTradeOrders(true)
}

async function handleTableChange(pagination: any, _filters: any, sorter: any) {
  tablePagination.current = Number(pagination?.current || 1)
  tablePagination.pageSize = Number(pagination?.pageSize || tablePagination.pageSize)
  const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter
  if (activeSorter?.field && activeSorter?.order) {
    sortState.field = String(activeSorter.field)
    sortState.order = String(activeSorter.order)
  }
  else {
    sortState.field = 'loadingDate'
    sortState.order = 'descend'
  }
  await loadTradeOrders()
}

function handleVisibleColumnsChange(values: Array<string | number | boolean>) {
  const nextValues = values.map(String)
  if (!nextValues.length) {
    message.warning('至少保留一列业务数据')
    return
  }
  visibleColumnKeys.value = nextValues
  try {
    localStorage.setItem(visibleColumnsStorageKey, JSON.stringify(nextValues))
  }
  catch {
    message.warning('浏览器未允许保存列设置')
  }
}

function resetVisibleColumns() {
  handleVisibleColumnsChange(defaultVisibleColumnKeys)
}

function openSaveView() {
  viewName.value = savedViews.value.find(view => view.id === activeViewId.value)?.name || ''
  saveViewOpen.value = true
}

function saveCurrentView() {
  const name = viewName.value.trim()
  if (!name)
    return message.warning('请输入视图名称')
  const existing = savedViews.value.find(view => view.name === name)
  const view: TradeOrderSavedView = {
    id: existing?.id || `view-${Date.now()}`,
    name,
    filters: { ...queryModel },
    visibleColumns: [...visibleColumnKeys.value],
  }
  savedViews.value = existing
    ? savedViews.value.map(item => item.id === existing.id ? view : item)
    : [...savedViews.value, view]
  activeViewId.value = view.id
  persistSavedViews()
  saveViewOpen.value = false
  message.success(existing ? '常用视图已更新' : '常用视图已保存')
}

async function applySavedView(value: unknown) {
  const viewId = typeof value === 'string' ? value : ''
  activeViewId.value = viewId
  const view = savedViews.value.find(item => item.id === viewId)
  if (!view)
    return
  Object.assign(queryModel, view.filters)
  handleVisibleColumnsChange(view.visibleColumns)
  await loadTradeOrders(true)
}

async function deleteActiveView() {
  if (!activeViewId.value)
    return
  savedViews.value = savedViews.value.filter(view => view.id !== activeViewId.value)
  activeViewId.value = ''
  persistSavedViews()
  message.success('常用视图已删除')
}

onMounted(async () => {
  await businessDictionaries.load()
  await loadTradeOrders()
  if (route.query.action === 'create')
    openCreateModal()
})

onBeforeUnmount(() => {
  if (chartRenderTimer)
    clearTimeout(chartRenderTimer)
  monthChart.value?.destroy()
  statusChart.value?.destroy()
})
</script>

<template>
  <page-container>
    <div class="trade-page">
      <div class="trade-header">
        <div class="trade-title">
          <span class="trade-title-icon">◇</span>
          <span>贸易管理</span>
        </div>
        <a-space wrap>
          <a-button @click="downloadTradeImportTemplate">
            下载批量模板
          </a-button>
          <a-upload :show-upload-list="false" accept=".xlsx,.xls" :before-upload="importTradeRows">
            <a-button :loading="tradeImporting">
              商品行批量录入
            </a-button>
          </a-upload>
          <a-button type="primary" size="large" @click="openCreateModal">
            <template #icon>
              <PlusOutlined />
            </template>
            新增记录
          </a-button>
        </a-space>
      </div>

      <a-row :gutter="[12, 12]" class="summary-row">
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card blue">
            <div>记录数</div><strong>{{ summary.count }}</strong>
          </div>
        </a-col>
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card slate">
            <div>装车吨位</div><strong>{{ formatNumber(summary.loadingTon) }}</strong>
          </div>
        </a-col>
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card slate">
            <div>卸车吨位</div><strong>{{ formatNumber(summary.unloadingTon) }}</strong>
          </div>
        </a-col>
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card orange">
            <div>应付总价</div><strong>{{ wan(summary.payableTotal) }}</strong>
          </div>
        </a-col>
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card green">
            <div>应收总价</div><strong>{{ wan(summary.receivableTotal) }}</strong>
          </div>
        </a-col>
        <a-col :xs="24" :md="8" :xl="4">
          <div class="metric-card emerald">
            <div>总利润</div><strong>{{ wan(summary.profit) }}</strong>
          </div>
        </a-col>
      </a-row>

      <section class="trade-analytics" aria-label="贸易经营图表">
        <div class="trade-chart-panel">
          <div class="trade-chart-heading">
            <div><h2>月度经营趋势</h2><p>当前筛选范围·最近 12 个财务月·单位：万元</p></div>
            <span>点击柱子筛选月份</span>
          </div>
          <div v-if="monthChartData.length" ref="monthChartContainer" class="trade-chart" />
          <a-empty v-else :image="false" description="当前筛选下暂无月度数据" />
        </div>
        <div class="trade-insight-panel">
          <div class="trade-chart-heading">
            <div><h2>订单结构</h2><p>状态分布与客户贡献</p></div>
          </div>
          <div v-if="analytics.statuses.length" ref="statusChartContainer" class="trade-status-chart" />
          <a-empty v-else :image="false" description="当前筛选下暂无状态数据" />
          <div v-if="analytics.customers.length" class="customer-ranking" role="list" aria-label="客户应收排行">
            <button v-for="(item, index) in analytics.customers.slice(0, 5)" :key="item.name" type="button" role="listitem" @click="queryModel.keyword = item.name; searchOrders()">
              <span>{{ index + 1 }}</span>
              <div><strong>{{ item.name }}</strong><small>{{ item.count }} 单 · 利润 {{ formatMoney(item.profit) }}</small></div>
              <b>{{ formatMoney(item.receivable) }}</b>
            </button>
          </div>
        </div>
      </section>

      <a-card class="filter-card" :bordered="false">
        <a-space wrap class="filter-space">
          <a-input v-model:value="queryModel.keyword" class="search-input" allow-clear placeholder="搜索公司/车号/单位...">
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input>
          <a-select v-model:value="queryModel.year" class="filter-select">
            <a-select-option v-for="item in yearOptions" :key="item" :value="item">
              {{ item }}
            </a-select-option>
          </a-select>
          <a-select v-model:value="queryModel.month" class="filter-select">
            <a-select-option v-for="item in monthOptions" :key="item" :value="item">
              {{ item }}
            </a-select-option>
          </a-select>
          <a-select v-model:value="queryModel.status" class="filter-select">
            <a-select-option v-for="item in statusFilterOptions" :key="item" :value="item">
              {{ item }}
            </a-select-option>
          </a-select>
          <a-select v-model:value="queryModel.plateNo" class="filter-select">
            <a-select-option v-for="item in vehicleOptions" :key="item" :value="item">
              {{ item }}
            </a-select-option>
          </a-select>
          <a-button type="primary" :loading="loading" @click="searchOrders">
            <template #icon>
              <SearchOutlined />
            </template>
            查询
          </a-button>
          <a-button :disabled="loading" @click="resetFilters">
            重置
          </a-button>
        </a-space>
        <a-space wrap class="view-actions">
          <a-select
            :value="activeViewId || undefined"
            class="saved-view-select"
            allow-clear
            placeholder="常用视图"
            :options="savedViews.map(view => ({ label: view.name, value: view.id }))"
            @change="applySavedView"
          />
          <a-button @click="openSaveView">
            <template #icon>
              <SaveOutlined />
            </template>
            保存视图
          </a-button>
          <a-popconfirm v-if="activeViewId" title="确定删除当前常用视图吗？" ok-type="danger" ok-text="删除" cancel-text="取消" @confirm="deleteActiveView">
            <a-tooltip title="删除当前视图">
              <a-button danger aria-label="删除当前视图">
                <DeleteOutlined />
              </a-button>
            </a-tooltip>
          </a-popconfirm>
          <a-popover v-model:open="columnSettingsOpen" trigger="click" placement="bottomRight">
            <template #content>
              <div class="column-settings">
                <div class="column-settings-header">
                  <strong>显示列</strong>
                  <a-button type="link" size="small" @click="resetVisibleColumns">
                    恢复默认
                  </a-button>
                </div>
                <a-checkbox-group :value="visibleColumnKeys" :options="columnOptions" @change="handleVisibleColumnsChange" />
              </div>
            </template>
            <a-tooltip title="列设置">
              <a-button aria-label="列设置">
                <SettingOutlined />
              </a-button>
            </a-tooltip>
          </a-popover>
          <a-button :loading="loading" @click="exportRows">
            <template #icon>
              <DownloadOutlined />
            </template>
            导出
          </a-button>
        </a-space>
      </a-card>

      <a-table
        class="trade-table"
        row-key="code"
        :columns="tableColumns"
        :data-source="tradeRows"
        :loading="loading"
        :pagination="{ ...tablePagination, total }"
        :scroll="{ x: tableScrollX }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'vehicleNature'">
            <a-tag color="blue">
              {{ record.vehicleNature }}
            </a-tag>
          </template>
          <template v-else-if="['loadingTon', 'unloadingTon', 'settlementTon'].includes(String(column.dataIndex))">
            <span :class="{ 'brown-text': columnKey(column.dataIndex) === 'settlementTon' }">{{ formatNumber(getNumberCell(record, column.dataIndex)) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'payableTotal'">
            <span class="orange-text">{{ formatMoney(record.payableTotal) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'freightTotal'">
            <span class="blue-text">{{ formatMoney(record.freightTotal) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'receivableLiquidTotal'">
            <span class="green-text">{{ formatMoney(record.receivableLiquidTotal) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'profit'">
            <span class="profit-text">{{ formatMoney(record.profit) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'action'">
            <a-space>
              <a-tooltip title="查看订单详情">
                <a-button type="text" aria-label="查看贸易订单" @click="openDetail(record as TradeOrderRecord)">
                  <EyeOutlined />
                </a-button>
              </a-tooltip>
              <template v-if="tradeOrderMutationPermission(record.status).allowed">
                <a-tooltip title="复制贸易订单">
                  <a-button type="text" aria-label="复制贸易订单" @click="copyTradeOrder(record as TradeOrderRecord)">
                    <SaveOutlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="编辑贸易订单">
                  <a-button type="text" aria-label="编辑贸易订单" @click="openEditModal(record as TradeOrderRecord)">
                    <EditOutlined />
                  </a-button>
                </a-tooltip>
                <a-popconfirm
                  :title="`确定删除贸易订单 ${record.code} 吗？`"
                  description="删除后将不再出现在订单列表中。"
                  ok-type="danger"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="removeTableRow(record)"
                >
                  <a-tooltip title="删除贸易订单">
                    <a-button type="text" danger aria-label="删除贸易订单">
                      <DeleteOutlined />
                    </a-button>
                  </a-tooltip>
                </a-popconfirm>
              </template>
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
    </div>

    <a-modal v-model:open="saveViewOpen" title="保存常用视图" ok-text="保存" cancel-text="取消" :width="480" @ok="saveCurrentView">
      <a-form layout="vertical">
        <a-form-item label="视图名称" required>
          <a-input v-model:value="viewName" :maxlength="30" placeholder="例如：本月待结算订单" @press-enter="saveCurrentView" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="modalOpen"
      :title="editingCode ? '编辑贸易订单' : '新增贸易订单'"
      :confirm-loading="submitting"
      width="calc(100vw - 96px)"
      :style="{ top: '16px', maxWidth: '1480px' }"
      :body-style="{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', padding: '24px 28px' }"
      :mask-closable="false"
      :closable="!submitting"
      :keyboard="!submitting"
      :cancel-button-props="{ disabled: submitting }"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitTradeOrder"
    >
      <a-form ref="formRef" :model="formData" :rules="formRules" layout="vertical" class="trade-form">
        <section class="form-section section-blue">
          <div class="section-title">
            <AppstoreOutlined />
            <span>交易主体</span>
          </div>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="常用客户模板">
                <a-select show-search allow-clear placeholder="选择后带出接收单位、站点和价格" :options="customerTemplateOptions" @change="applyCustomerTemplate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="车辆性质">
                <a-select v-model:value="formData.vehicleNature" :options="vehicleNatureOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="运输车号" name="plateNo">
                <a-select v-model:value="formData.plateNo" show-search allow-clear placeholder="请选择车号" :options="vehicleSelectOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="承运商" name="carrier">
                <a-select v-model:value="formData.carrier" show-search allow-clear placeholder="请输入运输公司" :options="carrierOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="计划单位">
                <a-select v-model:value="formData.plannedUnit" allow-clear placeholder="请输入计划单位" :options="plannedUnitOptions" />
              </a-form-item>
            </a-col>
          </a-row>
        </section>

        <section class="form-section section-green">
          <div class="section-title">
            <CarOutlined />
            <span>商品与装车</span>
          </div>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="装车液厂">
                <a-select v-model:value="formData.loadingFactory" allow-clear placeholder="请输入装车液厂" :options="loadingFactoryOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="装车日期" name="loadingDate">
                <a-date-picker v-model:value="formData.loadingDate" class="w-full" format="YYYY/M/D" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="装车吨位" name="loadingTon">
                <business-input-number v-model:value="formData.loadingTon" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="状态">
                <a-select v-model:value="formData.status" :options="formStatusOptions" />
              </a-form-item>
            </a-col>
          </a-row>
        </section>

        <section class="form-section section-yellow">
          <div class="section-title">
            <InboxOutlined />
            <span>物流与卸车</span>
          </div>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="卸车时间">
                <a-date-picker v-model:value="formData.unloadingTime" class="w-full" show-time format="YYYY/M/D HH:mm" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="接收单位">
                <a-input v-model:value="formData.receiver" placeholder="请输入接收单位" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="卸车站点">
                <a-input v-model:value="formData.unloadingStation" placeholder="请输入卸车站点" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="卸车吨位" name="unloadingTon">
                <business-input-number v-model:value="formData.unloadingTon" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
          </a-row>
        </section>

        <section class="form-section section-purple">
          <div class="section-title">
            <DollarOutlined />
            <span>结算与利润</span>
          </div>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="结算吨位" name="settlementTon">
                <business-input-number v-model:value="formData.settlementTon" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="液款单价" name="liquidPrice">
                <business-input-number v-model:value="formData.liquidPrice" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="应付总价（自动计算）">
                <business-input-number v-model:value="formData.payableTotal" class="w-full amount-payable" :precision="2" disabled />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="磅差">
                <business-input-number v-model:value="formData.poundDiff" class="w-full" :precision="2" disabled />
              </a-form-item>
            </a-col>
          </a-row>

          <a-divider orientation="left">
            运费计算
          </a-divider>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="运费结算吨位">
                <business-input-number v-model:value="formData.freightSettlementTon" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="运距">
                <business-input-number v-model:value="formData.distance" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="吨/公里">
                <business-input-number v-model:value="formData.tonKilometer" class="w-full" :min="0" :precision="4" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="运费总价">
                <business-input-number v-model:value="formData.freightTotal" class="w-full amount-freight" :precision="2" disabled />
              </a-form-item>
            </a-col>
          </a-row>

          <a-divider orientation="left">
            应收账款
          </a-divider>
          <a-row :gutter="24">
            <a-col :xs="24" :md="6">
              <a-form-item label="应收液款单价">
                <business-input-number v-model:value="formData.receivableLiquidPrice" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="应收液款总价">
                <business-input-number v-model:value="formData.receivableLiquidTotal" class="w-full amount-receivable" :precision="2" disabled />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="货损">
                <business-input-number v-model:value="formData.cargoLoss" class="w-full" :min="0" :precision="2" @change="recalculate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="6">
              <a-form-item label="利润">
                <business-input-number v-model:value="formData.profit" class="w-full amount-profit" :precision="2" disabled />
              </a-form-item>
            </a-col>
          </a-row>
        </section>
        <section class="form-section">
          <div class="section-title">
            <FileOutlined /><span>附件凭证</span>
          </div>
          <a-upload :show-upload-list="false" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" :before-upload="uploadTradeAttachment">
            <a-button :loading="attachmentUploading">
              <UploadOutlined />{{ formData.attachmentName ? '重新上传' : '上传附件' }}
            </a-button>
          </a-upload>
          <a v-if="formData.attachmentUrl" :href="formData.attachmentUrl" target="_blank" rel="noopener" class="trade-attachment-link"><FileOutlined />{{ formData.attachmentName }}</a>
        </section>
      </a-form>
    </a-modal>

    <BusinessDetailDrawer
      v-model:open="detailOpen"
      :title="detailRecord?.code || '贸易订单详情'"
      :subtitle="detailRecord ? `${detailRecord.carrier || '未填写承运商'} · ${detailRecord.plateNo || '未填写车号'}` : ''"
      :status="detailRecord?.status"
      :status-color="tradeStatusColor(detailRecord?.status || '')"
      :width="820"
    >
      <template v-if="detailRecord">
        <a-descriptions title="基础信息" bordered :column="2" size="small">
          <a-descriptions-item label="承运商">
            {{ detailRecord.carrier || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="车辆性质">
            {{ detailRecord.vehicleNature || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="运输车号">
            {{ detailRecord.plateNo || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="计划单位">
            {{ detailRecord.plannedUnit || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="装车液厂">
            {{ detailRecord.loadingFactory || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="装车日期">
            {{ detailRecord.loadingDate || '-' }}
          </a-descriptions-item>
        </a-descriptions>
        <a-descriptions v-if="detailRecord.attachmentUrl" title="附件" bordered :column="1" size="small">
          <a-descriptions-item label="订单附件">
            <a :href="detailRecord.attachmentUrl" target="_blank" rel="noopener"><FileOutlined />{{ detailRecord.attachmentName || '查看附件' }}</a>
          </a-descriptions-item>
        </a-descriptions>
        <a-divider />
        <a-descriptions title="运输数据" bordered :column="2" size="small">
          <a-descriptions-item label="装车吨位">
            {{ formatNumber(detailRecord.loadingTon) }}
          </a-descriptions-item>
          <a-descriptions-item label="卸车吨位">
            {{ formatNumber(detailRecord.unloadingTon) }}
          </a-descriptions-item>
          <a-descriptions-item label="结算吨位">
            {{ formatNumber(detailRecord.settlementTon) }}
          </a-descriptions-item>
          <a-descriptions-item label="磅差">
            {{ formatNumber(detailRecord.poundDiff) }}
          </a-descriptions-item>
          <a-descriptions-item label="卸车时间">
            {{ detailRecord.unloadingTime || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="卸车站点">
            {{ detailRecord.unloadingStation || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="接收单位" :span="2">
            {{ detailRecord.receiver || '-' }}
          </a-descriptions-item>
        </a-descriptions>
        <a-divider />
        <a-descriptions title="结算信息" bordered :column="2" size="small">
          <a-descriptions-item label="应付总价">
            ¥{{ formatMoney(detailRecord.payableTotal) }}
          </a-descriptions-item>
          <a-descriptions-item label="运费总价">
            ¥{{ formatMoney(detailRecord.freightTotal) }}
          </a-descriptions-item>
          <a-descriptions-item label="应收液款">
            ¥{{ formatMoney(detailRecord.receivableLiquidTotal) }}
          </a-descriptions-item>
          <a-descriptions-item label="货损">
            ¥{{ formatMoney(detailRecord.cargoLoss) }}
          </a-descriptions-item>
          <a-descriptions-item label="利润" :span="2">
            <strong class="profit-text">¥{{ formatMoney(detailRecord.profit) }}</strong>
          </a-descriptions-item>
        </a-descriptions>
      </template>
      <template v-if="detailRecord" #footer>
        <a-button @click="detailOpen = false">
          关闭
        </a-button>
        <a-button v-if="tradeOrderMutationPermission(detailRecord.status).allowed" @click="editDetailRecord">
          编辑
        </a-button>
        <a-button v-if="nextTradeOrderStatus(detailRecord.status)" type="primary" :loading="statusChanging" @click="advanceTradeStatus">
          {{ nextTradeOrderStatus(detailRecord.status) === '已确认' ? '确认订单' : '完成结算' }}
        </a-button>
      </template>
    </BusinessDetailDrawer>
  </page-container>
</template>

<style lang="less" scoped>
.trade-page {
  padding: 8px 0 24px;
}

.trade-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.trade-title {
  display: flex;
  gap: 10px;
  align-items: center;
  color: #172033;
  font-size: 24px;
  font-weight: 700;
}

.trade-title-icon {
  color: #0b63ce;
  font-size: 24px;
}

.summary-row {
  margin-bottom: 16px;
}

.trade-analytics {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(360px, 2fr);
  gap: 16px;
  margin-bottom: 16px;
}

.trade-chart-panel,
.trade-insight-panel {
  min-width: 0;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid #d9e2ef;
  border-radius: 8px;
}

.trade-chart-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;

  h2 {
    margin: 0;
    color: #172033;
    font-size: 16px;
    line-height: 1.5;
  }
  p,
  > span {
    margin: 2px 0 0;
    color: #64748b;
    font-size: 12px;
  }
}

.trade-chart,
.trade-status-chart {
  width: 100%;
  height: 280px;
}

.customer-ranking {
  margin-top: 4px;
  border-top: 1px solid #e2e8f0;

  button {
    display: grid;
    width: 100%;
    min-height: 46px;
    grid-template-columns: 24px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 6px 4px;
    color: #334155;
    font: inherit;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-bottom: 1px solid #eef2f7;

    &:hover,
    &:focus-visible {
      background: #f0f6ff;
      outline: 2px solid #91caff;
      outline-offset: -2px;
    }
    > span {
      color: #64748b;
      font-size: 12px;
      text-align: center;
    }
    strong,
    small {
      display: block;
    }
    small {
      margin-top: 2px;
      color: #64748b;
      font-size: 12px;
    }
    > b {
      color: #047857;
      font-size: 13px;
      white-space: nowrap;
    }
  }
}

.metric-card {
  min-height: 80px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #d9e2ef;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgb(15 23 42 / 5%);

  div {
    color: #718096;
    font-size: 14px;
  }

  strong {
    display: block;
    margin-top: 8px;
    color: #1f2937;
    font-size: 24px;
    line-height: 1.2;
  }
}

.metric-card.orange {
  strong {
    color: #c55310;
  }
}

.metric-card.green,
.metric-card.emerald {
  strong {
    color: #059669;
  }
}

.filter-card {
  margin-bottom: 16px;

  :deep(.ant-card-body) {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
  }
}

.search-input {
  width: 280px;
}

.filter-select {
  width: 130px;
}

.saved-view-select {
  width: 160px;
}

.view-actions {
  justify-content: flex-end;
}

.column-settings {
  width: 240px;
}

.column-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.column-settings :deep(.ant-checkbox-group) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}

.trade-table {
  overflow: hidden;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

@media (max-width: 1100px) {
  .trade-analytics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .trade-chart-panel,
  .trade-insight-panel {
    padding: 14px 12px;
  }
  .trade-chart-heading {
    flex-direction: column;
    gap: 2px;
  }
  .customer-ranking button {
    grid-template-columns: 22px minmax(0, 1fr);

    > b {
      grid-column: 2;
      text-align: left;
    }
  }
}

.orange-text {
  color: #d65a1f;
  font-weight: 700;
}

.blue-text {
  color: #3478f6;
  font-weight: 700;
}

.green-text,
.profit-text {
  color: #059669;
  font-weight: 700;
}

.brown-text {
  color: #b85f2c;
  font-weight: 600;
}

.trade-form {
  :deep(.ant-form-item-label > label) {
    color: #1f2937;
    font-size: 15px;
    font-weight: 600;
  }
}

.form-section {
  margin-bottom: 24px;
  padding: 22px 28px;
  background: #fff;
  border: 1px solid #d6e0ee;
  border-radius: 10px;
}

.section-title {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 18px;
  color: #1f5eff;
  font-size: 18px;
  font-weight: 700;
}

.section-green {
  .section-title {
    color: #009966;
  }
}

.section-yellow {
  .section-title {
    color: #c79a00;
  }
}

.section-purple {
  .section-title {
    color: #7c3aed;
  }
}

.amount-payable {
  :deep(.ant-input-number-input) {
    color: #c55310;
    background: #fff6ea;
  }
}

.amount-freight {
  :deep(.ant-input-number-input) {
    color: #2563eb;
    background: #eef4ff;
  }
}

@media (max-width: 1100px) {
  .filter-card :deep(.ant-card-body) {
    align-items: flex-start;
    flex-direction: column;
  }

  .view-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .trade-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .trade-header > .ant-btn {
    width: 100%;
  }

  .filter-space,
  .view-actions {
    width: 100%;
  }

  .search-input,
  .filter-select,
  .saved-view-select {
    width: 100%;
  }
}

.amount-receivable {
  :deep(.ant-input-number-input) {
    color: #15803d;
    background: #ecfdf3;
  }
}

.amount-profit {
  :deep(.ant-input-number-input) {
    color: #047857;
    background: #ecfdf5;
    font-weight: 700;
  }
}
</style>

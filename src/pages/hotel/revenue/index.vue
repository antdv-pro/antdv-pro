<script setup lang="ts">
import { DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { Column, Line } from '@antv/g2plot'
import dayjs from 'dayjs'
import BusinessDetailDrawer from '~@/components/business-detail-drawer/index.vue'
import { useBusinessDictionaries } from '~@/composables/business-dictionaries'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { financialPeriodKeyFromDate } from '../../../../shared/business-overview'

type FlowType = '收入' | '支出'

interface RevenueRecord {
  id: string
  date: string
  type: FlowType
  category: string
  amount: number
  paymentMethod: string
  handler: string
  remark: string
}

interface DailyRecord {
  date: string
  totalRooms: number
  occupiedRooms: number
  remark: string
  updatedAt?: string
}

interface DailyReport {
  date: string
  occupiedRooms: number
  occupancyRate: number
  roomRevenue: number
  otherIncome: number
  totalIncome: number
  totalExpense: number
  netIncome: number
  averageRoomRate: number
}

const message = useMessage()
const businessDictionaries = useBusinessDictionaries()
const route = useRoute()
const categories = computed(() => businessDictionaries.values('hotel_revenue_category'))
// Keep the shared dictionary editable, while presenting only categories that
// make sense for the currently selected flow type.
const incomeCategoryNames = new Set(['房费', '押金', '商品售卖', '其他收入', '其他'])
const expenseCategoryNames = new Set(['退款', '采购', '水电', '维修', '工资', '平台佣金', '其他支出', '其他'])
const paymentMethods = computed(() => businessDictionaries.values('hotel_payment_method'))
const totalRooms = computed(() => Math.max(1, Number(businessDictionaries.setting('hotel_setting', '总房量', '100')) || 100))
const linkedYear = Number(route.query.financialYear || 0)
const linkedMonth = Number(route.query.financialMonth || 0)
const linkedPeriodKey = linkedYear > 0 && linkedMonth >= 1 && linkedMonth <= 12 ? `${linkedYear}${String(linkedMonth).padStart(2, '0')}` : ''
const today = dayjs().format('YYYY-MM-DD')
const linkedDate = linkedPeriodKey
  ? (financialPeriodKeyFromDate(today) === linkedPeriodKey ? today : dayjs(`${linkedYear}-${String(linkedMonth).padStart(2, '0')}-25`).format('YYYY-MM-DD'))
  : today
const selectedDate = ref(linkedDate)
const records = ref<RevenueRecord[]>([])
const allRecords = ref<RevenueRecord[]>([])
const dailyRecords = ref<DailyRecord[]>([])
const loading = ref(false)
const saving = ref(false)
const entryModalOpen = ref(false)
const detailOpen = ref(false)
const detailRecord = ref<RevenueRecord>()
const editingRecordId = ref('')
const dailyForm = reactive({ occupiedRooms: 0, remark: '' })
const entryDailyForm = reactive({ occupiedRooms: 0, remark: '' })
const formData = reactive<Omit<RevenueRecord, 'id'>>({
  date: selectedDate.value,
  type: '收入',
  category: '房费',
  amount: 0,
  paymentMethod: '现金',
  handler: '',
  remark: '',
})
const categoriesForType = computed(() => {
  const names = formData.type === '收入' ? incomeCategoryNames : expenseCategoryNames
  const filtered = categories.value.filter(item => names.has(item))
  return filtered.length ? filtered : categories.value
})
watch(() => formData.type, () => {
  if (!categoriesForType.value.includes(formData.category))
    formData.category = categoriesForType.value[0] || ''
})

const columns = [
  { title: '日期', dataIndex: 'date', width: 112 },
  { title: '类型', dataIndex: 'type', width: 84 },
  { title: '分类', dataIndex: 'category', width: 108 },
  { title: '金额', dataIndex: 'amount', width: 120 },
  { title: '支付方式', dataIndex: 'paymentMethod', width: 112 },
  { title: '经手人', dataIndex: 'handler', width: 104 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
  { title: '操作', dataIndex: 'action', width: 108, fixed: 'right' as const },
]
const tableColumns = computed(() => enhanceBusinessTableColumns(columns))
const tableScrollX = computed(() => createBusinessTableScrollX(tableColumns.value, 950))
const historyRange = ref<'7' | '30' | 'all'>('30')
const revenueChartContainer = ref<HTMLElement>()
const occupancyChartContainer = ref<HTMLElement>()
const revenueChart = shallowRef<Column>()
const occupancyChart = shallowRef<Line>()
const sortedRecords = computed(() => [...records.value].sort((a, b) => b.date.localeCompare(a.date)))
const totalIncome = computed(() => sumByType(records.value, '收入'))
const totalExpense = computed(() => sumByType(records.value, '支出'))
const netIncome = computed(() => totalIncome.value - totalExpense.value)
const roomRevenue = computed(() => records.value.reduce((total, item) => total + (item.type === '收入' && item.category === '房费' ? Number(item.amount || 0) : 0), 0))
const incomeCount = computed(() => records.value.filter(item => item.type === '收入').length)
const occupancyRate = computed(() => dailyForm.occupiedRooms / totalRooms.value * 100)
const availableRooms = computed(() => totalRooms.value - dailyForm.occupiedRooms)
const averageRoomRate = computed(() => dailyForm.occupiedRooms ? roomRevenue.value / dailyForm.occupiedRooms : 0)
const revenuePerAvailableRoom = computed(() => totalRooms.value ? roomRevenue.value / totalRooms.value : 0)
const averageIncome = computed(() => incomeCount.value ? totalIncome.value / incomeCount.value : 0)
const paymentSummary = computed(() => paymentMethods.value.map(method => ({
  method,
  amount: records.value.reduce((total, item) => item.paymentMethod === method ? total + (item.type === '收入' ? item.amount : -item.amount) : total, 0),
})))
const dailyReports = computed<DailyReport[]>(() => {
  const dates = new Set([...allRecords.value.map(item => item.date), ...dailyRecords.value.map(item => item.date)])
  return [...dates].sort((a, b) => b.localeCompare(a)).map((date) => {
    const rows = allRecords.value.filter(item => item.date === date)
    const daily = dailyRecords.value.find(item => item.date === date)
    const occupiedRooms = daily?.occupiedRooms || 0
    const income = sumByType(rows, '收入')
    const expense = sumByType(rows, '支出')
    const rooms = rows.reduce((total, item) => total + (item.type === '收入' && item.category === '房费' ? Number(item.amount || 0) : 0), 0)
    return {
      date,
      occupiedRooms,
      occupancyRate: occupiedRooms / totalRooms.value * 100,
      roomRevenue: rooms,
      otherIncome: income - rooms,
      totalIncome: income,
      totalExpense: expense,
      netIncome: income - expense,
      averageRoomRate: occupiedRooms ? rooms / occupiedRooms : 0,
    }
  })
})
const visibleDailyReports = computed(() => {
  const rows = [...dailyReports.value].sort((a, b) => a.date.localeCompare(b.date))
  if (historyRange.value === 'all')
    return rows
  return rows.slice(-Number(historyRange.value))
})
const historyRevenueData = computed(() => visibleDailyReports.value.flatMap(item => [
  { date: item.date.slice(5), type: '总收入', amount: item.totalIncome },
  { date: item.date.slice(5), type: '总支出', amount: item.totalExpense },
  { date: item.date.slice(5), type: '净收入', amount: item.netIncome },
]))
const historyOccupancyData = computed(() => visibleDailyReports.value.map(item => ({
  date: item.date.slice(5),
  rate: Number(item.occupancyRate.toFixed(1)),
})))
const historyAverageOccupancy = computed(() => visibleDailyReports.value.length
  ? visibleDailyReports.value.reduce((total, item) => total + item.occupancyRate, 0) / visibleDailyReports.value.length
  : 0)
const historyAverageRoomRate = computed(() => {
  const occupied = visibleDailyReports.value.reduce((total, item) => total + item.occupiedRooms, 0)
  const revenue = visibleDailyReports.value.reduce((total, item) => total + item.roomRevenue, 0)
  return occupied ? revenue / occupied : 0
})
const historyNetIncome = computed(() => visibleDailyReports.value.reduce((total, item) => total + item.netIncome, 0))

function sumByType(rows: RevenueRecord[], type: FlowType) {
  return rows.filter(item => item.type === type).reduce((total, item) => total + Number(item.amount || 0), 0)
}

function formatMoney(value: number) {
  const prefix = value < 0 ? '-¥' : '¥'
  return `${prefix}${Math.abs(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function renderHistoryCharts() {
  if (!visibleDailyReports.value.length)
    return

  if (revenueChartContainer.value) {
    if (!revenueChart.value) {
      revenueChart.value = new Column(revenueChartContainer.value, {
        data: historyRevenueData.value,
        xField: 'date',
        yField: 'amount',
        seriesField: 'type',
        isGroup: true,
        height: 300,
        columnWidthRatio: 0.5,
        color: ['#2563eb', '#ef4444', '#16a34a'],
        xAxis: { label: { autoHide: true, autoRotate: false } },
        yAxis: {
          label: { formatter: value => `¥${Number(value).toLocaleString('zh-CN')}` },
          grid: { line: { style: { stroke: '#edf0f4' } } },
        },
        legend: { position: 'top-right' },
        tooltip: { formatter: datum => ({ name: datum.type, value: formatMoney(Number(datum.amount)) }) },
      })
      revenueChart.value.render()
    }
    else {
      revenueChart.value.changeData(historyRevenueData.value)
    }
  }

  if (occupancyChartContainer.value) {
    if (!occupancyChart.value) {
      occupancyChart.value = new Line(occupancyChartContainer.value, {
        data: historyOccupancyData.value,
        xField: 'date',
        yField: 'rate',
        height: 300,
        smooth: true,
        color: '#1677ff',
        point: { size: 3, shape: 'circle' },
        area: { style: { fill: 'l(270) 0:#ffffff 1:#dbeafe', fillOpacity: 0.65 } },
        xAxis: { label: { autoHide: true, autoRotate: false } },
        yAxis: {
          min: 0,
          max: 100,
          label: { formatter: value => `${value}%` },
          grid: { line: { style: { stroke: '#edf0f4' } } },
        },
        tooltip: { formatter: datum => ({ name: '入住率', value: `${Number(datum.rate).toFixed(1)}%` }) },
      })
      occupancyChart.value.render()
    }
    else {
      occupancyChart.value.changeData(historyOccupancyData.value)
    }
  }
}

function applyDailyRecord(date = selectedDate.value) {
  const daily = dailyRecords.value.find(item => item.date === date)
  dailyForm.occupiedRooms = daily?.occupiedRooms || 0
  dailyForm.remark = daily?.remark || ''
}

function applyEntryDailyRecord(date = formData.date) {
  const daily = dailyRecords.value.find(item => item.date === date)
  entryDailyForm.occupiedRooms = daily?.occupiedRooms || 0
  entryDailyForm.remark = daily?.remark || ''
}

async function loadData() {
  loading.value = true
  try {
    const [currentResult, allResult, dailyResult] = await Promise.all([
      useGet<RevenueRecord[]>('/hotel/revenue', { date: selectedDate.value }),
      useGet<RevenueRecord[]>('/hotel/revenue'),
      useGet<DailyRecord[]>('/hotel/daily'),
    ])
    if (currentResult.code !== 200 || allResult.code !== 200 || dailyResult.code !== 200)
      throw new Error(currentResult.msg || allResult.msg || dailyResult.msg || '酒店经营数据加载失败')
    records.value = currentResult.data || []
    allRecords.value = allResult.data || []
    dailyRecords.value = dailyResult.data || []
    applyDailyRecord()
  }
  catch (error: any) {
    message.error(error?.message || '酒店经营数据加载失败')
  }
  finally {
    loading.value = false
  }
}

async function changeDate() {
  await loadData()
  resetForm()
}

async function saveRecords(date: string, manageSaving = true, upsert: RevenueRecord[] = [], deleteIds: string[] = []) {
  if (manageSaving)
    saving.value = true
  try {
    const result = await usePut<RevenueRecord[]>('/hotel/revenue', { date, upsert, deleteIds })
    if (result.code !== 200)
      throw new Error(result.msg || '营业流水保存失败')
    if (date === selectedDate.value)
      records.value = result.data || []
    allRecords.value = [...(result.data || []), ...allRecords.value.filter(item => item.date !== date)]
  }
  finally {
    if (manageSaving)
      saving.value = false
  }
}

async function persistDaily(date: string, input = dailyForm) {
  const result = await usePut<DailyRecord>('/hotel/daily', {
    date,
    totalRooms: totalRooms.value,
    occupiedRooms: input.occupiedRooms,
    remark: input.remark,
  })
  if (result.code !== 200)
    throw new Error(result.msg || '每日房态保存失败')
  if (!result.data)
    throw new Error('每日房态保存结果为空')
  dailyRecords.value = [result.data, ...dailyRecords.value.filter(item => item.date !== date)]
}

function resetForm() {
  Object.assign(formData, {
    date: selectedDate.value,
    type: '收入',
    category: '房费',
    amount: 0,
    paymentMethod: '现金',
    handler: '',
    remark: '',
  })
}

function openEntryModal() {
  editingRecordId.value = ''
  resetForm()
  applyEntryDailyRecord(selectedDate.value)
  entryModalOpen.value = true
}

function openEditModal(record: RevenueRecord) {
  editingRecordId.value = record.id
  Object.assign(formData, {
    date: record.date,
    type: record.type,
    category: record.category,
    amount: record.amount,
    paymentMethod: record.paymentMethod,
    handler: record.handler,
    remark: record.remark,
  })
  applyEntryDailyRecord(record.date)
  entryModalOpen.value = true
}

function openDetail(record: RevenueRecord) {
  detailRecord.value = record
  detailOpen.value = true
}

function editDetailRecord() {
  if (!detailRecord.value)
    return
  const record = detailRecord.value
  detailOpen.value = false
  openEditModal(record)
}

function closeEntryModal() {
  if (!saving.value)
    entryModalOpen.value = false
}

async function saveRecord() {
  if (saving.value)
    return
  if (!formData.date)
    return message.warning('请选择日期')
  if (!formData.amount || Number(formData.amount) <= 0)
    return message.warning('请输入大于 0 的金额')
  if (!formData.handler.trim())
    return message.warning('请输入经手人')
  if (entryDailyForm.occupiedRooms < 0 || entryDailyForm.occupiedRooms > totalRooms.value)
    return message.warning(`入住房间应在 0 至 ${totalRooms.value} 之间`)
  const previous = records.value
  const originalDate = editingRecordId.value
    ? records.value.find(item => item.id === editingRecordId.value)?.date || selectedDate.value
    : ''
  const recordDate = formData.date
  const nextRecord: RevenueRecord = {
    id: editingRecordId.value || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ...formData,
    amount: Number(formData.amount),
    handler: formData.handler.trim(),
    remark: formData.remark.trim(),
  }
  saving.value = true
  try {
    await saveRecords(recordDate, false, [nextRecord])
    if (originalDate && originalDate !== recordDate)
      await saveRecords(originalDate, false, [], [nextRecord.id])
    await persistDaily(recordDate, entryDailyForm)
    const wasEditing = Boolean(editingRecordId.value)
    editingRecordId.value = ''
    resetForm()
    entryModalOpen.value = false
    if (selectedDate.value !== recordDate)
      selectedDate.value = recordDate
    message.success(wasEditing ? '流水已更新' : '流水已新增')
    await loadData()
  }
  catch (error: any) {
    records.value = previous
    message.error(error?.message || '新增失败')
  }
  finally {
    saving.value = false
  }
}

async function removeRecord(record: RevenueRecord) {
  const previous = records.value
  records.value = records.value.filter(item => item.id !== record.id)
  try {
    await saveRecords(record.date, true, [], [record.id])
    message.success('流水已删除')
  }
  catch (error: any) {
    records.value = previous
    message.error(error?.message || '删除失败')
  }
}

function removeTableRecord(record: Record<string, any>) {
  return removeRecord(record as RevenueRecord)
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function exportDailyCsv() {
  if (!records.value.length)
    return message.warning('当前日期暂无可导出的流水')
  downloadCsv(`酒店营业收支_${selectedDate.value}.csv`, [
    ['日期', '类型', '分类', '金额', '支付方式', '经手人', '备注'],
    ...sortedRecords.value.map(item => [item.date, item.type, item.category, item.amount.toFixed(2), item.paymentMethod, item.handler, item.remark]),
  ])
}

function exportReportCsv() {
  if (!dailyReports.value.length)
    return message.warning('暂无可导出的日报')
  downloadCsv('酒店经营日报.csv', [
    ['营业日期', '入住房间', '总房间', '入住率', '房费收入', '其他收入', '总收入', '总支出', '净收入', '平均房价'],
    ...dailyReports.value.map(item => [item.date, item.occupiedRooms, totalRooms.value, `${item.occupancyRate.toFixed(1)}%`, item.roomRevenue.toFixed(2), item.otherIncome.toFixed(2), item.totalIncome.toFixed(2), item.totalExpense.toFixed(2), item.netIncome.toFixed(2), item.averageRoomRate.toFixed(2)]),
  ])
}

watch([visibleDailyReports, historyRange], async () => {
  await nextTick()
  renderHistoryCharts()
}, { deep: true, flush: 'post' })

onMounted(async () => {
  await businessDictionaries.load()
  await loadData()
  await nextTick()
  renderHistoryCharts()
  if (route.query.action === 'create')
    openEntryModal()
})

onBeforeUnmount(() => {
  revenueChart.value?.destroy()
  occupancyChart.value?.destroy()
})
</script>

<template>
  <page-container>
    <div class="hotel-page">
      <header class="page-header">
        <div>
          <h1>酒店经营管理</h1>
          <p>按营业日登记房态与收支，统一查看入住率、平均房价和经营结果。</p>
        </div>
        <a-space wrap>
          <a-button type="primary" @click="openEntryModal">
            <PlusOutlined />流水与房态录入
          </a-button>
          <a-button @click="exportDailyCsv">
            <template #icon>
              <DownloadOutlined />
            </template>导出当日流水
          </a-button>
          <a-button @click="exportReportCsv">
            <template #icon>
              <DownloadOutlined />
            </template>导出经营日报
          </a-button>
        </a-space>
      </header>

      <section class="control-panel">
        <div class="control-field date-field">
          <span class="field-label">营业日期</span>
          <a-date-picker v-model:value="selectedDate" value-format="YYYY-MM-DD" :allow-clear="false" @change="changeDate" />
        </div>
        <div class="date-context">
          新增流水时可同步登记当日入住数，当前酒店总房量为 {{ totalRooms }} 间。
        </div>
      </section>

      <section class="metrics" aria-label="当日经营指标">
        <div class="occupancy-metric">
          <div class="metric-topline">
            <span>入住率</span><strong>{{ occupancyRate.toFixed(1) }}%</strong>
          </div>
          <a-progress :percent="occupancyRate" :show-info="false" :stroke-color="occupancyRate >= 80 ? '#16a34a' : '#2563eb'" />
          <div class="metric-foot">
            <span>已住 {{ dailyForm.occupiedRooms }} 间</span><span>空闲 {{ availableRooms }} 间</span>
          </div>
        </div>
        <div class="metric-item">
          <span>房费收入</span><strong>{{ formatMoney(roomRevenue) }}</strong><small>仅统计房费类收入</small>
        </div>
        <div class="metric-item">
          <span>平均房价</span><strong>{{ formatMoney(averageRoomRate) }}</strong><small>房费收入 ÷ 入住房间</small>
        </div>
        <div class="metric-item">
          <span>单房收益</span><strong>{{ formatMoney(revenuePerAvailableRoom) }}</strong><small>房费收入 ÷ 可售房总数</small>
        </div>
        <div class="metric-item">
          <span>总收入</span><strong>{{ formatMoney(totalIncome) }}</strong><small>平均每笔 {{ formatMoney(averageIncome) }}</small>
        </div>
        <div class="metric-item">
          <span>总支出</span><strong class="expense-text">{{ formatMoney(totalExpense) }}</strong><small>当日支出流水合计</small>
        </div>
        <div class="metric-item">
          <span>净收入</span><strong :class="{ 'expense-text': netIncome < 0 }">{{ formatMoney(netIncome) }}</strong><small>总收入减总支出</small>
        </div>
      </section>

      <section class="payment-section">
        <div class="section-heading">
          <div><h2>支付方式净额</h2><p>当前营业日各支付渠道收入减支出</p></div>
        </div>
        <div class="payment-list">
          <div v-for="item in paymentSummary" :key="item.method">
            <span>{{ item.method }}</span><strong :class="{ 'expense-text': item.amount < 0 }">{{ formatMoney(item.amount) }}</strong>
          </div>
        </div>
      </section>

      <section class="data-section history-section">
        <div class="history-header">
          <div>
            <h2>历史经营趋势</h2>
            <p>按营业日期查看收支变化和入住率走势，导出文件保留完整日报明细。</p>
          </div>
          <div class="history-actions">
            <a-segmented
              v-model:value="historyRange"
              :options="[
                { label: '近 7 天', value: '7' },
                { label: '近 30 天', value: '30' },
                { label: '全部', value: 'all' },
              ]"
            />
            <a-button @click="exportReportCsv">
              <template #icon>
                <DownloadOutlined />
              </template>导出数据
            </a-button>
          </div>
        </div>

        <template v-if="visibleDailyReports.length">
          <div class="history-summary">
            <div><span>统计天数</span><strong>{{ visibleDailyReports.length }} 天</strong></div>
            <div><span>平均入住率</span><strong>{{ historyAverageOccupancy.toFixed(1) }}%</strong></div>
            <div><span>平均房价</span><strong>{{ formatMoney(historyAverageRoomRate) }}</strong></div>
            <div><span>累计净收入</span><strong :class="{ 'expense-text': historyNetIncome < 0 }">{{ formatMoney(historyNetIncome) }}</strong></div>
          </div>
          <div class="history-charts">
            <div class="chart-panel">
              <div class="chart-title">
                <strong>经营收支趋势</strong><span>收入、支出与净收入对比</span>
              </div>
              <div ref="revenueChartContainer" class="history-chart" />
            </div>
            <div class="chart-panel">
              <div class="chart-title">
                <strong>入住率趋势</strong><span>每日已住房间占 {{ totalRooms }} 间总房量的比例</span>
              </div>
              <div ref="occupancyChartContainer" class="history-chart" />
            </div>
          </div>
        </template>
        <a-empty v-else description="保存每日房态或录入流水后，将在此生成经营趋势" class="history-empty" />
      </section>

      <section class="data-section">
        <div class="section-heading">
          <div><h2>当日流水明细</h2><p>{{ selectedDate }} 共 {{ sortedRecords.length }} 笔记录</p></div>
          <a-button type="primary" @click="openEntryModal">
            <template #icon>
              <PlusOutlined />
            </template>新增流水
          </a-button>
        </div>
        <a-table row-key="id" size="middle" :columns="tableColumns" :data-source="sortedRecords" :loading="loading" :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true }" :scroll="{ x: tableScrollX }">
          <template #emptyText>
            <a-empty description="当前日期暂无流水，请从上方录入" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'type'">
              <a-tag :color="record.type === '收入' ? 'green' : 'red'">
                {{ record.type }}
              </a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'amount'">
              <span :class="record.type === '收入' ? 'income-text' : 'expense-text'">{{ formatMoney(record.amount) }}</span>
            </template>
            <template v-else-if="column.dataIndex === 'action'">
              <a-space :size="4">
                <a-tooltip title="查看流水">
                  <a-button type="text" aria-label="查看流水" @click="openDetail(record as RevenueRecord)">
                    <EyeOutlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="编辑流水">
                  <a-button type="text" aria-label="编辑流水" @click="openEditModal(record as RevenueRecord)">
                    <EditOutlined />
                  </a-button>
                </a-tooltip>
                <a-popconfirm title="确定删除这笔流水吗？" ok-type="danger" ok-text="删除" cancel-text="取消" @confirm="removeTableRecord(record)">
                  <a-tooltip title="删除流水">
                    <a-button type="text" danger aria-label="删除流水">
                      <DeleteOutlined />
                    </a-button>
                  </a-tooltip>
                </a-popconfirm>
              </a-space>
            </template>
            <template v-else>
              <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                <span class="cell-ellipsis">{{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}</span>
              </a-tooltip>
            </template>
          </template>
        </a-table>
      </section>

      <a-modal
        v-model:open="entryModalOpen"
        :title="editingRecordId ? '编辑流水' : '新增流水'"
        :width="720"
        :mask-closable="!saving"
        :closable="!saving"
        :keyboard="!saving"
        :confirm-loading="saving"
        :cancel-button-props="{ disabled: saving }"
        ok-text="保存流水"
        cancel-text="取消"
        @ok="saveRecord"
        @cancel="closeEntryModal"
      >
        <p class="modal-description">
          {{ editingRecordId ? '更正' : '录入' }} {{ formData.date }} 的收入或支出，带 * 项为必填。
        </p>
        <a-form layout="vertical" class="entry-form">
          <div class="form-grid">
            <a-form-item label="日期" required>
              <a-date-picker v-model:value="formData.date" value-format="YYYY-MM-DD" format="YYYY-MM-DD" placeholder="请输入日期" :allow-clear="false" @change="applyEntryDailyRecord(formData.date)" />
            </a-form-item>
            <a-form-item label="类型" required>
              <a-segmented v-model:value="formData.type" :options="['收入', '支出']" block />
            </a-form-item>
            <a-form-item label="分类" required>
              <a-select v-model:value="formData.category" :placeholder="formData.type === '收入' ? '请选择收入分类' : '请选择支出分类'">
                <a-select-option v-for="item in categoriesForType" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="金额" required>
              <business-input-number v-model:value="formData.amount" :min="0" :precision="2" placeholder="0.00" />
            </a-form-item>
            <a-form-item label="支付方式" required>
              <a-select v-model:value="formData.paymentMethod">
                <a-select-option v-for="item in paymentMethods" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="经手人" required>
              <a-input v-model:value="formData.handler" placeholder="请输入经手人" />
            </a-form-item>
            <a-form-item label="备注">
              <a-input v-model:value="formData.remark" placeholder="选填" @press-enter="saveRecord" />
            </a-form-item>
            <div class="room-state-fields">
              <div class="conditional-heading">
                <strong>当日房态</strong>
                <span>与本笔流水使用同一营业日期</span>
              </div>
              <a-form-item label="入住房间" required>
                <div class="room-input-row">
                  <business-input-number v-model:value="entryDailyForm.occupiedRooms" :min="0" :max="totalRooms" :precision="0" />
                  <span class="room-capacity">/ {{ totalRooms }} 间</span>
                </div>
              </a-form-item>
              <a-form-item label="房态备注">
                <a-input v-model:value="entryDailyForm.remark" :maxlength="500" placeholder="例如停用房、团队入住等" />
              </a-form-item>
            </div>
          </div>
        </a-form>
      </a-modal>

      <BusinessDetailDrawer
        v-model:open="detailOpen"
        :title="detailRecord ? `${detailRecord.date} ${detailRecord.type}` : '酒店流水详情'"
        :subtitle="detailRecord ? detailRecord.category : ''"
        :status="detailRecord?.type"
        :status-color="detailRecord?.type === '收入' ? 'success' : 'error'"
        :width="680"
      >
        <a-descriptions v-if="detailRecord" title="流水信息" bordered :column="2" size="small">
          <a-descriptions-item label="营业日期">
            {{ detailRecord.date }}
          </a-descriptions-item>
          <a-descriptions-item label="收支分类">
            {{ detailRecord.category }}
          </a-descriptions-item>
          <a-descriptions-item label="金额">
            <strong :class="detailRecord.type === '收入' ? 'income-text' : 'expense-text'">{{ formatMoney(detailRecord.amount) }}</strong>
          </a-descriptions-item>
          <a-descriptions-item label="支付方式">
            {{ detailRecord.paymentMethod }}
          </a-descriptions-item>
          <a-descriptions-item label="经手人">
            {{ detailRecord.handler || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="备注">
            {{ detailRecord.remark || '-' }}
          </a-descriptions-item>
        </a-descriptions>
        <template v-if="detailRecord" #footer>
          <a-button @click="detailOpen = false">
            关闭
          </a-button>
          <a-button type="primary" @click="editDetailRecord">
            编辑流水
          </a-button>
        </template>
      </BusinessDetailDrawer>
    </div>
  </page-container>
</template>

<style scoped>
.hotel-page {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  min-height: 100%;
  padding: var(--space-xl);
  color: #172033;
  background: #f5f7fa;
}
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-xl);
  margin-bottom: var(--space-xl);
}
.page-header h1,
.section-heading h2 {
  margin: 0;
  color: #172033;
  letter-spacing: 0;
}
.page-header h1 {
  font-size: 24px;
  line-height: 32px;
}
.page-header p,
.section-heading p {
  margin: var(--space-xs) 0 0;
  color: #596579;
  font-size: 14px;
}
.control-panel {
  display: grid;
  grid-template-columns: 180px minmax(260px, 1fr);
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-lg);
  background: #fff;
  border: 1px solid #dfe4ec;
  border-radius: 8px;
}
.control-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}
.field-label {
  color: #364153;
  font-size: 13px;
  font-weight: 600;
}
.date-context {
  color: #667287;
  font-size: 13px;
  line-height: 20px;
}
.room-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.room-input-row :deep(.ant-input-number) {
  width: 100px;
}
.room-capacity {
  color: #596579;
  white-space: nowrap;
}
.metrics {
  display: grid;
  grid-template-columns: 1.45fr repeat(5, minmax(138px, 1fr));
  margin-top: var(--space-lg);
  overflow: hidden;
  background: #fff;
  border: 1px solid #dfe4ec;
  border-radius: 8px;
}
.metric-item,
.occupancy-metric {
  min-width: 0;
  padding: var(--space-lg);
}
.metric-item {
  display: flex;
  flex-direction: column;
  border-left: 1px solid #e8ecf2;
}
.metric-item span,
.metric-topline span {
  color: #596579;
  font-size: 13px;
  font-weight: 600;
}
.metric-item strong {
  margin-top: var(--space-sm);
  color: #172033;
  font-size: 20px;
  line-height: 28px;
  white-space: nowrap;
}
.metric-item small {
  margin-top: var(--space-xs);
  overflow: hidden;
  color: #778398;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.metric-topline,
.metric-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
.metric-topline strong {
  color: #2563eb;
  font-size: 24px;
}
.occupancy-metric :deep(.ant-progress) {
  margin: var(--space-sm) 0 var(--space-xs);
}
.metric-foot {
  color: #596579;
  font-size: 12px;
}
.payment-section,
.data-section {
  padding: var(--space-xl);
  background: #fff;
  border: 1px solid #dfe4ec;
  border-radius: 8px;
}
.payment-section {
  margin-top: var(--space-lg);
}
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-lg);
  margin-bottom: var(--space-lg);
}
.section-heading h2 {
  font-size: 16px;
  line-height: 24px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--space-lg);
}
.entry-form :deep(.ant-form-item) {
  margin-bottom: var(--space-lg);
}
.entry-form :deep(.ant-picker),
.entry-form :deep(.ant-select),
.entry-form :deep(.ant-input-number) {
  width: 100%;
}
.room-state-fields {
  display: grid;
  grid-column: span 2;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--space-lg);
  margin-top: var(--space-xs);
  padding: var(--space-lg);
  background: #f7f9fc;
  border-radius: 8px;
}
.conditional-heading {
  display: flex;
  grid-column: span 2;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}
.conditional-heading strong {
  color: #263247;
  font-size: 14px;
}
.conditional-heading span {
  color: #667287;
  font-size: 12px;
  text-align: right;
}
.room-state-fields :deep(.ant-form-item) {
  margin-bottom: 0;
}
.payment-list {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-lg);
}
.payment-list > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  min-height: 68px;
  padding: var(--space-md);
  background: #f7f8fa;
  border-radius: 6px;
}
.payment-list span {
  color: #596579;
}
.payment-list strong {
  color: #172033;
  font-size: 16px;
}
.modal-description {
  margin: 0 0 var(--space-lg);
  color: #596579;
  font-size: 14px;
}
.data-section {
  margin-top: var(--space-lg);
  padding-bottom: var(--space-lg);
}
.history-section {
  margin-bottom: 0;
}
.history-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-xl);
  margin-bottom: var(--space-xl);
}
.history-header h2 {
  margin: 0;
  color: #172033;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0;
}
.history-header p {
  margin: var(--space-xs) 0 0;
  color: #596579;
  font-size: 14px;
}
.history-actions {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-shrink: 0;
}
.history-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: var(--space-xl);
  overflow: hidden;
  background: #f7f8fa;
  border-radius: 8px;
}
.history-summary > div {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-lg);
  border-right: 1px solid #e5e9f0;
}
.history-summary > div:last-child {
  border-right: 0;
}
.history-summary span {
  color: #667287;
  font-size: 13px;
}
.history-summary strong {
  color: #172033;
  font-size: 18px;
  line-height: 26px;
}
.history-charts {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(360px, 1fr);
  gap: var(--space-xl);
}
.chart-panel {
  min-width: 0;
  padding: var(--space-lg);
  border: 1px solid #e5e9f0;
  border-radius: 8px;
}
.chart-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}
.chart-title strong {
  color: #263247;
  font-size: 14px;
}
.chart-title span {
  color: #778398;
  font-size: 12px;
  text-align: right;
}
.history-chart {
  width: 100%;
  height: 300px;
}
.history-empty {
  padding: 48px 0;
}
.income-text {
  color: #15803d;
  font-weight: 600;
}
.expense-text {
  color: #c2413b !important;
  font-weight: 600;
}
:deep(.ant-table-thead > tr > th) {
  color: #465267;
  font-weight: 600;
  background: #f7f8fa;
}
:deep(.ant-table-cell) {
  vertical-align: middle;
}
.cell-ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 1280px) {
  .metrics {
    grid-template-columns: repeat(3, 1fr);
  }
  .metric-item {
    border-top: 1px solid #e8ecf2;
  }
  .occupancy-metric {
    grid-column: span 2;
  }
  .payment-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .history-charts {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 960px) {
  .hotel-page {
    padding: var(--space-lg);
  }
  .page-header {
    flex-direction: column;
  }
  .control-panel {
    grid-template-columns: 180px 1fr;
  }
  .history-header {
    flex-direction: column;
  }
  .history-actions {
    width: 100%;
    justify-content: space-between;
  }
  .history-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .history-summary > div:nth-child(2) {
    border-right: 0;
  }
  .history-summary > div:nth-child(-n + 2) {
    border-bottom: 1px solid #e5e9f0;
  }
}
@media (max-width: 640px) {
  .hotel-page {
    padding: var(--space-md);
  }
  .control-panel,
  .metrics,
  .form-grid,
  .payment-list {
    grid-template-columns: 1fr;
  }
  .control-panel {
    gap: var(--space-md);
  }
  .occupancy-metric {
    grid-column: auto;
  }
  .room-state-fields {
    grid-column: auto;
    grid-template-columns: 1fr;
  }
  .conditional-heading {
    grid-column: auto;
    align-items: flex-start;
    flex-direction: column;
  }
  .conditional-heading span {
    text-align: left;
  }
  .room-state-fields :deep(.ant-form-item) {
    margin-bottom: var(--space-lg);
  }
  .room-state-fields :deep(.ant-form-item:last-child) {
    margin-bottom: 0;
  }
  .history-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .history-actions :deep(.ant-segmented),
  .history-actions .ant-btn {
    width: 100%;
  }
  .history-summary {
    grid-template-columns: 1fr;
  }
  .history-summary > div,
  .history-summary > div:nth-child(2) {
    border-right: 0;
    border-bottom: 1px solid #e5e9f0;
  }
  .history-summary > div:last-child {
    border-bottom: 0;
  }
  .chart-title {
    align-items: flex-start;
    flex-direction: column;
  }
  .chart-title span {
    text-align: left;
  }
  .chart-panel {
    padding: var(--space-md);
  }
  .metric-item {
    border-top: 1px solid #e8ecf2;
    border-left: 0;
  }
  .payment-section,
  .data-section {
    padding: var(--space-lg);
  }
}
</style>

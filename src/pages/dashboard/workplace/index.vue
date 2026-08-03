<script setup lang="ts">
import type { ApprovalTask } from '~@/api/approval'
import type { ExpiryWarningItem } from '~@/api/dashboard/expiry-warnings'
import { AimOutlined, AuditOutlined, CarOutlined, CloudOutlined, DollarOutlined, EnvironmentOutlined, PlusOutlined, ReloadOutlined, ShopOutlined, SwapOutlined, ThunderboltOutlined, ToolOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { getApprovalTodoApi } from '~@/api/approval'
import { getExpiryWarningsApi } from '~@/api/dashboard/expiry-warnings'
import { createFinancialMonthOptions, createFinancialYearOptions } from '~@/composables/financial-period-filter'
import {
  loadTransportOperationData,
  transportOperationError,
  transportOperationLoading,
  transportOrderRows,
} from '~@/composables/transport-operation-data'
import { getCurrentFinancialMonthRange } from '~@/utils/financialPeriod'
import { formatBigDataCloudAddress } from '~@/utils/gps-address'
import { computeBusinessOverview } from '../../../../shared/business-overview'

interface TradeOrderRecord {
  code: string
  loadingDate: string
  payableTotal: number
  freightTotal: number
  receivableLiquidTotal: number
  cargoLoss: number
  profit: number
  status: string
}

interface HotelRevenueRecord {
  date: string
  type: '收入' | '支出'
  category: string
  amount: number
}

interface HotelDailyRecord {
  date: string
  totalRooms: number
  occupiedRooms: number
}

defineOptions({ name: 'Workplace' })

const message = useMessage()
const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const approvalTasks = ref<ApprovalTask[]>([])
const tradeOrders = ref<TradeOrderRecord[]>([])
const hotelRevenue = ref<HotelRevenueRecord[]>([])
const hotelDaily = ref<HotelDailyRecord[]>([])
const expiryWarnings = ref<ExpiryWarningItem[]>([])
const expiryDetailOpen = ref(false)
const selectedExpiryCategory = ref<ExpiryWarningItem['category']>()
const currentFinancialMonth = getCurrentFinancialMonthRange()
const selectedFinancialYear = ref(Number(currentFinancialMonth.key.slice(0, 4)))
const selectedFinancialMonth = ref(Number(currentFinancialMonth.key.slice(4, 6)))
const financialYearOptions = createFinancialYearOptions(selectedFinancialYear.value)
const financialMonthOptions = computed(() => createFinancialMonthOptions(selectedFinancialYear.value))
const selectedPeriodLabel = computed(() => `${selectedFinancialYear.value}年${selectedFinancialMonth.value}月`)
const selectedModuleQuery = computed(() => ({
  financialYear: String(selectedFinancialYear.value),
  financialMonth: String(selectedFinancialMonth.value),
}))

watch(selectedFinancialYear, () => {
  if (!financialMonthOptions.value.some(option => option.value === selectedFinancialMonth.value))
    selectedFinancialMonth.value = 1
})

const todayText = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date())

const userName = computed(() => userStore.nickname || '企业管理员')
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6)
    return '夜深了'
  if (hour < 12)
    return '早上好'
  if (hour < 18)
    return '下午好'
  return '晚上好'
})
const userRole = computed(() => userStore.userInfo?.postName || userStore.userInfo?.roles?.[0] || '管理员')
const userId = computed(() => userStore.userInfo?.id || userStore.userInfo?.username || '1')
const weatherLoading = ref(false)
const weatherError = ref('')
const weather = ref<{ location: string, locationSource: string, temperature: number, weatherCode: number, min: number, max: number }>()
const weatherLocationStorageKey = 'dashboard:weather-location:v1'
const locationPickerOpen = ref(false)
const locationSearch = ref('')
const locationSearching = ref(false)
const locationOptions = ref<WeatherLocationOption[]>([])
let locationSearchTimer: ReturnType<typeof setTimeout> | undefined

interface WeatherLocation {
  latitude: number
  longitude: number
  location: string
}

interface WeatherLocationOption extends WeatherLocation {
  value: string
  label: string
}

function loadSavedWeatherLocation(): WeatherLocation | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(weatherLocationStorageKey) || 'null')
    return saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude) && saved.location ? saved : undefined
  }
  catch {
    return undefined
  }
}

const savedWeatherLocation = ref<WeatherLocation | undefined>(loadSavedWeatherLocation())

const weatherLabels: Record<number, string> = {
  0: '晴',
  1: '大致晴',
  2: '少云',
  3: '阴',
  45: '雾',
  48: '雾凇',
  51: '毛毛雨',
  53: '毛毛雨',
  55: '毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  80: '阵雨',
  81: '阵雨',
  82: '强阵雨',
  95: '雷雨',
  96: '雷雨伴冰雹',
  99: '雷雨伴冰雹',
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
  })
}

function compactLocation(parts: unknown[]) {
  return parts
    .map(value => String(value ?? '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .slice(0, 2)
    .join(' ')
}

async function getCoordinateLocation(latitude: number, longitude: number) {
  const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: 'zh' })
  try {
    const result = await useGet<{ location: string }>(`/weather/location?${query}`, undefined, { errorNotification: false })
    if (result.code === 200 && result.data?.location)
      return result.data.location
  }
  catch {}

  const fallbackResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`)
  if (!fallbackResponse.ok)
    throw new Error('地址解析服务暂不可用')
  const data = await fallbackResponse.json() as Record<string, any>
  const formatted = formatBigDataCloudAddress(data)
  return compactLocation(formatted.split(/\s+/)) || compactLocation([data.city, data.locality]) || '当前位置'
}

async function getNetworkPosition() {
  const response = await fetch('https://ipwho.is/')
  if (!response.ok)
    throw new Error('网络定位服务暂不可用')
  const data = await response.json()
  if (!data.success || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude))
    throw new Error('网络定位失败')
  return {
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    location: compactLocation([data.city, data.region]) || '当前位置',
  }
}

function searchWeatherLocations(value: string) {
  locationSearch.value = value
  if (locationSearchTimer)
    clearTimeout(locationSearchTimer)
  if (!value.trim()) {
    locationOptions.value = []
    return
  }
  locationSearchTimer = setTimeout(async () => {
    locationSearching.value = true
    try {
      const query = new URLSearchParams({ name: value.trim(), count: '8', language: 'zh', format: 'json' })
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${query}`)
      if (!response.ok)
        throw new Error('地区搜索服务暂不可用')
      const data = await response.json()
      locationOptions.value = (Array.isArray(data.results) ? data.results : []).map((item: Record<string, any>) => {
        const location = compactLocation([item.name, item.admin2 || item.admin1])
        const label = [item.name, item.admin2 || item.admin1, item.country].filter(Boolean).filter((part, index, parts) => parts.indexOf(part) === index).join(' · ')
        return {
          value: `${item.latitude},${item.longitude},${item.id}`,
          label,
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          location,
        }
      })
    }
    catch {
      locationOptions.value = []
      message.warning('地区搜索暂时不可用')
    }
    finally {
      locationSearching.value = false
    }
  }, 280)
}

function selectWeatherLocation(_value: unknown, option: unknown) {
  const selectedOption = option as WeatherLocationOption
  const selected = { latitude: selectedOption.latitude, longitude: selectedOption.longitude, location: selectedOption.location }
  savedWeatherLocation.value = selected
  localStorage.setItem(weatherLocationStorageKey, JSON.stringify(selected))
  locationSearch.value = ''
  locationPickerOpen.value = false
  void loadWeather()
}

function useDeviceWeather() {
  savedWeatherLocation.value = undefined
  localStorage.removeItem(weatherLocationStorageKey)
  locationPickerOpen.value = false
  void loadWeather(true)
}

async function loadWeather(ignoreSavedLocation = false) {
  weatherLoading.value = true
  weatherError.value = ''
  try {
    let latitude: number
    let longitude: number
    let location: string
    let locationSource: string
    if (!ignoreSavedLocation && savedWeatherLocation.value) {
      ({ latitude, longitude, location } = savedWeatherLocation.value)
      locationSource = '已选地区'
    }
    else {
      try {
        const position = await getPosition()
        latitude = position.coords.latitude
        longitude = position.coords.longitude
        locationSource = '设备定位'
        try {
          location = await getCoordinateLocation(latitude, longitude)
        }
        catch {
          location = '当前位置'
        }
      }
      catch {
        const networkPosition = await getNetworkPosition()
        latitude = networkPosition.latitude
        longitude = networkPosition.longitude
        locationSource = '网络参考'
        try {
          location = await getCoordinateLocation(latitude, longitude)
        }
        catch {
          location = networkPosition.location
        }
      }
    }
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`)
    if (!response.ok)
      throw new Error('天气服务暂不可用')
    const data = await response.json()
    weather.value = {
      location,
      locationSource,
      temperature: Math.round(data.current?.temperature_2m ?? 0),
      weatherCode: data.current?.weather_code ?? 0,
      min: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
      max: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
    }
  }
  catch {
    weatherError.value = '天气暂时无法获取'
  }
  finally {
    weatherLoading.value = false
  }
}
function amount(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function compactAmount(value: number) {
  const number = Number(value || 0)
  return Math.abs(number) >= 10000 ? `¥${(number / 10000).toFixed(1)}万` : amount(number)
}

function sum<T>(rows: T[], getter: (row: T) => number) {
  return rows.reduce((total, row) => total + Number(getter(row) || 0), 0)
}

const businessOverview = computed(() => computeBusinessOverview({
  periodKey: `${selectedFinancialYear.value}${String(selectedFinancialMonth.value).padStart(2, '0')}`,
  transportOrders: transportOrderRows.value,
  tradeOrders: tradeOrders.value,
  hotelRevenue: hotelRevenue.value,
  hotelDaily: hotelDaily.value,
}))
const transportFreight = computed(() => businessOverview.value.transport.freight)
const transportTaxedFreight = computed(() => businessOverview.value.transport.taxedFreight)
const transportVehicleCount = computed(() => businessOverview.value.transport.vehicleCount)
const tradeReceivable = computed(() => businessOverview.value.trade.receivable)
const tradePayable = computed(() => businessOverview.value.trade.payable)
const tradeProfit = computed(() => businessOverview.value.trade.profit)
const unsettledTradeCount = computed(() => businessOverview.value.trade.unsettledCount)
const hotelIncome = computed(() => businessOverview.value.hotel.income)
const hotelExpense = computed(() => businessOverview.value.hotel.expense)
const occupancyRate = computed(() => businessOverview.value.hotel.occupancyRate)
const latestHotelDaily = computed(() => businessOverview.value.hotel.hasDaily ? { date: businessOverview.value.hotel.latestDailyDate } : undefined)

const expiryWarningGroups = computed(() => {
  const groups = new Map<string, {
    category: ExpiryWarningItem['category']
    count: number
    nearestDays: number
    nearestDate: string
    route: string
    targets: Set<string>
  }>()

  expiryWarnings.value.forEach((item) => {
    const current = groups.get(item.category)
    if (!current) {
      groups.set(item.category, {
        category: item.category,
        count: 1,
        nearestDays: item.days,
        nearestDate: item.dueDate,
        route: item.route,
        targets: new Set([item.target]),
      })
      return
    }
    current.count += 1
    current.targets.add(item.target)
    if (item.days < current.nearestDays) {
      current.nearestDays = item.days
      current.nearestDate = item.dueDate
    }
  })

  return [...groups.values()].sort((a, b) => a.nearestDays - b.nearestDays)
})

const selectedExpiryWarnings = computed(() => expiryWarnings.value.filter(item => item.category === selectedExpiryCategory.value))
const selectedExpiryRoute = computed(() => ({
  path: selectedExpiryWarnings.value[0]?.route || '/transport/fees',
  query: selectedExpiryWarnings.value[0]?.query,
}))

function openExpiryDetail(category: ExpiryWarningItem['category']) {
  selectedExpiryCategory.value = category
  expiryDetailOpen.value = true
}

function expiryRowRoute(record: typeof expiryWarnings.value[number]) {
  return {
    path: record.route,
    query: record.query,
  }
}

function openExpiryRecord(record: typeof expiryWarnings.value[number]) {
  expiryDetailOpen.value = false
  router.push(expiryRowRoute(record))
}

function expiryRowProps(record: typeof expiryWarnings.value[number]) {
  return {
    class: 'expiry-clickable-row',
    tabindex: 0,
    onClick: () => openExpiryRecord(record),
    onKeydown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openExpiryRecord(record)
      }
    },
  }
}

function expiryDescription(days: number) {
  if (days < 0)
    return `已过期 ${Math.abs(days)} 天`
  if (days === 0)
    return '今天到期'
  return `${days} 天后到期`
}

const overviewItems = computed(() => [
  {
    key: 'approval',
    title: '业务审批',
    icon: AuditOutlined,
    route: '/oa-approval/todo',
    tone: 'approval',
    value: `${approvalTasks.value.length} 项`,
    label: '待我审批',
    metrics: [
      { label: '待审批金额', value: compactAmount(sum(approvalTasks.value, item => Number(item.instance?.amount || 0))) },
      { label: '最近提交', value: approvalTasks.value[0]?.instance?.submittedAt ? dayjs(approvalTasks.value[0].instance?.submittedAt).format('MM-DD HH:mm') : '暂无' },
      { label: '数据来源', value: '待我审批' },
    ],
  },
  {
    key: 'transport',
    title: '运输经营',
    icon: CarOutlined,
    route: { path: '/transport/operations', query: selectedModuleQuery.value },
    tone: 'transport',
    value: compactAmount(transportFreight.value),
    label: `${selectedPeriodLabel.value}运费总额`,
    metrics: [
      { label: '运输订单', value: `${businessOverview.value.transport.orderCount} 单` },
      { label: '运营车辆', value: `${transportVehicleCount.value} 辆` },
      { label: '税后运费', value: compactAmount(transportTaxedFreight.value) },
    ],
  },
  {
    key: 'trade',
    title: '贸易经营',
    icon: SwapOutlined,
    route: { path: '/trade/orders', query: selectedModuleQuery.value },
    tone: 'trade',
    value: compactAmount(tradeProfit.value),
    label: `${selectedPeriodLabel.value}贸易利润`,
    metrics: [
      { label: '贸易订单', value: `${businessOverview.value.trade.orderCount} 单` },
      { label: '应收金额', value: compactAmount(tradeReceivable.value) },
      { label: '应付金额', value: compactAmount(tradePayable.value) },
    ],
  },
  {
    key: 'hotel',
    title: '酒店经营',
    icon: ShopOutlined,
    route: { path: '/hotel/revenue', query: selectedModuleQuery.value },
    tone: 'hotel',
    value: compactAmount(hotelIncome.value - hotelExpense.value),
    label: `${selectedPeriodLabel.value}净收入`,
    metrics: [
      { label: '财务月收入', value: compactAmount(hotelIncome.value) },
      { label: '财务月支出', value: compactAmount(hotelExpense.value) },
      { label: '最新入住率', value: latestHotelDaily.value ? `${occupancyRate.value}%` : '暂无房态' },
    ],
  },
])

const quickActions = [
  { title: '新增运输订单', desc: '直接录入车辆、路线和运费', route: { path: '/transport/orders', query: { action: 'create' } }, icon: CarOutlined },
  { title: '新增规费', desc: '登记车辆规费和有效期', route: { path: '/transport/fees', query: { action: 'create' } }, icon: DollarOutlined },
  { title: '登记维保', desc: '记录车辆里程、项目和供应商', route: { path: '/transport/maintenance', query: { action: 'create' } }, icon: ToolOutlined },
  { title: '新增贸易订单', desc: '直接录入采购、销售与结算', route: { path: '/trade/orders', query: { action: 'create' } }, icon: SwapOutlined },
  { title: '新增酒店流水', desc: '快速登记收入、支出与房态', route: { path: '/hotel', query: { action: 'create' } }, icon: ShopOutlined },
  { title: '审批中心', desc: '处理待办、查看已办与我发起', route: '/oa-approval/center', icon: AuditOutlined },
]

const attentionItems = computed(() => [
  { label: '审批待办', value: approvalTasks.value.length, desc: approvalTasks.value.length ? '有业务流程等待处理' : '当前没有待审批事项', route: '/oa-approval/todo', tone: approvalTasks.value.length ? 'warning' : 'success' },
  { label: '贸易待结算', value: unsettledTradeCount.value, desc: unsettledTradeCount.value ? '请及时核对往来款项' : '贸易订单均已结算', route: '/trade/orders', tone: unsettledTradeCount.value ? 'warning' : 'success' },
  { label: '酒店入住率', value: `${occupancyRate.value}%`, desc: latestHotelDaily.value ? `${latestHotelDaily.value.date} 最新房态` : '尚未登记酒店房态', route: '/hotel/revenue', tone: occupancyRate.value < 40 ? 'warning' : 'success' },
])

async function loadDashboard() {
  loading.value = true
  const failures: string[] = []
  const results = await Promise.allSettled([
    getApprovalTodoApi(userId.value),
    useGet<TradeOrderRecord[]>('/trade/orders'),
    useGet<HotelRevenueRecord[]>('/hotel/revenue'),
    useGet<HotelDailyRecord[]>('/hotel/daily'),
    loadTransportOperationData({ force: true }),
    getExpiryWarningsApi(),
  ])

  if (results[0].status === 'fulfilled' && results[0].value.code === 200)
    approvalTasks.value = results[0].value.data || []
  else failures.push('审批')
  if (results[1].status === 'fulfilled' && results[1].value.code === 200)
    tradeOrders.value = results[1].value.data || []
  else failures.push('贸易')
  if (results[2].status === 'fulfilled' && results[2].value.code === 200)
    hotelRevenue.value = results[2].value.data || []
  else failures.push('酒店流水')
  if (results[3].status === 'fulfilled' && results[3].value.code === 200)
    hotelDaily.value = results[3].value.data || []
  else failures.push('酒店房态')
  if (results[4].status === 'rejected' || transportOperationError.value)
    failures.push('运输')
  if (results[5].status === 'fulfilled' && results[5].value.code === 200)
    expiryWarnings.value = results[5].value.data || []
  else failures.push('到期预警')

  loading.value = false
  if (failures.length)
    message.warning(`${failures.join('、')}数据暂未完整加载`)
}

onMounted(() => {
  loadDashboard()
  loadWeather()
})
</script>

<template>
  <page-container>
    <template #content>
      <div class="home-header">
        <div>
          <span class="date-line">{{ todayText }}</span>
          <h1>{{ greeting }}，{{ userRole }} {{ userName }}</h1>
          <p>审批、运输、贸易与酒店业务集中呈现，优先处理待办和异常。</p>
        </div>
        <div class="home-header-actions">
          <div class="weather-chip" :class="{ 'is-loading': weatherLoading }" aria-live="polite">
            <template v-if="weather">
              <a-popover v-model:open="locationPickerOpen" trigger="click" placement="bottomLeft" overlay-class-name="weather-location-popover">
                <button
                  class="weather-location"
                  type="button"
                  title="选择天气地区"
                  :disabled="weatherLoading"
                >
                  <EnvironmentOutlined />
                  <span>{{ weather.location }}</span>
                  <small>{{ weather.locationSource }}</small>
                </button>
                <template #content>
                  <div class="weather-location-picker">
                    <a-auto-complete
                      v-model:value="locationSearch"
                      :options="locationOptions"
                      :loading="locationSearching"
                      placeholder="搜索城市或区县"
                      :filter-option="false"
                      @search="searchWeatherLocations"
                      @select="selectWeatherLocation"
                    />
                    <a-button block @click="useDeviceWeather">
                      <template #icon>
                        <AimOutlined />
                      </template>
                      使用设备定位
                    </a-button>
                  </div>
                </template>
              </a-popover>
              <span class="weather-divider" aria-hidden="true" />
              <span class="weather-icon" :class="`is-code-${weather.weatherCode}`" aria-hidden="true">
                <ThunderboltOutlined v-if="weather.weatherCode >= 95" />
                <CloudOutlined v-else-if="weather.weatherCode >= 2" />
                <span v-else class="weather-sun" />
              </span>
              <strong class="weather-temperature">{{ weather.temperature }}°</strong>
              <span class="weather-condition">{{ weatherLabels[weather.weatherCode] || '天气' }}</span>
              <span class="weather-range"><small>低</small>{{ weather.min }}° <small>高</small>{{ weather.max }}°</span>
            </template>
            <template v-else>
              <EnvironmentOutlined />
              <span>{{ weatherError || '正在获取当地天气' }}</span>
            </template>
          </div>
          <a-button :loading="loading || transportOperationLoading" @click="loadDashboard">
            <template #icon>
              <ReloadOutlined />
            </template>
            刷新数据
          </a-button>
        </div>
      </div>
    </template>

    <a-alert v-if="transportOperationError" class="load-alert" type="warning" show-icon message="部分运输数据暂不可用" :description="transportOperationError" />

    <div class="overview-toolbar" aria-label="经营数据财务期间筛选">
      <div>
        <strong>经营数据</strong>
        <span>按财务期间汇总，财务月为上月 26 日至本月 25 日</span>
      </div>
      <div class="period-selectors">
        <label for="dashboard-financial-year">财务年</label>
        <a-select
          id="dashboard-financial-year"
          v-model:value="selectedFinancialYear"
          class="period-select"
          :options="financialYearOptions"
          aria-label="财务年"
        />
        <label for="dashboard-financial-month">财务月</label>
        <a-select
          id="dashboard-financial-month"
          v-model:value="selectedFinancialMonth"
          class="period-select"
          :options="financialMonthOptions"
          aria-label="财务月"
        />
      </div>
    </div>

    <section class="overview-grid" aria-label="业务经营总览">
      <router-link v-for="item in overviewItems" :key="item.key" :to="item.route" class="overview-item" :class="`is-${item.tone}`">
        <div class="overview-heading">
          <span class="module-icon"><component :is="item.icon" /></span>
          <strong>{{ item.title }}</strong>
          <span class="enter-link">进入模块</span>
        </div>
        <div class="primary-metric">
          <b>{{ item.value }}</b>
          <span>{{ item.label }}</span>
        </div>
        <div class="metric-pair">
          <div v-for="metric in item.metrics" :key="metric.label">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
          </div>
        </div>
      </router-link>
    </section>

    <section class="workspace-section" aria-labelledby="workspace-title">
      <div class="section-heading">
        <div>
          <h2 id="workspace-title">
            今日工作台
          </h2>
          <p>先处理待办与风险，再核对经营数据</p>
        </div>
        <span>{{ approvalTasks.length + expiryWarnings.length }} 项待关注</span>
      </div>

      <div class="workspace-grid">
        <main class="main-stack">
          <a-card title="常用入口" class="section-card main-quick-card" :bordered="false">
            <div class="quick-list">
              <router-link v-for="item in quickActions" :key="item.title" :to="item.route" class="quick-item">
                <span class="quick-icon"><component :is="item.icon" /></span>
                <div><strong>{{ item.title }}</strong><small>{{ item.desc }}</small></div>
                <PlusOutlined v-if="item.title.startsWith('新增')" class="quick-create-icon" />
              </router-link>
            </div>
          </a-card>

          <a-card class="section-card expiry-card" :bordered="false" :loading="loading">
            <template #title>
              <span class="expiry-title">到期预警 <a-badge v-if="expiryWarnings.length" :count="expiryWarnings.length" /></span>
            </template>
            <div v-if="expiryWarningGroups.length" class="expiry-group-list">
              <button v-for="item in expiryWarningGroups" :key="item.category" type="button" class="expiry-group-item" @click="openExpiryDetail(item.category)">
                <div>
                  <strong>{{ item.category }}</strong>
                  <small>{{ item.targets.size }} 个对象 · 最近 {{ item.nearestDate }}</small>
                </div>
                <span class="group-count">{{ item.count }} 项</span>
                <b>{{ expiryDescription(item.nearestDays) }}</b>
              </button>
            </div>
            <a-empty v-else :image="false" description="暂无已过期或未来 30 天内到期记录" />
          </a-card>

          <a-card title="资金概览" class="section-card finance-card" :bordered="false" :loading="loading">
            <template #extra>
              <span class="card-note">基于当前已录入数据</span>
            </template>
            <div class="finance-table">
              <div class="finance-row finance-head">
                <span>业务</span><span>收入 / 应收</span><span>成本 / 应付</span><span>利润 / 净额</span>
              </div>
              <router-link to="/transport/operations" class="finance-row">
                <strong>运输</strong><span>{{ compactAmount(transportFreight) }}</span><span>进入运营台查看</span><b>查看明细</b>
              </router-link>
              <router-link to="/trade/orders" class="finance-row">
                <strong>贸易</strong><span>{{ compactAmount(tradeReceivable) }}</span><span>{{ compactAmount(tradePayable) }}</span><b :class="{ negative: tradeProfit < 0 }">{{ compactAmount(tradeProfit) }}</b>
              </router-link>
              <router-link to="/hotel/revenue" class="finance-row">
                <strong>酒店（{{ selectedFinancialMonth }}月）</strong><span>{{ compactAmount(hotelIncome) }}</span><span>{{ compactAmount(hotelExpense) }}</span><b :class="{ negative: hotelIncome - hotelExpense < 0 }">{{ compactAmount(hotelIncome - hotelExpense) }}</b>
              </router-link>
            </div>
          </a-card>
        </main>

        <aside class="side-stack">
          <a-card title="待我审批" class="section-card approval-card" :bordered="false" :loading="loading">
            <template #extra>
              <router-link to="/oa-approval/center">
                查看全部审批
              </router-link>
            </template>
            <a-list v-if="approvalTasks.length" :data-source="approvalTasks.slice(0, 6)" class="approval-list">
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta>
                    <template #title>
                      <router-link to="/oa-approval/todo">
                        {{ item.instance?.title || item.nodeName }}
                      </router-link>
                    </template>
                    <template #description>
                      {{ item.instance?.applicantName || '业务申请人' }} · {{ item.nodeName }} · {{ dayjs(item.instance?.submittedAt).format('MM-DD HH:mm') }}
                    </template>
                  </a-list-item-meta>
                  <div class="approval-amount">
                    <strong>{{ item.instance?.amount ? compactAmount(item.instance.amount) : '无需金额' }}</strong>
                    <a-tag color="orange">
                      待审批
                    </a-tag>
                  </div>
                </a-list-item>
              </template>
            </a-list>
            <a-empty v-else :image="false" description="当前没有待审批事项">
              <router-link to="/oa-approval/center">
                <a-button>查看审批记录</a-button>
              </router-link>
            </a-empty>
          </a-card>

          <a-card title="需要关注" class="section-card" :bordered="false">
            <router-link v-for="item in attentionItems" :key="item.label" :to="item.route" class="attention-item">
              <span class="status-dot" :class="`is-${item.tone}`" />
              <div><strong>{{ item.label }}</strong><small>{{ item.desc }}</small></div>
              <b>{{ item.value }}</b>
            </router-link>
          </a-card>
        </aside>
      </div>
    </section>

    <a-modal v-model:open="expiryDetailOpen" :title="`${selectedExpiryCategory || ''}到期明细`" width="760px" :body-style="{ padding: '0' }">
      <div class="expiry-detail-summary">
        <span>包含已过期和未来 30 天内到期记录</span>
        <strong>{{ selectedExpiryWarnings.length }} 项</strong>
      </div>
      <a-table
        class="expiry-detail-table"
        :data-source="selectedExpiryWarnings"
        :pagination="false"
        :row-key="(record: ExpiryWarningItem) => record.key"
        :custom-row="expiryRowProps"
        size="middle"
        :scroll="{ y: 420 }"
      >
        <a-table-column title="车辆 / 对象" data-index="target" :width="160" />
        <a-table-column title="到期项目" data-index="title" :width="160" />
        <a-table-column title="到期日期" data-index="dueDate" :width="140" />
        <a-table-column title="剩余时间" :width="130">
          <template #default="{ record }">
            <a-tag :color="record.days < 0 ? 'red' : record.days <= 7 ? 'orange' : 'blue'">
              {{ expiryDescription(record.days) }}
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="来源" data-index="source" :width="110" />
      </a-table>
      <template #footer>
        <a-button @click="expiryDetailOpen = false">
          关闭
        </a-button>
        <router-link :to="selectedExpiryRoute" @click="expiryDetailOpen = false">
          <a-button type="primary">
            进入对应模块
          </a-button>
        </router-link>
      </template>
    </a-modal>
  </page-container>
</template>

<style scoped lang="less">
.home-header {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
  h1 {
    margin: 4px 0 5px;
    color: var(--admin-text);
    font-size: 22px;
    font-weight: 650;
    line-height: 1.4;
  }
  p {
    margin: 0;
    color: var(--admin-muted);
  }
}
.home-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.weather-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  background: var(--admin-surface-muted);
  color: var(--admin-text-secondary);
  font-size: 13px;
  white-space: nowrap;
}
.weather-location {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 3px 0;
  border: 0;
  background: transparent;
  color: var(--admin-text-secondary);
  cursor: pointer;
  transition: color 0.18s ease;
  &:hover {
    color: var(--admin-primary);
  }
  &:disabled {
    cursor: wait;
    opacity: 0.65;
  }
  small {
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--admin-surface);
    color: var(--admin-muted);
    font-size: 10px;
  }
}
.weather-divider {
  width: 1px;
  height: 18px;
  background: var(--admin-border);
}
.weather-icon {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  place-items: center;
  border-radius: 6px;
  background: #eaf3ff;
  color: var(--admin-primary);
  font-size: 15px;
  &.is-code-0,
  &.is-code-1 {
    background: #fff7e6;
    color: var(--admin-warning);
  }
  &.is-code-95,
  &.is-code-96,
  &.is-code-99 {
    background: #fff1f0;
    color: var(--admin-danger);
  }
}
.weather-sun {
  width: 11px;
  height: 11px;
  border: 2px solid currentColor;
  border-radius: 50%;
  box-shadow:
    0 -6px 0 -4px currentColor,
    0 6px 0 -4px currentColor,
    6px 0 0 -4px currentColor,
    -6px 0 0 -4px currentColor;
}
.weather-temperature {
  color: var(--admin-text);
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}
.weather-condition {
  color: var(--admin-text);
  font-weight: 600;
}
.weather-range {
  color: var(--admin-muted);
  small {
    color: var(--admin-text-tertiary);
    font-size: 10px;
  }
}
.weather-chip.is-loading {
  opacity: 0.72;
}
.weather-location-picker {
  display: grid;
  width: 280px;
  gap: 10px;
  :deep(.ant-select) {
    width: 100%;
  }
}
.date-line {
  color: var(--admin-primary);
  font-size: 13px;
  font-weight: 600;
}
.load-alert {
  margin-bottom: 16px;
}
.overview-toolbar {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 7px 12px 7px 16px;
  background: var(--admin-surface);
  border: 1px solid var(--admin-border-subtle);
  border-bottom: 0;
  border-radius: var(--admin-radius) var(--admin-radius) 0 0;
  > div:first-child {
    display: flex;
    gap: 10px;
    align-items: baseline;
    min-width: 0;
  }
  strong {
    color: var(--admin-text);
    font-size: 14px;
    white-space: nowrap;
  }
  span {
    overflow: hidden;
    color: var(--admin-muted);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.period-selectors {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
  label {
    color: var(--admin-text-secondary);
    font-size: 12px;
    white-space: nowrap;
  }
  .period-select {
    width: 112px;
  }
}
.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 16px;
  overflow: hidden;
  background: var(--admin-surface);
  border: 1px solid var(--admin-border-subtle);
  border-radius: 0 0 var(--admin-radius) var(--admin-radius);
  box-shadow: var(--admin-shadow-card);
}
.overview-item {
  position: relative;
  min-width: 0;
  padding: 18px;
  color: var(--admin-text);
  transition: background-color 0.18s ease;
  & + & {
    border-left: 1px solid var(--admin-border-subtle);
  }
  &::before {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 3px;
    content: '';
    background: var(--module-color);
  }
  &:hover {
    color: var(--admin-text);
    background: #fafcff;
  }
  &.is-approval {
    --module-color: #1677ff;
    --module-soft: #eaf3ff;
  }
  &.is-transport {
    --module-color: #08979c;
    --module-soft: #e6fffb;
  }
  &.is-trade {
    --module-color: #d46b08;
    --module-soft: #fff7e6;
  }
  &.is-hotel {
    --module-color: #389e0d;
    --module-soft: #f0ffe6;
  }
}
.overview-heading {
  display: flex;
  gap: 8px;
  align-items: center;
  strong {
    font-size: 15px;
  }
  .enter-link {
    margin-left: auto;
    color: var(--admin-muted);
    font-size: 12px;
  }
}
.module-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: var(--module-color);
  background: var(--module-soft);
  border-radius: 6px;
  font-size: 16px;
}
.primary-metric {
  padding: 18px 0 14px;
  b {
    display: block;
    overflow: hidden;
    font-size: 24px;
    font-weight: 650;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  span {
    color: var(--admin-muted);
    font-size: 12px;
  }
}
.metric-pair {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding-top: 12px;
  border-top: 1px solid var(--admin-border-subtle);
  div + div {
    padding-left: 12px;
    border-left: 1px solid var(--admin-border-subtle);
  }
  span,
  strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  span {
    color: var(--admin-muted);
    font-size: 12px;
  }
  strong {
    margin-top: 3px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
}
.workspace-section {
  margin-top: 22px;
}
.section-heading {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 10px;
  h2 {
    margin: 0;
    color: var(--admin-text);
    font-size: 17px;
    font-weight: 650;
    line-height: 1.45;
  }
  p {
    margin: 2px 0 0;
    color: var(--admin-muted);
    font-size: 12px;
  }
  > span {
    color: var(--admin-muted);
    font-size: 12px;
  }
}
.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(390px, 1fr);
  gap: 16px;
  align-items: start;
}
.main-stack,
.side-stack {
  min-width: 0;
}
.section-card {
  margin-bottom: 16px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  box-shadow: var(--admin-shadow-card);
  :deep(.ant-card-head) {
    min-height: 48px;
    padding: 0 18px;
    border-bottom-color: var(--admin-border-subtle);
  }
  :deep(.ant-card-head-title) {
    font-weight: 650;
  }
  :deep(.ant-card-body) {
    padding: 18px;
  }
}
.card-note {
  color: var(--admin-muted);
  font-size: 12px;
}
.approval-list :deep(.ant-list-item) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 16px;
  align-items: start;
  padding: 12px 0;
}
.approval-list :deep(.ant-list-item-meta),
.approval-list :deep(.ant-list-item-meta-content) {
  min-width: 0;
}
.approval-list :deep(.ant-list-item-meta-title),
.approval-list :deep(.ant-list-item-meta-description) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.approval-card :deep(.ant-empty) {
  margin-block: 18px 10px;
}
.approval-card :deep(.ant-empty-description) {
  margin-bottom: 12px;
}
.approval-amount {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  margin-left: 0;
  white-space: nowrap;
  strong {
    font-variant-numeric: tabular-nums;
  }
}
.finance-table {
  overflow-x: auto;
}
.finance-row {
  display: grid;
  min-width: 620px;
  grid-template-columns: 1.2fr repeat(3, 1fr);
  gap: 16px;
  align-items: center;
  padding: 13px 10px;
  color: var(--admin-text);
  border-bottom: 1px solid var(--admin-border-subtle);
  &:not(.finance-head):hover {
    background: #f8fafc;
  }
  span,
  b {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  b {
    color: var(--admin-success);
  }
  b.negative {
    color: var(--admin-danger);
  }
}
.finance-head {
  padding-top: 2px;
  color: var(--admin-muted);
  font-size: 12px;
  span {
    text-align: right;
    &:first-child {
      text-align: left;
    }
  }
}
.attention-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 12px 0;
  color: var(--admin-text);
  border-bottom: 1px solid var(--admin-border-subtle);
  &:last-child {
    border-bottom: 0;
  }
  div {
    min-width: 0;
  }
  strong,
  small {
    display: block;
  }
  small {
    margin-top: 3px;
    overflow: hidden;
    color: var(--admin-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  > b {
    font-size: 17px;
    font-variant-numeric: tabular-nums;
  }
}
.expiry-title {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}
.expiry-group-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  background: var(--admin-border-subtle);
  border-radius: 6px;
}
.expiry-group-item {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  align-items: start;
  min-height: 82px;
  padding: 13px 14px;
  color: var(--admin-text);
  background: var(--admin-surface);
  border: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
  &:hover,
  &:focus-visible {
    color: var(--admin-text);
    background: #f8fafc;
  }
  div {
    min-width: 0;
  }
  strong,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    margin-top: 5px;
    color: var(--admin-muted);
    font-size: 12px;
  }
  > b {
    grid-column: 1 / -1;
    color: var(--admin-warning);
    font-size: 12px;
    white-space: nowrap;
  }
}
.expiry-detail-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  color: var(--admin-text-secondary);
  background: var(--admin-surface-muted);
  border-bottom: 1px solid var(--admin-border-subtle);
  strong {
    color: var(--admin-text);
    font-variant-numeric: tabular-nums;
  }
}
.expiry-detail-table :deep(.ant-table-cell) {
  font-variant-numeric: tabular-nums;
}
.expiry-detail-table :deep(.expiry-clickable-row) {
  cursor: pointer;
  transition: background-color 0.16s ease;
}
.expiry-detail-table :deep(.expiry-clickable-row:hover > td),
.expiry-detail-table :deep(.expiry-clickable-row:focus > td) {
  background: #f0f7ff;
}
.expiry-detail-table :deep(.expiry-clickable-row:focus) {
  outline: 2px solid #1677ff;
  outline-offset: -2px;
}
.group-count {
  color: var(--admin-text);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.expiry-more {
  grid-column: 1 / -1;
  padding-top: 10px;
  background: var(--admin-surface);
  color: var(--admin-muted);
  font-size: 12px;
  text-align: center;
}
.status-dot {
  width: 8px;
  height: 8px;
  background: var(--admin-muted);
  border-radius: 50%;
  &.is-warning {
    background: var(--admin-warning);
  }
  &.is-success {
    background: var(--admin-success);
  }
}
.quick-list {
  display: grid;
  gap: 4px;
}
.main-quick-card :deep(.ant-card-body) {
  padding: 8px;
}
.main-quick-card .quick-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.quick-item {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 18px;
  gap: 10px;
  align-items: center;
  padding: 10px;
  color: var(--admin-text);
  border-radius: 6px;
  .quick-icon {
    color: var(--admin-primary);
    font-size: 18px;
  }
  .quick-create-icon {
    color: var(--admin-muted);
    font-size: 14px;
  }
  &:hover,
  &:focus-visible {
    color: var(--admin-text);
    background: #f0f6ff;
    outline: 0;
  }
  strong,
  small {
    display: block;
  }
  small {
    margin-top: 2px;
    color: var(--admin-muted);
    font-size: 12px;
    line-height: 1.45;
  }
}
@media (max-width: 1200px) {
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .overview-item:nth-child(3) {
    border-left: 0;
    border-top: 1px solid var(--admin-border-subtle);
  }
  .overview-item:nth-child(4) {
    border-top: 1px solid var(--admin-border-subtle);
  }
  .main-quick-card .quick-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .expiry-group-list {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 768px) {
  .home-header {
    display: block;
    .home-header-actions {
      align-items: stretch;
      flex-direction: column;
      gap: 8px;
    }
    .weather-chip {
      width: 100%;
      flex-wrap: wrap;
      min-height: 44px;
      white-space: normal;
    }
    .weather-location {
      flex: 1 1 auto;
    }
    .ant-btn {
      width: 100%;
      margin-top: 16px;
    }
  }
  .overview-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    > div:first-child span {
      display: none;
    }
  }
  .period-selectors {
    display: grid;
    width: 100%;
    grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
    .period-select {
      width: 100%;
    }
  }
  .overview-grid,
  .workspace-grid {
    grid-template-columns: 1fr;
  }
  .main-quick-card .quick-list {
    grid-template-columns: 1fr;
  }
  .section-heading {
    align-items: flex-start;
    > span {
      padding-top: 4px;
    }
  }
  .overview-item + .overview-item {
    border-top: 1px solid var(--admin-border-subtle);
    border-left: 0;
  }
  .approval-amount {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
  }
  .approval-list :deep(.ant-list-item) {
    grid-template-columns: 1fr;
  }
  .section-card :deep(.ant-card-body) {
    padding: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .overview-item,
  .quick-item {
    transition: none;
  }
}
</style>

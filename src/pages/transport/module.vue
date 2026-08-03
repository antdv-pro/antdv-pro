<script setup lang="ts">
/* eslint-disable ts/no-use-before-define -- lazy callbacks are initialized before user interaction */
/* eslint-disable regexp/no-super-linear-backtracking, regexp/no-misleading-capturing-group, regexp/no-obscure-range, regexp/optimal-lookaround-quantifier -- bounded PDF text uses domain-specific invoice patterns */
import type { Ref } from 'vue'
import type { GpsGeofence, GpsLocationLatest } from '~@/api/gps'
import type { TransportFuelCreatePayload } from '~@/api/transport/fuel'
import type { TransportSummaryCard } from '~@/api/transport/summary'
import type { RecordActionItem } from '~@/components/record-actions/index.vue'
import type { ImportTableColumn } from '~@/types/import'
import type { TransportImportKind, TransportOrderForm } from './composables/use-transport-module-state'
import { FolderOpenOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { cloneDeep } from 'lodash-es'
import { defineAsyncComponent } from 'vue'
import { getApprovalInstancesApi, submitApprovalApi } from '~@/api/approval'
import { geocodeGpsAddressApi, getGpsGeofencesApi, getGpsLatestLocationsApi, syncGpsRouteGeofencesApi } from '~@/api/gps'
import { createTransportFuelRecordApi, importTransportFuelApi } from '~@/api/transport/fuel'
import { getTransportModuleSummaryApi } from '~@/api/transport/summary'
import FinancialPeriodFilter from '~@/components/financial-period-filter/index.vue'
import SummaryCards from '~@/components/summary-cards/index.vue'
import { useFinancialPeriodFilter } from '~@/composables/financial-period-filter'
import { displayGpsLocation, filterGpsFencesForRoute, findNearbyGpsFence, queueGpsChineseAddresses, resolveGpsRouteStageByAddress } from '~@/composables/gps-location-address'
import { calculateCustomerBidBalance, flushTransportOperationData, loadTransportOperationData, refreshTransportOperationDataForOrderSave, syncDriverPayrollFromBaseData, syncTransportCustomersFromOrders, transportBaseCompanyRows, transportBaseCrewRows, transportBaseCustomerRows, transportBaseRouteRows, transportBaseVehicleRows, transportDriverPayrollRows, transportEtcRows, transportFuelRows, transportOperationError, transportOperationLoading, transportOrderRows } from '~@/composables/transport-operation-data'
import { createBusinessTableScrollX } from '~@/utils/business-table'
import {
  financialMonthKey,
  formatFinancialDisplayRange,
  getCurrentFinancialMonthRange,
  getFinancialMonthByDate,
  parseFinancialMonthKey,
} from '~@/utils/financialPeriod'
import { getImportStatusText, setImportParsingState, setImportPendingState } from '~@/utils/import-progress'
import { normalizeTransportDate } from '~@/utils/transport-date'
import { calculateTransportFreight, calculateTransportFreightExcludingTax, getTransportFreightFormula, isFeeInClosingOrderPeriod, mergeTransportRecords } from '~@/utils/transport-operation'
import { extractTransportPdfText, getTransportFileContentHash, parseTransportWorkbook } from '~@/workers/transport-import-client'
import { createEmptyTransportOrderForm, useTransportModuleState } from './composables/use-transport-module-state'
import { createBaseImportFieldMap, createStableImportCode, normalizeImportHeader, parseCrewImportRows, selectBaseImportSheet } from './import/base-data-parser'
import { extractEtcRoutePair, formatEtcAmountFromCents, normalizeEtcRecord, normalizeEtcRouteName, normalizeEtcRows, parseEtcAmountInCents } from './import/etc-parser'
import { parseEtcSummaryInvoiceStrict } from './import/etc-summary-parser'
import { formatFuelAmount, normalizeFuelRows, parseFuelDate } from './import/fuel-parser'
import { decorateOrderRecord, formatOrderWeight, matrixToRecords, normalizeFinanceMonth, normalizeOrderRows, readOrderRowsFromMatrix } from './import/order-parser'
import { decorateEtcRoutes } from './utils/etc-route-matcher'
import { normalizeRouteCoordinateAddress, validRouteCoordinatePair } from './utils/route-coordinate'

const ImportConfirmDialog = defineAsyncComponent(() => import('~@/components/import-confirm-dialog/index.vue'))
const BaseDataModal = defineAsyncComponent(() => import('./components/base-data-modal.vue'))
const BaseDataTable = defineAsyncComponent(() => import('./components/base-data-table.vue'))
const DriverModeModal = defineAsyncComponent(() => import('./components/driver-mode-modal.vue'))
const DriverPayrollTable = defineAsyncComponent(() => import('./components/driver-payroll-table.vue'))
const TransportOrderAnalytics = defineAsyncComponent(() => import('./components/transport-order-analytics.vue'))
const TransportOperationCreateModal = defineAsyncComponent(() => import('./components/transport-operation-create-modal.vue'))
const TransportRecordDetailDrawer = defineAsyncComponent(() => import('./components/transport-record-detail-drawer.vue'))
const TransportRecordsTable = defineAsyncComponent(() => import('./components/transport-records-table.vue'))
const TransportSubmoduleAnalytics = defineAsyncComponent(() => import('./components/transport-submodule-analytics.vue'))

const route = useRoute()
const router = useRouter()
const message = useMessage()
const batchFolderInput = ref<HTMLInputElement>()
const manualRecordOpen = ref(false)
const manualRecordSaving = ref(false)
const orderGpsLocations = ref<GpsLocationLatest[]>([])
const orderGpsGeofences = ref<GpsGeofence[]>([])

function loadXlsx() {
  return import('xlsx')
}

function normalizeGpsPlateNo(value: unknown) {
  return String(value ?? '').toUpperCase().replace(/[\s·•\-]/g, '')
}

const orderGpsLocationMap = computed(() => new Map(orderGpsLocations.value.map(location => [normalizeGpsPlateNo(location.plateNo), location])))

function getOrderGpsLocation(record: Record<string, string>) {
  return orderGpsLocationMap.value.get(normalizeGpsPlateNo(record.plateNo || record.vehicleDriver?.split('/')[0]))
}

function getOrderGpsLocationLabel(record: Record<string, string>) {
  return displayGpsLocation(getOrderGpsLocation(record), getOrderGpsGeofences(record)) || '暂无定位'
}

function getOrderGpsGeofences(record: Record<string, any>) {
  return filterGpsFencesForRoute(orderGpsGeofences.value, findRouteFence(record))
}

function getNearbyOrderGpsFence(record: Record<string, any>) {
  return findNearbyGpsFence(getOrderGpsLocation(record), getOrderGpsGeofences(record))
}

const latestOrderCodeByPlate = computed(() => {
  const result = new Map<string, string>()
  orderRows.value.forEach((order) => {
    const plateNo = normalizeGpsPlateNo(order.plateNo || order.vehicleDriver?.split('/')[0])
    if (plateNo && !result.has(plateNo))
      result.set(plateNo, order.code)
  })
  return result
})

function isLatestVehicleOrder(record: Record<string, string>) {
  const plateNo = normalizeGpsPlateNo(record.plateNo || record.vehicleDriver?.split('/')[0])
  return Boolean(plateNo && latestOrderCodeByPlate.value.get(plateNo) === record.code)
}

async function loadOrderGpsLocations() {
  if (route.name !== 'TransportOrders')
    return
  try {
    const [locationResponse, fenceResponse] = await Promise.all([getGpsLatestLocationsApi(), getGpsGeofencesApi()])
    orderGpsLocations.value = locationResponse.data ?? []
    orderGpsGeofences.value = fenceResponse.data ?? []
    queueGpsChineseAddresses(orderGpsLocations.value)
  }
  catch {
    orderGpsLocations.value = []
  }
}

interface FuelRecord extends Record<string, string> {
  code: string
  month: string
  date: string
  plateNo: string
  location: string
  product: string
  quantity: string
  quantityUnit: 'L' | 'kg'
  amount: string
  driver: string
}

interface FuelSummary {
  monthRange: string
  recordCount: number
  plateCount: number
  totalAmount: string
  dateRange: string
  rows: FuelRecord[]
}

interface EtcRecord extends Record<string, string> {
  code: string
  summaryNo: string
  name: string
  owner: string
  status: string
  amount: string
  updatedAt: string
  month: string
  plateNo: string
  invoiceNo: string
  cardNo: string
}

interface EtcSummary {
  summaryNo: string
  applyDate: string
  plateNo: string
  buyerName: string
  taxNo: string
  invoiceNo: string
  invoiceCount: number
  tripCount: number
  totalAmount: string
  monthRange: string
  dateRange: string
  rows: EtcRecord[]
}

type TransportOrderRecord = TransportOrderForm

interface OrderSummary {
  monthRange: string
  recordCount: number
  plateCount: number
  totalAmount: string
  dateRange: string
  rows: TransportOrderRecord[]
}

interface BaseDataTab {
  key: string
  title: string
  columns: Array<{ title: string, dataIndex: string, width?: number, ellipsis?: boolean, align?: 'left' | 'center' | 'right', fixed?: 'left' | 'right' }>
  rows: Array<Record<string, string>>
}

const moduleProfiles: Record<string, {
  description: string
  keywordLabel: string
  primaryMetric: string
  secondaryMetric: string
  amountMetric: string
  columns: Array<{ title: string, dataIndex: string, width?: number, fixed?: 'left' | 'right', align?: 'left' | 'center' | 'right' }>
  rows: Array<Record<string, string>>
}> = {
  TransportOrders: {
    description: '支持批量导入运单，也可以新增单条，沉淀客户、路线、车辆、司机、运费等关键信息。',
    keywordLabel: '订单编号',
    primaryMetric: '运单数量',
    secondaryMetric: '车辆数',
    amountMetric: '运费总价',
    columns: [
      { title: '订单编号', dataIndex: 'code', width: 150, fixed: 'left' as const },
      { title: '财务月', dataIndex: 'financeMonth', width: 100 },
      { title: '出车日期', dataIndex: 'shipDate', width: 120 },
      { title: '车辆', dataIndex: 'vehicleInfo', width: 140 },
      { title: '司机/押运员', dataIndex: 'crewInfo', width: 130 },
      { title: '状态', dataIndex: 'status', width: 100 },
      { title: '车辆定位', dataIndex: 'gpsAction', width: 260 },
      { title: '客户', dataIndex: 'customer', width: 140 },
      { title: '路线', dataIndex: 'routeLine', width: 150 },
      { title: '装货地', dataIndex: 'loadingAddress', width: 170 },
      { title: '卸货地', dataIndex: 'unloadingAddress', width: 170 },
      { title: '货物名称', dataIndex: 'cargoName', width: 120 },
      { title: '发货重量', dataIndex: 'sentWeight', width: 110 },
      { title: '收货重量', dataIndex: 'receivedWeight', width: 110 },
      { title: '运价', dataIndex: 'freightPrice', width: 110 },
      { title: '运费', dataIndex: 'freightTotal', width: 120 },
      { title: '税率', dataIndex: 'taxRate', width: 90 },
      { title: '税后运费', dataIndex: 'taxedFreight', width: 120 },
      { title: '油料数量', dataIndex: 'actualFuelVolume', width: 120 },
      { title: '油料总价', dataIndex: 'actualFuelAmount', width: 120 },
      { title: 'ETC费用', dataIndex: 'etcFee', width: 120 },
      { title: '回单状态', dataIndex: 'receiptStatus', width: 110 },
      { title: '结算状态', dataIndex: 'settlementStatus', width: 110 },
    ],
    rows: [],
  },
  OAApproval: {
    description: '集中处理用车、费用、合同、采购和行政办公类审批流程。',
    keywordLabel: '审批单号',
    primaryMetric: '待办审批',
    secondaryMetric: '本财务月通过',
    amountMetric: '审批金额',
    columns: [
      { title: '审批单号', dataIndex: 'code' },
      { title: '审批事项', dataIndex: 'name' },
      { title: '申请人/部门', dataIndex: 'owner' },
      { title: '审批状态', dataIndex: 'status' },
      { title: '金额', dataIndex: 'amount' },
      { title: '提交时间', dataIndex: 'updatedAt' },
    ],
    rows: [],
  },
  TransportTracking: {
    description: '基于北斗定位监控车辆位置、速度、在线状态、轨迹回放和异常预警。',
    keywordLabel: '车牌号',
    primaryMetric: '在线车辆',
    secondaryMetric: '异常预警',
    amountMetric: '今日里程',
    columns: [
      { title: '设备编号', dataIndex: 'code' },
      { title: '车牌号', dataIndex: 'name' },
      { title: '司机/线路', dataIndex: 'owner' },
      { title: '定位状态', dataIndex: 'status' },
      { title: '速度/里程', dataIndex: 'amount' },
      { title: '最后定位时间', dataIndex: 'updatedAt' },
    ],
    rows: [],
  },
  TransportFuel: {
    description: '导入油卡记录后，自动按财务月沉淀日期、车牌、地点、金额等加油明细。',
    keywordLabel: '车牌号',
    primaryMetric: '加油记录',
    secondaryMetric: '车辆数',
    amountMetric: '燃油支出',
    columns: [
      { title: '财务月', dataIndex: 'month' },
      { title: '日期', dataIndex: 'date' },
      { title: '车牌号', dataIndex: 'plateNo' },
      { title: '地点', dataIndex: 'location' },
      { title: '油品', dataIndex: 'product' },
      { title: '油量', dataIndex: 'quantity' },
      { title: '金额', dataIndex: 'amount' },
    ],
    rows: [],
  },
  TransportEtc: {
    description: '汇总ETC费用，支持按车辆、线路、订单和账期核对。',
    keywordLabel: '通行卡号',
    primaryMetric: '通行笔数',
    secondaryMetric: '待核对',
    amountMetric: 'ETC费用',
    columns: [
      { title: '汇总单号', dataIndex: 'summaryNo', width: 210, align: 'center' },
      { title: '通行日期', dataIndex: 'updatedAt', width: 130, align: 'center' },
      { title: '入口信息', dataIndex: 'entryInfo', width: 190 },
      { title: '出口信息', dataIndex: 'exitInfo', width: 190 },
      { title: '车号', dataIndex: 'plateNo', width: 130, align: 'center' },
      { title: '状态', dataIndex: 'status', width: 120, align: 'center' },
      { title: '费用', dataIndex: 'amount', width: 130, align: 'right' },
      { title: '卡号', dataIndex: 'cardNo', width: 150, align: 'center' },
    ],
    rows: [],
  },
  TransportFees: {
    description: '管理保险、年检、营运证、停车费等车辆规费支出。',
    keywordLabel: '费用名称',
    primaryMetric: '本财务月规费',
    secondaryMetric: '待审批',
    amountMetric: '规费合计',
    columns: [
      { title: '费用编号', dataIndex: 'code' },
      { title: '费用名称', dataIndex: 'name' },
      { title: '车辆/经办人', dataIndex: 'owner' },
      { title: '审批状态', dataIndex: 'status' },
      { title: '金额', dataIndex: 'amount' },
      { title: '发生日期', dataIndex: 'updatedAt' },
    ],
    rows: [],
  },
  TransportMaintenance: {
    description: '跟踪车辆保养、维修、配件更换、维保供应商和费用结算。',
    keywordLabel: '维保项目',
    primaryMetric: '本财务月维保',
    secondaryMetric: '待进厂',
    amountMetric: '维保费用',
    columns: [
      { title: '工单编号', dataIndex: 'code' },
      { title: '维保项目', dataIndex: 'name' },
      { title: '车辆/供应商', dataIndex: 'owner' },
      { title: '进度', dataIndex: 'status' },
      { title: '费用', dataIndex: 'amount' },
      { title: '计划时间', dataIndex: 'updatedAt' },
    ],
    rows: [],
  },
  TransportDriverPayroll: {
    description: '从基础资料关联司押人员和车号，按财务月统计出勤、运输趟次、薪酬构成和发放状态。',
    keywordLabel: '司押人员',
    primaryMetric: '出勤天数',
    secondaryMetric: '运输趟次',
    amountMetric: '实发合计',
    columns: [
      { title: '薪酬单号', dataIndex: 'code', fixed: 'left' },
      { title: '司机姓名', dataIndex: 'name', fixed: 'left' },
      { title: '岗位', dataIndex: 'crewRole', width: 90 },
      { title: '车牌号', dataIndex: 'plateNo' },
      { title: '财务月', dataIndex: 'financeMonth' },
      { title: '薪资模式', dataIndex: 'salaryMode' },
      { title: '模式金额', dataIndex: 'modeAmount' },
      { title: '薪资构成', dataIndex: 'salaryComposition', width: 210 },
      { title: '出勤天数', dataIndex: 'attendanceDays' },
      { title: '今日考勤', dataIndex: 'todayAttendance' },
      { title: '运输趟次', dataIndex: 'tripCount' },
      { title: '底薪', dataIndex: 'baseSalary' },
      { title: '趟次提成', dataIndex: 'tripCommission' },
      { title: '补贴', dataIndex: 'allowance' },
      { title: '扣款', dataIndex: 'deduction' },
      { title: '应发工资', dataIndex: 'grossSalary' },
      { title: '实发工资', dataIndex: 'netSalary' },
      { title: '状态', dataIndex: 'status' },
      { title: '更新时间', dataIndex: 'updatedAt' },
    ],
    rows: [],
  },
  TransportVehicleLoans: {
    description: '维护车辆贷款、还款计划、利息、剩余本金和到期提醒。',
    keywordLabel: '贷款合同',
    primaryMetric: '贷款车辆',
    secondaryMetric: '本财务月到期',
    amountMetric: '待还金额',
    columns: [
      { title: '合同编号', dataIndex: 'code' },
      { title: '贷款车辆', dataIndex: 'name' },
      { title: '金融机构', dataIndex: 'owner' },
      { title: '还款状态', dataIndex: 'status' },
      { title: '本期应还', dataIndex: 'amount' },
      { title: '还款日', dataIndex: 'updatedAt' },
    ],
    rows: [],
  },
  TransportBaseData: {
    description: '维护车辆、司机、线路、油站、供应商、费用科目等基础档案。',
    keywordLabel: '档案名称',
    primaryMetric: '基础档案',
    secondaryMetric: '待完善',
    amountMetric: '本财务月新增',
    columns: [
      { title: '档案编号', dataIndex: 'code' },
      { title: '档案名称', dataIndex: 'name' },
      { title: '类别/负责人', dataIndex: 'owner' },
      { title: '状态', dataIndex: 'status' },
      { title: '数量', dataIndex: 'amount' },
      { title: '更新时间', dataIndex: 'updatedAt' },
      { title: '定位入口', dataIndex: 'gpsAction', width: 120 },
    ],
    rows: [],
  },
}

const importedCrewRows = transportBaseCrewRows.value
const importedRouteRows = transportBaseRouteRows.value

const baseDataTabs: BaseDataTab[] = [
  {
    key: 'company',
    title: '公司信息',
    columns: [
      { title: '公司编号', dataIndex: 'code' },
      { title: '公司名称', dataIndex: 'name' },
      { title: '统一社会信用代码', dataIndex: 'taxNo' },
      { title: '道路运输许可证号', dataIndex: 'licenseNo' },
      { title: '法人', dataIndex: 'legalRepresentative' },
      { title: '联系方式', dataIndex: 'contactPhone' },
      { title: '营业执照', dataIndex: 'businessLicenseName' },
      { title: '营业执照有效期', dataIndex: 'businessLicenseValidTo' },
      { title: '道路运输许可证附件', dataIndex: 'roadTransportLicenseName' },
      { title: '道路运输许可证有效期', dataIndex: 'roadTransportLicenseValidTo' },
      { title: '状态', dataIndex: 'status' },
      { title: '更新时间', dataIndex: 'updatedAt' },
    ],
    rows: transportBaseCompanyRows.value,
  },
  {
    key: 'customer',
    title: '客户管理',
    columns: [
      { title: '客户编号', dataIndex: 'code', width: 120 },
      { title: '客户名称', dataIndex: 'name', width: 220 },
      { title: '所属区域', dataIndex: 'area', width: 120 },
      { title: '联系人', dataIndex: 'contact', width: 120 },
      { title: '中标金额', dataIndex: 'bidAmount', width: 130, align: 'right' },
      { title: '已录运费', dataIndex: 'recordedFreight', width: 130, align: 'right' },
      { title: '剩余金额', dataIndex: 'remainingAmount', width: 130, align: 'right' },
      { title: '开始时间', dataIndex: 'bidStartDate', width: 130, align: 'center' },
      { title: '进度', dataIndex: 'progress', width: 150, align: 'center' },
      { title: '更新时间', dataIndex: 'updatedAt', width: 130 },
      { title: '状态', dataIndex: 'status', width: 110 },
    ],
    rows: transportBaseCustomerRows.value,
  },
  {
    key: 'vehicle',
    title: '车辆信息',
    columns: [
      { title: '车号', dataIndex: 'code', width: 116, fixed: 'left' },
      { title: '所在地区', dataIndex: 'area', width: 92 },
      { title: '燃料类型', dataIndex: 'fuelType', width: 92 },
      { title: '道路运输证号', dataIndex: 'roadTransportCertificateNo', width: 140 },
      { title: '挂车道路运输证号', dataIndex: 'trailerRoadTransportCertificateNo', width: 152 },
      { title: '罐体编号', dataIndex: 'tankNo', width: 112 },
      { title: '罐体容积(m³)', dataIndex: 'tankVolume', width: 120, align: 'right' },
      { title: '司机/押运员', dataIndex: 'driver', width: 124 },
      { title: '状态', dataIndex: 'status', width: 92 },
      { title: '总里程', dataIndex: 'mileage', width: 92, align: 'right' },
      { title: '购买日期', dataIndex: 'purchaseDate', width: 108, align: 'center' },
      { title: '车辆年限', dataIndex: 'vehicleAgeType', width: 104, align: 'center' },
      { title: '报废日期', dataIndex: 'scrapDate', width: 108, align: 'center' },
      { title: '更新时间', dataIndex: 'updatedAt', width: 120, align: 'center' },
    ],
    rows: transportBaseVehicleRows.value,
  },
  {
    key: 'crew',
    title: '司押人员',
    columns: [
      { title: '编号', dataIndex: 'code', width: 110, fixed: 'left' },
      { title: '车号', dataIndex: 'vehicleInfo', width: 130, fixed: 'left' },
      { title: '司押人员', dataIndex: 'name', width: 680, ellipsis: false },
      { title: '状态', dataIndex: 'status', width: 110 },
      { title: '更新时间', dataIndex: 'updatedAt', width: 120 },
    ],
    rows: importedCrewRows,
  },
  {
    key: 'route',
    title: '路线信息',
    columns: [
      { title: '路线编号', dataIndex: 'code', width: 104, fixed: 'left' },
      { title: '客户名称', dataIndex: 'customer', width: 168, fixed: 'left' },
      { title: '路线名称', dataIndex: 'name', width: 260 },
      { title: '装货地', dataIndex: 'loadingAddress', width: 220 },
      { title: '目的地', dataIndex: 'destinationName', width: 220 },
      { title: '目的地行政区域', dataIndex: 'destinationArea', width: 160 },
      { title: '卸货地', dataIndex: 'unloadingAddress', width: 220 },
      { title: '运距', dataIndex: 'distance', width: 88, align: 'right' },
      { title: '运价', dataIndex: 'freightPrice', width: 96, align: 'right' },
      { title: '单程新车天然气计划油耗(kg)', dataIndex: 'newGasVehiclePlannedFuelConsumption', width: 148, align: 'right' },
      { title: '单程旧车天然气计划油耗(kg)', dataIndex: 'oldGasVehiclePlannedFuelConsumption', width: 148, align: 'right' },
      { title: '单程新车柴油计划油耗(L)', dataIndex: 'newDieselVehiclePlannedFuelConsumption', width: 148, align: 'right' },
      { title: '单程旧车柴油计划油耗(L)', dataIndex: 'oldDieselVehiclePlannedFuelConsumption', width: 148, align: 'right' },
      { title: '往返新车天然气计划油耗(kg)', dataIndex: 'roundTripNewGasVehiclePlannedFuelConsumption', width: 148, align: 'right' },
      { title: '往返旧车天然气计划油耗(kg)', dataIndex: 'roundTripOldGasVehiclePlannedFuelConsumption', width: 148, align: 'right' },
      { title: '往返新车柴油计划油耗(L)', dataIndex: 'roundTripNewDieselVehiclePlannedFuelConsumption', width: 148, align: 'right' },
      { title: '往返旧车柴油计划油耗(L)', dataIndex: 'roundTripOldDieselVehiclePlannedFuelConsumption', width: 148, align: 'right' },
      { title: '差费', dataIndex: 'extraFee', width: 96, align: 'right' },
      { title: '装车电子围栏', dataIndex: 'loadingFenceName', width: 160 },
      { title: '装车围栏范围', dataIndex: 'loadingFenceRadius', width: 116 },
      { title: '运输中电子围栏', dataIndex: 'transitFenceName', width: 160 },
      { title: '卸车电子围栏', dataIndex: 'unloadingFenceName', width: 160 },
      { title: '卸车围栏范围', dataIndex: 'unloadingFenceRadius', width: 116 },
      { title: '空返电子围栏', dataIndex: 'returnFenceName', width: 160 },
      { title: '状态', dataIndex: 'status', width: 92, align: 'center' },
      { title: '路线时效', dataIndex: 'routeValidityType', width: 96, align: 'center' },
      { title: '时间范围', dataIndex: 'routeValidityRange', width: 190, align: 'center' },
      { title: '更新时间', dataIndex: 'updatedAt', width: 120, align: 'center' },
    ],
    rows: importedRouteRows,
  },
]

const etcRows = transportEtcRows
const etcImportSummary = ref<EtcSummary | null>(null)
const fuelRows = transportFuelRows
const fuelImportSummary = ref<FuelSummary | null>(null)
const orderRows = transportOrderRows as Ref<TransportOrderRecord[]>
const orderImportSummary = ref<OrderSummary | null>(null)
const businessEditOpen = ref(false)
const businessEditSaving = ref(false)
const businessEditingRecord = ref<Record<string, string>>()
const businessEditForm = reactive<Record<string, string>>({})
const {
  orderModalOpen,
  editingOrderCode,
  orderForm,
  activeBaseDataTab,
  baseDataModalOpen,
  baseDataSubmitting,
  baseDataEditingCode,
  baseDataForm,
  baseDataVersion,
  routeCoordinateResolving,
  routeCoordinateSourceAddress,
  queryModel,
  baseDataQueryModel,
  tablePagination,
  importPreview,
  pendingImportApply,
  pendingImportPersist,
  batchFilePickerOpen,
  batchFilePickerKind,
  batchSelectedFiles,
  batchFilePickerTitle,
} = useTransportModuleState()

async function ensureTransportOperationData() {
  await loadTransportOperationData()
  if (transportOperationError.value)
    await loadTransportOperationData()
  if (transportOperationError.value)
    message.error(transportOperationError.value)
}

onMounted(async () => {
  await ensureTransportOperationData()
  void resolveMissingRouteCoordinates()
  if (route.name === 'TransportOrders' && route.query.action === 'create')
    openOrderModal()
})

type TransportStage = 'loading' | 'transit' | 'unloading' | 'returning'

const transportStageProfiles: Record<TransportStage, { label: string, color: string }> = {
  loading: { label: '装车', color: 'orange' },
  transit: { label: '运输中', color: 'blue' },
  unloading: { label: '卸车', color: 'purple' },
  returning: { label: '空返', color: 'cyan' },
}

function normalizeRouteToken(value?: string) {
  return String(value ?? '').replace(/[\s·・,，/至到—–-]/g, '').toLowerCase()
}

function parseRouteDistance(value?: string) {
  const distance = Number(String(value ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(distance) ? distance : 0
}

function getFuelUnit(fuelKind: 'gas' | 'diesel') {
  return fuelKind === 'gas' ? 'kg' : 'L'
}

function normalizeFuelPlanUnit(value: string | undefined, fuelKind: 'gas' | 'diesel') {
  const amount = toNumber(value)
  return amount ? `${amount}${getFuelUnit(fuelKind)}` : ''
}

function formatRoutePlannedFuelByRate(value: string | undefined, rate: number, fuelKind: 'gas' | 'diesel') {
  const distance = parseRouteDistance(value)
  return distance ? `${Math.round(distance * rate)}${getFuelUnit(fuelKind)}` : ''
}

function resolveVehicleFuelKind(fuelType?: string): 'gas' | 'diesel' {
  return /柴油|diesel/i.test(String(fuelType ?? '')) ? 'diesel' : 'gas'
}

function getDefaultRouteFuelPlan(distance: string | undefined, vehicleAgeType: 'new' | 'old', fuelKind: 'gas' | 'diesel') {
  const rates = {
    gas: { new: 0.5, old: 0.55 },
    diesel: { new: 0.38, old: 0.42 },
  }
  return formatRoutePlannedFuelByRate(distance, rates[fuelKind][vehicleAgeType], fuelKind)
}

function doubleFuelPlan(value: string, fuelKind: 'gas' | 'diesel') {
  const amount = toNumber(value)
  return amount ? `${Math.round(amount * 2)}${getFuelUnit(fuelKind)}` : ''
}

function resolveRouteStops(row: Record<string, string>) {
  const [routeLoadingName = '', routeUnloadingName = ''] = String(row.name ?? '').split('-')
  const loadingName = row.loadingAddress || routeLoadingName || '装车地'
  const unloadingName = row.unloadingAddress || routeUnloadingName || '卸车地'
  return {
    loadingName,
    unloadingName,
    routeName: loadingName && unloadingName ? `${loadingName}-${unloadingName}` : String(row.name ?? ''),
  }
}

function inferDestinationArea(value?: string) {
  const text = String(value ?? '')
  const cityMatch = text.match(/([\u4E00-\u9FA5]{2,12}[市州县区旗])/)
  return cityMatch?.[1] || text
}

function decorateRouteGeofences(row: Record<string, string>) {
  const { loadingName, unloadingName, routeName } = resolveRouteStops(row)
  const oldGasPlan = normalizeFuelPlanUnit(row.oldGasVehiclePlannedFuelConsumption || row.oldVehiclePlannedFuelConsumption || row.plannedFuelConsumption || getDefaultRouteFuelPlan(row.distance, 'old', 'gas'), 'gas')
  const newGasPlan = normalizeFuelPlanUnit(row.newGasVehiclePlannedFuelConsumption || row.newVehiclePlannedFuelConsumption || getDefaultRouteFuelPlan(row.distance, 'new', 'gas') || oldGasPlan, 'gas')
  const oldDieselPlan = normalizeFuelPlanUnit(row.oldDieselVehiclePlannedFuelConsumption || getDefaultRouteFuelPlan(row.distance, 'old', 'diesel'), 'diesel')
  const newDieselPlan = normalizeFuelPlanUnit(row.newDieselVehiclePlannedFuelConsumption || getDefaultRouteFuelPlan(row.distance, 'new', 'diesel') || oldDieselPlan, 'diesel')
  const roundTripOldGasPlan = normalizeFuelPlanUnit(row.roundTripOldGasVehiclePlannedFuelConsumption, 'gas') || doubleFuelPlan(oldGasPlan, 'gas')
  const roundTripNewGasPlan = normalizeFuelPlanUnit(row.roundTripNewGasVehiclePlannedFuelConsumption, 'gas') || doubleFuelPlan(newGasPlan, 'gas')
  const roundTripOldDieselPlan = normalizeFuelPlanUnit(row.roundTripOldDieselVehiclePlannedFuelConsumption, 'diesel') || doubleFuelPlan(oldDieselPlan, 'diesel')
  const roundTripNewDieselPlan = normalizeFuelPlanUnit(row.roundTripNewDieselVehiclePlannedFuelConsumption, 'diesel') || doubleFuelPlan(newDieselPlan, 'diesel')
  return {
    ...row,
    name: routeName || row.name,
    area: row.area || inferDestinationArea(unloadingName),
    detailAddress: row.detailAddress || unloadingName,
    freightPrice: row.freightPrice || '',
    extraFee: row.extraFee || '',
    plannedFuelConsumption: row.plannedFuelConsumption || oldGasPlan,
    newVehiclePlannedFuelConsumption: newGasPlan,
    oldVehiclePlannedFuelConsumption: oldGasPlan,
    newGasVehiclePlannedFuelConsumption: newGasPlan,
    oldGasVehiclePlannedFuelConsumption: oldGasPlan,
    newDieselVehiclePlannedFuelConsumption: newDieselPlan,
    oldDieselVehiclePlannedFuelConsumption: oldDieselPlan,
    roundTripNewGasVehiclePlannedFuelConsumption: roundTripNewGasPlan,
    roundTripOldGasVehiclePlannedFuelConsumption: roundTripOldGasPlan,
    roundTripNewDieselVehiclePlannedFuelConsumption: roundTripNewDieselPlan,
    roundTripOldDieselVehiclePlannedFuelConsumption: roundTripOldDieselPlan,
    loadingFenceName: row.loadingFenceName || `${loadingName}装车围栏`,
    loadingFenceRadius: row.loadingFenceRadius || '1.5km',
    transitFenceName: row.transitFenceName || `${loadingName}至${unloadingName}运输围栏`,
    unloadingFenceName: row.unloadingFenceName || `${unloadingName}卸车围栏`,
    unloadingFenceRadius: row.unloadingFenceRadius || '1.5km',
    returnFenceName: row.returnFenceName || `${unloadingName}至${loadingName}运输围栏`,
  }
}

const vehicleOptions = computed(() => {
  baseDataVersion.value
  const vehicleRows = getBaseVehicleRows()
  const crewRows = getBaseCrewRows()
  const byPlate = new Map<string, Record<string, string>>()
  vehicleRows.forEach((row) => {
    const plateNo = row.code || row.plateNo
    if (!plateNo)
      return
    const crew = crewRows.find(item => item.plateNo === plateNo)
    byPlate.set(plateNo, {
      ...row,
      plateNo,
      trailerNo: crew?.trailerNo || row.trailerNo || '',
      driverName: crew?.driverName || row.driver || '',
      escortName: crew?.escortName || row.escort || '',
    })
  })
  crewRows.forEach((row) => {
    if (!byPlate.has(row.plateNo))
      byPlate.set(row.plateNo, row)
  })
  return Array.from(byPlate.values()).map(row => ({
    value: row.plateNo,
    label: `${row.plateNo}${row.trailerNo ? ` / ${row.trailerNo}` : ''}`,
    row,
  }))
})

const customerOptions = computed(() => {
  baseDataVersion.value
  const seen = new Set<string>()
  return getBaseCustomerRows().filter((row) => {
    const key = String(row.name ?? '').trim().replace(/\s+/g, ' ')
    if (!key || seen.has(key))
      return false
    seen.add(key)
    return true
  }).map(row => ({
    value: row.name,
    label: `${row.name}${row.area ? ` / ${row.area}` : ''}`,
    row,
  }))
})

const routeOptions = computed(() => {
  baseDataVersion.value
  const selectedCustomer = String(orderForm.customer ?? '').trim()
  return importedRouteRows.filter((row) => {
    return !selectedCustomer || row.customer === selectedCustomer
  }).map(row => ({
    value: row.name,
    label: row.name,
    row,
  }))
})

const activeProfile = computed(() => {
  const routeName = String(route.name ?? 'TransportOrders')
  return moduleProfiles[routeName] ?? moduleProfiles.TransportOrders
})
const sourceTableRows = computed<Array<Record<string, string | undefined>>>(() => {
  baseDataVersion.value
  if (route.name === 'TransportBaseData')
    return activeBaseDataTabConfig.value.rows

  if (route.name === 'TransportOrders') {
    return orderRows.value
  }
  if (route.name === 'TransportFuel') {
    return fuelRows.value
  }
  if (route.name === 'TransportEtc') {
    // Normalize legacy rows too; older imports may have persisted PDF header
    // fragments as the route name before the parser validation was tightened.
    // Route recognition decorates copies so imported ETC data remains unchanged.
    return decorateEtcRoutes(
      etcRows.value.map((row, index) => normalizeEtcRecord(row, index)),
      importedRouteRows,
      orderRows.value,
    )
  }
  if (route.name === 'TransportDriverPayroll') {
    return transportDriverPayrollRows.value
  }
  return activeProfile.value.rows
})

const {
  model: financialPeriodFilter,
  queryParams: queryFiscalPayload,
  resetFinancialPeriodFilter,
} = useFinancialPeriodFilter(route.name === 'TransportOrders'
  || route.name === 'TransportFuel'
  || route.name === 'TransportDriverPayroll'
  ? {
      financialYear: Number(getCurrentFinancialMonthRange().key.slice(0, 4)),
      financialMonth: Number(getCurrentFinancialMonthRange().key.slice(4, 6)),
    }
  : undefined)
const baseDataFilterExcludedFields = new Set([
  'updatedAt',
  'progress',
  'recordedFreight',
  'remainingAmount',
  'loadingLongitude',
  'loadingLatitude',
  'unloadingLongitude',
  'unloadingLatitude',
])
const routeCoordinateDataFields = ['loadingLongitude', 'loadingLatitude', 'unloadingLongitude', 'unloadingLatitude'] as const

const activeBaseDataFilterColumns = computed(() => {
  if (route.name !== 'TransportBaseData')
    return []
  return activeBaseDataTabConfig.value.columns.filter((column) => {
    const dataIndex = String(column.dataIndex ?? '')
    return dataIndex && !baseDataFilterExcludedFields.has(dataIndex)
  }).slice(0, 6)
})

function getBaseDataFilterOptions(dataIndex: unknown) {
  const key = String(dataIndex ?? '')
  return [...new Set(activeBaseDataTabConfig.value.rows
    .map(row => String(row[key] ?? '').trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map(value => ({ value, label: value }))
}

const orderVehicleFilterOptions = computed(() => {
  const vehicles = new Map<string, string>()
  orderRows.value.forEach((row) => {
    const plateNo = String(row.plateNo || row.vehicleDriver?.split('/')[0] || '').trim()
    if (!plateNo)
      return
    const trailerNo = String(row.trailerNo || '').trim()
    vehicles.set(plateNo, trailerNo ? `${plateNo} / ${trailerNo}` : plateNo)
  })
  return Array.from(vehicles, ([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
})

const orderCustomerFilterOptions = computed(() => {
  const fiscalPayload = queryFiscalPayload.value
  return [...new Set(orderRows.value
    .filter(row => matchesFinancialRange(row, fiscalPayload))
    .map(row => String(row.customer || '').trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map(value => ({ value, label: value }))
})

const tableRows = computed(() => {
  const fiscalPayload = queryFiscalPayload.value
  const rows = sourceTableRows.value.filter((row) => {
    if (route.name === 'TransportBaseData') {
      const matchesBaseDataFilters = activeBaseDataFilterColumns.value.every((column) => {
        const dataIndex = String(column.dataIndex ?? '')
        const filterValue = String(baseDataQueryModel[dataIndex] ?? '').trim().toLowerCase()
        if (!filterValue)
          return true
        return String(row[dataIndex] ?? '').toLowerCase().includes(filterValue)
      })
      if (!matchesBaseDataFilters)
        return false
    }
    if (route.name !== 'TransportBaseData' && queryModel.keyword && !Object.values(row).some(value => String(value ?? '').includes(queryModel.keyword)))
      return false
    if (route.name !== 'TransportBaseData' && queryModel.status) {
      const transportStatusMap: Record<string, string[]> = {
        loading: ['装车'],
        unloading: ['卸车'],
        transit: ['运输中'],
        returning: ['空返'],
      }
      const businessStatusMap: Record<string, string[]> = {
        pending: ['待审核', '待处理', '待派车', '待审批', '待完善', '待确认', '待复核', '待还款', '装车'],
        running: ['运输中', '处理中', '审批中', '生效中', '核算中', '推修中'],
        done: ['已完成', '已通过', '已发放', '已扣款', '正常', '卸车', '空返'],
      }
      const statusMap = route.name === 'TransportOrders' ? transportStatusMap : businessStatusMap
      const allowed = statusMap[queryModel.status] ?? [queryModel.status]
      const stageLabel = route.name === 'TransportOrders' ? getTransportStageTag(row).label : ''
      if (!allowed.some(item => route.name === 'TransportOrders' ? stageLabel === item : String(row.status ?? '').includes(item)))
        return false
    }
    if (route.name === 'TransportOrders' && queryModel.vehicle) {
      const plateNo = String(row.plateNo || row.vehicleDriver?.split('/')[0] || '').trim()
      if (plateNo !== queryModel.vehicle)
        return false
    }
    if (route.name === 'TransportOrders' && queryModel.customer) {
      if (String(row.customer || '').trim() !== queryModel.customer)
        return false
    }
    if (!matchesFinancialRange(row, fiscalPayload))
      return false
    return true
  })
  return route.name === 'TransportOrders'
    ? rows.map(row => decorateOrderExpense(row as TransportOrderRecord))
    : rows
})

watch(activeBaseDataTab, () => {
  tablePagination.current = 1
  Object.keys(baseDataQueryModel).forEach(key => delete baseDataQueryModel[key])
})

watch(
  [() => route.name, activeBaseDataTab, () => transportBaseRouteRows.value.length],
  () => {
    void resolveMissingRouteCoordinates()
  },
  { immediate: true },
)

function getRowBusinessDate(row: Record<string, string | undefined>) {
  const dateValue = row.shipDate || row.date || row.repairDate || row.updatedAt
  if (dateValue)
    return dayjs(dateValue)

  const monthKey = normalizeMonthKey(row.financeMonth || row.month)
  if (monthKey)
    return dayjs(`${monthKey.slice(0, 4)}-${monthKey.slice(4, 6)}-01`)

  return undefined
}

function matchesFinancialRange(row: Record<string, string | undefined>, filters: {
  startDate?: string
  endDate?: string
  financialYear?: number
  financialMonth?: number
  periodType?: 'customRange' | 'financialMonth' | 'financialYear'
}) {
  if (!filters.startDate || !filters.endDate)
    return true

  const rowMonthKey = extractFinancialMonthKey(row)
  if (filters.periodType === 'financialMonth' && filters.financialYear && filters.financialMonth) {
    const selectedMonthKey = `${filters.financialYear}${String(filters.financialMonth).padStart(2, '0')}`
    return rowMonthKey === selectedMonthKey
  }
  if (filters.periodType === 'financialYear' && filters.financialYear && rowMonthKey)
    return rowMonthKey.startsWith(String(filters.financialYear))

  const rowDate = getRowBusinessDate(row)
  if (!rowDate?.isValid())
    return false

  return !rowDate.isBefore(dayjs(filters.startDate), 'day') && rowDate.isBefore(dayjs(filters.endDate), 'day')
}

type ImportKind = TransportImportKind

function openBatchFilePicker(kind: 'fuel' | 'etc') {
  batchFilePickerKind.value = kind
  batchSelectedFiles.value = []
  batchFilePickerOpen.value = true
}

function openAddRecord() {
  if (route.name === 'TransportOrders') {
    openOrderModal()
    return
  }
  if (route.name === 'TransportFuel')
    manualRecordOpen.value = true
}

function addBatchSelectedFiles(file: File, fileList?: File[]) {
  const incoming = fileList?.length ? fileList : [file]
  const existingKeys = new Set(batchSelectedFiles.value.map(getFileQueueKey))
  incoming.forEach((item) => {
    const key = getFileQueueKey(item)
    if (!existingKeys.has(key)) {
      batchSelectedFiles.value.push(item)
      existingKeys.add(key)
    }
  })
  return false
}

function selectBatchFolder() {
  batchFolderInput.value?.click()
}

function addBatchSelectedFolder(event: Event) {
  const input = event.target as HTMLInputElement
  const supportedFiles = Array.from(input.files ?? []).filter(file => /\.(?:xlsx?|csv|pdf)$/i.test(file.name))
  if (!supportedFiles.length)
    message.warning('所选文件夹中没有可导入的 Excel、CSV 或 PDF 文件')
  else
    addBatchSelectedFiles(supportedFiles[0], supportedFiles)
  input.value = ''
}

function removeBatchSelectedFile(file: File) {
  batchSelectedFiles.value = batchSelectedFiles.value.filter(item => getFileQueueKey(item) !== getFileQueueKey(file))
}

function parseBatchSelectedFiles() {
  const files = [...batchSelectedFiles.value]
  if (!files.length) {
    message.warning('请先选择文件')
    return
  }
  batchFilePickerOpen.value = false
  if (batchFilePickerKind.value === 'fuel')
    void importFuelRecordsFromFiles(files)
  else
    void importEtcInvoicesFromFiles(files)
}

function getImportPreviewColumns(kind: ImportKind): ImportTableColumn[] {
  if (kind === 'base' && activeBaseDataTab.value === 'route') {
    return [
      { title: '路线编号', dataIndex: 'code' },
      { title: '客户名称', dataIndex: 'customer' },
      { title: '路线名称', dataIndex: 'name' },
      { title: '装车地址', dataIndex: 'loadingAddress' },
      { title: '卸车地址', dataIndex: 'unloadingAddress' },
    ]
  }
  const columnMap: Record<ImportKind, ImportTableColumn[]> = {
    order: [
      { title: '订单编号', dataIndex: 'code' },
      { title: '出车日期', dataIndex: 'shipDate' },
      { title: '车牌号', dataIndex: 'plateNo' },
      { title: '路线', dataIndex: 'routeLine' },
      { title: '运费', dataIndex: 'freightTotal' },
      { title: '状态', dataIndex: 'status' },
    ],
    fuel: [
      { title: '流水号', dataIndex: 'code' },
      { title: '日期', dataIndex: 'date' },
      { title: '车牌号', dataIndex: 'plateNo' },
      { title: '地点', dataIndex: 'location' },
      { title: '金额', dataIndex: 'amount' },
    ],
    etc: [
      { title: '汇总单号', dataIndex: 'summaryNo', width: 210, align: 'center' },
      { title: '通行日期', dataIndex: 'updatedAt', width: 130, align: 'center' },
      { title: '入口信息', dataIndex: 'entryInfo', width: 190 },
      { title: '出口信息', dataIndex: 'exitInfo', width: 190 },
      { title: '车号', dataIndex: 'plateNo', width: 130, align: 'center' },
      { title: '费用', dataIndex: 'amount', width: 130, align: 'right' },
      { title: '卡号', dataIndex: 'cardNo', width: 150, align: 'center' },
    ],
    base: activeBaseDataTabConfig.value.columns.slice(0, 6).map(column => ({ ...column })),
  }
  return columnMap[kind]
}

function getExistingImportRows(kind: ImportKind) {
  if (kind === 'order')
    return orderRows.value
  if (kind === 'fuel')
    return fuelRows.value
  if (kind === 'base')
    return activeBaseDataTabConfig.value.rows
  return etcRows.value
}

async function importBaseDataFromFile(file: File) {
  openParsingImport('base', `${activeBaseDataTabConfig.value.title}导入确认`, file)
  try {
    const sheets = await parseTransportWorkbook(file)
    const tab = activeBaseDataTabConfig.value
    const fieldMap = createBaseImportFieldMap(tab, baseDataFormColumns.value)
    const { matrix, headerIndex } = selectBaseImportSheet(sheets, tab.key, fieldMap)
    const rawRows = tab.key === 'crew' && headerIndex >= 0
      ? parseCrewImportRows(matrix, headerIndex)
      : headerIndex >= 0
        ? matrixToRecords(matrix, headerIndex)
        : []
    const rows: Array<Record<string, string>> = rawRows.map((raw): Record<string, string> => {
      const row: Record<string, string> = {}
      Object.entries(raw).forEach(([header, value]) => {
        const field = fieldMap.get(normalizeImportHeader(header))
        if (field)
          row[field] = String(value ?? '').trim()
      })
      row.status ||= defaultBaseDataStatus(tab.key)
      row.updatedAt ||= dayjs().format('YYYY-MM-DD')
      if (tab.key === 'crew' && !row.code) {
        const identity = [row.plateNo, row.driverName, row.escortName].filter(Boolean).join('-')
        row.code = `CREW-${identity || rawRows.indexOf(raw) + 1}`
      }
      if (tab.key === 'vehicle')
        row.code ||= row.plateNo || ''
      if (tab.key === 'vehicle') {
        ;['purchaseDate', 'insuranceExpireDate', 'inspectionExpireDate'].forEach((field) => {
          row[field] = normalizeTransportDate(row[field]) || row[field]
        })
      }
      if (tab.key === 'crew') {
        row.vehicleInfo = [row.plateNo, row.trailerNo].filter(Boolean).join(' / ')
        row.name = [row.driverName, row.escortName].filter(Boolean).join(' / ')
      }
      if (tab.key === 'route') {
        row.loadingAddress ||= row.name?.split('-')[0] || ''
        row.unloadingAddress ||= row.destinationName || ''
        row.name ||= [row.loadingAddress, row.destinationName || row.unloadingAddress].filter(Boolean).join('-')
        const identity = [row.loadingAddress, row.destinationName, row.unloadingAddress].filter(Boolean).join('|')
        row.code ||= createStableImportCode('ROUTE', identity || String(rawRows.indexOf(raw) + 1))
      }
      return tab.key === 'route' ? decorateRouteGeofences(row) as Record<string, string> : row
    }).filter((row) => {
      if (!row.code)
        return false
      if (tab.key === 'crew')
        return Boolean(row.plateNo && (row.driverName || row.escortName))
      if (tab.key === 'vehicle')
        return Boolean(row.code)
      if (tab.key === 'route')
        return Boolean(row.loadingAddress && (row.destinationName || row.unloadingAddress))
      return true
    })
    if (tab.key === 'route') {
      const coordinateSummary = await resolveImportedRouteCoordinates(rows)
      if (coordinateSummary.resolved)
        message.success(`路线导入前已自动识别 ${coordinateSummary.resolved} 个装卸车点坐标`)
      if (coordinateSummary.unresolved)
        message.warning(`${coordinateSummary.unresolved} 个装卸车点未找到精确坐标，已保留为空，请后续人工确认`)
    }
    if (!rows.length) {
      openImportFailure('base', `${tab.title}导入确认`, file, '未识别到有效数据，请确认文件中包含编号、车号、客户名称或路线名称等关键表头')
      return
    }
    openImportPreview({
      kind: 'base',
      title: `${tab.title}导入确认`,
      fileName: file.name,
      fileSize: file.size,
      rows,
      apply: (selectedRows) => {
        selectedRows.forEach((row) => {
          const index = tab.rows.findIndex(item => item.code === row.code)
          const previousRecord = index >= 0 ? { ...tab.rows[index] } : undefined
          if (index >= 0)
            tab.rows[index] = { ...tab.rows[index], ...row }
          else
            tab.rows.unshift(row)
          if (tab.key === 'crew')
            ensureVehicleForCrew(row, previousRecord)
          if (tab.key === 'vehicle')
            syncCrewForVehicle(row, previousRecord)
        })
        baseDataVersion.value += 1
        refreshModuleList()
      },
    })
  }
  catch (error: any) {
    openImportFailure('base', `${activeBaseDataTabConfig.value.title}导入确认`, file, error?.message || '文件解析失败')
  }
}

function beforeUploadBaseData(file: File) {
  void importBaseDataFromFile(file)
  return false
}

function openImportPreview(options: {
  kind: ImportKind
  title: string
  fileName: string
  fileSize?: number
  rows: Array<Record<string, string>>
  errorDetails?: string[]
  duplicateDetails?: string[]
  summaryNo?: string
  deduplicateRows?: boolean
  apply?: (rows: Array<Record<string, string>>) => void | Promise<void>
  persist?: boolean
}) {
  const existingCodes = new Set(getExistingImportRows(options.kind).map(row => row.code).filter(Boolean))
  const seenCodes = new Set<string>()
  const duplicateDetails: string[] = [...(options.duplicateDetails ?? [])]
  const importableRows = options.deduplicateRows === false
    ? options.rows
    : options.rows.filter((row, index) => {
        const code = String(row.code ?? `import-row-${index}`)
        if (existingCodes.has(code)) {
          duplicateDetails.push(`${code} 已存在，禁止重复导入`)
          return false
        }
        if (seenCodes.has(code)) {
          duplicateDetails.push(`${code} 在本次文件中重复，已跳过`)
          return false
        }
        seenCodes.add(code)
        return true
      })
  const errorDetails = options.errorDetails ?? []

  setImportPendingState(importPreview, {
    title: options.title,
    fileName: options.fileName,
    fileSize: options.fileSize ?? 0,
    rows: importableRows,
    columns: getImportPreviewColumns(options.kind),
    errorDetails,
    duplicateDetails,
    summaryNo: options.summaryNo,
  })
  pendingImportApply.value = importableRows.length ? options.apply : undefined
  pendingImportPersist.value = options.persist !== false
}

function openImportFailure(kind: ImportKind, title: string, file: File | undefined, error: string) {
  openImportPreview({
    kind,
    title,
    fileName: file?.name ?? '导入文件',
    fileSize: file?.size,
    rows: [],
    errorDetails: [error],
  })
}

function openParsingImport(kind: ImportKind, title: string, file: File) {
  setImportParsingState(importPreview, {
    title,
    fileName: file.name,
    fileSize: file.size,
    columns: getImportPreviewColumns(kind),
  })
}

function closeImportPreview() {
  if (importPreview.status === 'importing')
    return
  importPreview.open = false
}

async function downloadImportErrors() {
  const XLSX = await loadXlsx()
  const workbook = XLSX.utils.book_new()
  const rows = [
    ...importPreview.errorDetails.map(item => ({ 类型: '错误', 明细: item })),
    ...importPreview.duplicateDetails.map(item => ({ 类型: '重复', 明细: item })),
  ]
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 类型: '无', 明细: '本次导入未发现错误或重复记录' }])
  XLSX.utils.book_append_sheet(workbook, worksheet, '导入明细')
  XLSX.writeFile(workbook, `${importPreview.fileName || '导入'}_错误明细.xlsx`)
}

async function confirmImport() {
  if (!importPreview.canConfirm || !pendingImportApply.value)
    return

  const selectedKeys = new Set(importPreview.selectedRowKeys.map(String))
  const selectedRows = importPreview.previewRows.filter((row, index) => selectedKeys.has(String(row.code ?? `import-row-${index}`))) as Array<Record<string, string>>

  importPreview.status = 'importing'
  importPreview.statusText = getImportStatusText('importing')
  importPreview.canConfirm = false
  importPreview.progress = 0
  importPreview.processedRecords = 0
  importPreview.successCount = 0
  importPreview.failedCount = 0

  const total = Math.max(selectedRows.length, 1)
  for (let step = 1; step <= 5; step += 1) {
    await new Promise(resolve => setTimeout(resolve, 120))
    importPreview.processedRecords = Math.min(total, Math.ceil((total * step) / 5))
    importPreview.progress = Math.min(100, Math.round((importPreview.processedRecords / total) * 100))
  }

  try {
    await pendingImportApply.value(selectedRows)
    if (pendingImportPersist.value) {
      await nextTick()
      await flushTransportOperationData()
    }
    importPreview.status = 'completed'
    importPreview.statusText = getImportStatusText('completed')
    importPreview.progress = 100
    importPreview.processedRecords = selectedRows.length
    importPreview.successCount = selectedRows.length
    message.success('导入并保存完成')
  }
  catch (error: any) {
    importPreview.status = 'failed'
    importPreview.statusText = getImportStatusText('failed')
    importPreview.successCount = 0
    importPreview.failedCount = selectedRows.length
    importPreview.errorDetails.push(error?.message ?? '导入保存失败')
    message.error(error?.message ?? '导入保存失败')
  }
}

function normalizeMonthKey(value?: string) {
  if (!value)
    return ''

  const parsedRange = parseFinancialMonthKey(value)
  if (parsedRange)
    return parsedRange.key

  const matched = value.match(/(\d{4})[-/年.]?(\d{1,2})/)
  if (!matched)
    return ''

  const year = matched[1]
  const month = matched[2].padStart(2, '0')
  return `${year}${month}`
}

function extractFinancialMonthKey(row: Record<string, string | undefined>) {
  const directKey = normalizeMonthKey(row.financeMonth || row.month)
  if (directKey)
    return directKey

  const dateValue = row.shipDate || row.date || row.updatedAt
  return dateValue ? financialMonthKey(dateValue) : ''
}

const pageTitle = computed(() => String(route.meta.title ?? '运输订单'))
const summaryLoading = ref(false)
const moduleSummaryCards = ref<TransportSummaryCard[]>([])
const detailOpen = ref(false)
const detailRecord = ref<Record<string, string>>()
const driverPayrollActiveTab = ref('payroll')
const todayAttendanceDate = ref(getCurrentFinancialMonthRange().displayStartDate)
const driverModeModalOpen = ref(false)
const driverModeSaving = ref(false)
const orderSaving = ref(false)
const driverModeEditingRecord = ref<Record<string, any>>()
const salaryModeSaveResultOpen = ref(false)
const salaryModeSaveResult = reactive({
  success: false,
  title: '',
  detail: '',
})
const driverModeForm = reactive({
  plateNos: '',
  newPlateNo: '',
  newPlateStartDate: dayjs().format('YYYY-MM-DD'),
  plateStartDates: {} as Record<string, string>,
  salaryMode: '固定月薪',
  currentSalaryMode: '固定月薪',
  modeHistory: [] as SalaryModeHistoryItem[],
  modeEffectiveDate: getCurrentFinancialMonthRange().displayStartDate,
  modeAmount: 0,
})

const availableFinancialMonthKeys = computed(() => {
  const sourceRows = route.name === 'TransportBaseData'
    ? baseDataTabs.flatMap(tab => tab.rows)
    : sourceTableRows.value

  const monthKeys = sourceRows
    .map(row => extractFinancialMonthKey(row))
    .filter(Boolean)
  if (route.name === 'TransportOrders')
    monthKeys.push(getCurrentFinancialMonthRange().key)

  return [...new Set(monthKeys)]
    .sort()
})

const detailLabelMap: Record<string, string> = {
  code: '编号',
  name: '名称',
  financeMonth: '财务月',
  shipDate: '出车日期',
  plateNo: '车牌号',
  plateNos: '车牌号',
  trailerNo: '挂车牌号',
  driver: '驾驶员',
  escort: '押运员',
  driverName: '驾驶员',
  driverPhone: '驾驶员电话',
  driverCertNo: '驾驶员从业资格证号',
  driverCertValidTo: '驾驶员有效期',
  escortName: '押运员',
  escortPhone: '押运员电话',
  escortCertNo: '押运员从业资格证号',
  escortCertValidTo: '押运员有效期',
  customer: '客户名称',
  routeLine: '路线',
  loadingAddress: '装货地',
  unloadingAddress: '卸货地',
  orderType: '运输类型',
  routeType: '路线类型',
  cargoName: '货物名称',
  sentWeight: '发货重量',
  receivedWeight: '收货重量',
  freightPrice: '运价',
  freightTotal: '运费',
  taxRate: '税率',
  taxedFreight: '税后运费',
  receiptStatus: '回单状态',
  settlementStatus: '结算状态',
  customerRoute: '客户路线',
  vehicleDriver: '车辆司机',
  newVehiclePlannedFuelConsumption: '新车计划油耗',
  oldVehiclePlannedFuelConsumption: '旧车计划油耗',
  newGasVehiclePlannedFuelConsumption: '单程新车天然气计划油耗',
  oldGasVehiclePlannedFuelConsumption: '单程旧车天然气计划油耗',
  newDieselVehiclePlannedFuelConsumption: '单程新车柴油计划油耗',
  oldDieselVehiclePlannedFuelConsumption: '单程旧车柴油计划油耗',
  roundTripNewGasVehiclePlannedFuelConsumption: '往返新车天然气计划油耗',
  roundTripOldGasVehiclePlannedFuelConsumption: '往返旧车天然气计划油耗',
  roundTripNewDieselVehiclePlannedFuelConsumption: '往返新车柴油计划油耗',
  roundTripOldDieselVehiclePlannedFuelConsumption: '往返旧车柴油计划油耗',
  vehicleAgeType: '车辆年限',
  scrapDate: '报废日期',
  loadingFenceName: '装车围栏',
  loadingFenceRadius: '装车范围',
  transitFenceName: '往卸车地运输围栏',
  unloadingFenceName: '卸车围栏',
  unloadingFenceRadius: '卸车范围',
  returnFenceName: '往装车地运输围栏',
  address: '装卸地址',
  cargoWeight: '货物重量',
  location: '地点',
  product: '油品',
  quantity: '数量',
  amount: '金额',
  salaryMode: '薪资模式',
  modeStartDate: '模式开始时间',
  attendanceDays: '出勤天数',
  lastAttendanceDate: '最近考勤日期',
  todayAttendance: '今日考勤',
  tripCount: '运输趟次',
  baseSalary: '底薪',
  tripCommission: '趟次提成',
  allowance: '补贴',
  deduction: '扣款',
  grossSalary: '应发工资',
  netSalary: '实发工资',
  invoiceNo: '发票号',
  cardNo: 'ETC卡号',
  owner: '所属信息',
  area: '所属区域',
  detailAddress: '详细地址',
  distance: '运距',
  taxNo: '统一社会信用代码',
  contact: '联系人',
  crew: '司机/押运员',
  status: '状态',
  remark: '备注',
  updatedAt: '更新时间',
  date: '日期',
  month: '财务月',
}
const hiddenDetailKeys = new Set([
  'gpsAction',
  'area',
  'detailAddress',
  'loadingLongitude',
  'loadingLatitude',
  'unloadingLongitude',
  'unloadingLatitude',
  'loadingFenceName',
  'loadingFenceRadius',
  'transitFenceName',
  'unloadingFenceName',
  'unloadingFenceRadius',
  'returnFenceName',
])

const actionColumn = { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 180 }
const activeTableColumns = computed(() => {
  if (route.name === 'TransportBaseData')
    return appendActionColumn(activeBaseDataTabConfig.value.columns)
  return appendActionColumn(activeProfile.value.columns)
})
const driverAttendanceColumns = computed(() => enhanceDriverPayrollColumns([
  { title: '司押人员', dataIndex: 'name', fixed: 'left', width: 120 },
  { title: '岗位', dataIndex: 'crewRole', width: 90 },
  { title: '车牌号', dataIndex: 'plateNos', width: 150 },
  { title: '薪资模式', dataIndex: 'salaryMode', width: 120 },
  { title: '当日考勤', dataIndex: 'todayAttendance', width: 130 },
  { title: '出勤天数', dataIndex: 'attendanceDays', width: 110 },
  { title: '最近考勤日期', dataIndex: 'lastAttendanceDate', width: 130 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '操作', dataIndex: 'attendanceAction', fixed: 'right' as const, width: 130 },
]))
const driverModeColumns = computed(() => enhanceDriverPayrollColumns([
  { title: '司押人员', dataIndex: 'name', fixed: 'left', width: 120 },
  { title: '岗位', dataIndex: 'crewRole', width: 90 },
  { title: '车牌号', dataIndex: 'plateNos', width: 150 },
  { title: '薪资模式', dataIndex: 'salaryMode', width: 130 },
  { title: '模式金额', dataIndex: 'modeAmount', width: 120 },
  { title: '运输趟次', dataIndex: 'tripCount', width: 110 },
  { title: '操作', dataIndex: 'modeAction', fixed: 'right' as const, width: 90 },
]))
const driverReportColumns = computed(() => enhanceDriverPayrollColumns([
  { title: '财务月', dataIndex: 'financeMonth', fixed: 'left', width: 120 },
  { title: '司押人员', dataIndex: 'name', fixed: 'left', width: 120 },
  { title: '岗位', dataIndex: 'crewRole', width: 90 },
  { title: '薪资模式', dataIndex: 'salaryMode', width: 130 },
  { title: '模式金额', dataIndex: 'modeAmount', width: 120 },
  { title: '出勤天数', dataIndex: 'attendanceDays', width: 110 },
  { title: '运输趟次', dataIndex: 'tripCount', width: 110 },
  { title: '应发工资', dataIndex: 'grossSalary', width: 120 },
  { title: '实发工资', dataIndex: 'netSalary', width: 120 },
  { title: '状态', dataIndex: 'status', width: 110 },
]))
const activeBaseDataTabConfig = computed(() => baseDataTabs.find(tab => tab.key === activeBaseDataTab.value) || baseDataTabs[0])
const baseVehicleOptions = computed(() => {
  baseDataVersion.value
  return getBaseVehicleRows().map(row => ({
    value: row.code,
    label: `${row.code}${row.trailerNo ? ` / ${row.trailerNo}` : ''}${row.driver ? ` / ${row.driver}` : ''}${row.escort ? ` / ${row.escort}` : ''}`,
    row,
  }))
})
const driverPayrollVehicleOptions = computed(() => {
  baseDataVersion.value
  const linkedPlates = new Set(displayDriverPlateNos(driverModeForm).map(normalizePayrollPlateNo))
  return getBaseVehicleRows()
    .filter(row => row.code && !linkedPlates.has(normalizePayrollPlateNo(row.code)))
    .map(row => ({
      value: normalizePayrollPlateNo(row.code),
      label: row.code,
    }))
})
const baseCustomerOptions = computed(() => {
  baseDataVersion.value
  const seen = new Set<string>()
  return getBaseCustomerRows().filter((row) => {
    const key = String(row.name ?? '').trim().replace(/\s+/g, ' ')
    if (!key || seen.has(key))
      return false
    seen.add(key)
    return true
  }).map(row => ({
    value: row.name,
    label: `${row.name}${row.area ? ` / ${row.area}` : ''}${row.contact ? ` / ${row.contact}` : ''}`,
    row,
  }))
})
const baseRouteValidityRange = computed<[string, string] | undefined>({
  get: (): [string, string] | undefined => {
    if (baseDataForm.routeEffectiveStartDate && baseDataForm.routeEffectiveEndDate)
      return [baseDataForm.routeEffectiveStartDate, baseDataForm.routeEffectiveEndDate]
    if (baseDataForm.routeValidityRange?.includes('至')) {
      const [start = '', end = ''] = baseDataForm.routeValidityRange.split('至').map(item => item.trim())
      return start && end ? [start, end] : undefined
    }
    return undefined
  },
  set: (value?: [string, string]) => {
    const [start = '', end = ''] = value ?? []
    baseDataForm.routeEffectiveStartDate = start
    baseDataForm.routeEffectiveEndDate = end
    baseDataForm.routeValidityRange = start && end ? `${start} 至 ${end}` : ''
  },
})

function handleRouteValidityTypeChange(value: unknown) {
  if (String(value ?? '') === '时间范围')
    return
  baseRouteValidityRange.value = undefined
  baseDataForm.routeValidityRange = ''
}
const baseDataFormColumns = computed(() => {
  if (activeBaseDataTab.value === 'crew') {
    return [
      { title: '编号', dataIndex: 'code', width: 110 },
      { title: '车号', dataIndex: 'plateNo', width: 130 },
      { title: '挂号', dataIndex: 'trailerNo', width: 130 },
      { title: '司机姓名', dataIndex: 'driverName', width: 130 },
      { title: '司机电话', dataIndex: 'driverPhone', width: 130 },
      { title: '司机证号', dataIndex: 'driverCertNo', width: 170 },
      { title: '司机证件有效期', dataIndex: 'driverCertValidTo', width: 140 },
      { title: '押运姓名', dataIndex: 'escortName', width: 130 },
      { title: '押运电话', dataIndex: 'escortPhone', width: 130 },
      { title: '押运证号', dataIndex: 'escortCertNo', width: 170 },
      { title: '押运证件有效期', dataIndex: 'escortCertValidTo', width: 140 },
      { title: '状态', dataIndex: 'status', width: 110 },
      { title: '更新时间', dataIndex: 'updatedAt', width: 120 },
      { title: '备注', dataIndex: 'remark', width: 180 },
    ]
  }
  if (activeBaseDataTab.value === 'vehicle') {
    return [
      { title: '车号', dataIndex: 'code' },
      { title: '挂号', dataIndex: 'trailerNo' },
      { title: '所在地区', dataIndex: 'area' },
      { title: '燃料类型', dataIndex: 'fuelType' },
      { title: '道路运输证号', dataIndex: 'roadTransportCertificateNo' },
      { title: '挂车道路运输证号', dataIndex: 'trailerRoadTransportCertificateNo' },
      { title: '罐体编号', dataIndex: 'tankNo' },
      { title: '罐体容积(m³)', dataIndex: 'tankVolume' },
      { title: '绑定司机', dataIndex: 'driver' },
      { title: '绑定押运员', dataIndex: 'escort' },
      { title: '状态', dataIndex: 'status' },
      { title: '总里程', dataIndex: 'mileage' },
      { title: '购买日期', dataIndex: 'purchaseDate' },
      { title: '发动机号', dataIndex: 'engineNo' },
      { title: '车架号', dataIndex: 'vin' },
      { title: '保险到期日', dataIndex: 'insuranceExpireDate' },
      { title: '年检到期日', dataIndex: 'inspectionExpireDate' },
      { title: '更新时间', dataIndex: 'updatedAt' },
    ]
  }
  if (activeBaseDataTab.value === 'route') {
    return activeBaseDataTabConfig.value.columns
      .filter(column => !['action', 'routeValidityRange', ...routeCoordinateDataFields].includes(column.dataIndex))
      .flatMap((column) => {
        if (column.dataIndex === 'routeValidityType') {
          return [
            column,
            { title: '时间范围', dataIndex: 'routeEffectiveDateRange' },
          ]
        }
        return [column]
      })
  }
  if (activeBaseDataTab.value === 'customer') {
    return activeBaseDataTabConfig.value.columns
      .filter(column => !['action', 'recordedFreight', 'remainingAmount', 'progress'].includes(column.dataIndex))
  }
  return activeBaseDataTabConfig.value.columns.filter(column => column.dataIndex !== 'action')
})
const activeTableScrollX = computed(() => {
  const minWidthMap: Record<string, number> = {
    TransportBaseData: 2400,
    TransportOrders: 2500,
    TransportEtc: 1100,
    TransportDriverPayroll: 1800,
  }
  return createBusinessTableScrollX(activeTableColumns.value, minWidthMap[String(route.name)] ?? 1200)
})

function enhanceDriverPayrollColumns(columns: Array<Record<string, any>>) {
  return columns.map(enhanceTableColumn)
}

const driverPayrollTableTitle = computed(() => {
  const titleMap: Record<string, string> = {
    payroll: '工资表',
    attendance: '司机出勤统计',
    mode: '薪资模式配置',
    report: '月度薪酬报表',
  }
  return titleMap[driverPayrollActiveTab.value] || '工资表'
})

const driverPayrollCurrentColumns = computed(() => {
  if (driverPayrollActiveTab.value === 'attendance')
    return driverAttendanceColumns.value
  if (driverPayrollActiveTab.value === 'mode')
    return driverModeColumns.value
  if (driverPayrollActiveTab.value === 'report')
    return driverReportColumns.value
  return activeTableColumns.value
})

const driverPayrollVisibleRows = computed(() => {
  return tableRows.value.filter((record: Record<string, any>) => String(record.crewRole || '司机').includes('司机'))
})

const driverPayrollCurrentScrollX = computed(() => {
  const minWidthMap: Record<string, number> = {
    payroll: 1960,
    attendance: 980,
    mode: 1100,
    report: 1120,
  }
  return createBusinessTableScrollX(driverPayrollCurrentColumns.value, minWidthMap[driverPayrollActiveTab.value] ?? 1200)
})

const driverAttendanceCalendarDays = computed(() => {
  const range = getFinancialMonthByDate(dayjs(todayAttendanceDate.value))
  const days: Array<{ key: string, day: string, week: string, weekend: boolean }> = []
  let cursor = range.startAt.startOf('day')
  while (!cursor.isAfter(range.displayEndAt, 'day')) {
    days.push({
      key: cursor.format('YYYY-MM-DD'),
      day: cursor.format('D'),
      week: ['日', '一', '二', '三', '四', '五', '六'][cursor.day()],
      weekend: cursor.day() === 0 || cursor.day() === 6,
    })
    cursor = cursor.add(1, 'day')
  }
  return days
})

const driverAttendancePeriodLabel = computed(() => {
  const range = getFinancialMonthByDate(dayjs(todayAttendanceDate.value))
  return `${range.displayStartDate} 至 ${range.displayEndDate} (${driverAttendanceCalendarDays.value.length}天)`
})

const driverAttendanceGridStyle = computed(() => ({
  gridTemplateColumns: `140px 180px 150px 80px repeat(${driverAttendanceCalendarDays.value.length}, 40px) 56px`,
}))

const driverAttendanceGroups = computed(() => {
  return tableRows.value
    .filter((record: Record<string, any>) => String(record.crewRole || '司机').includes('司机'))
    .map((driver: Record<string, any>) => ({
      key: String(driver.code || driver.name),
      plateNos: displayDriverPlateNos(driver),
      members: [driver],
      driver,
    }))
})

const driverSalaryModeCards = computed(() => {
  const definitions = [
    { mode: '固定月薪', description: '按财务月和司机出勤核算固定金额' },
    { mode: '底薪+差费', description: '配置底薪与运单设定差费组合核算' },
    { mode: '市区倒短固定工资', description: '市区倒短按固定工资核算' },
  ]
  const drivers = tableRows.value.filter((record: Record<string, any>) => String(record.crewRole || '司机').includes('司机'))
  return definitions.map(definition => ({
    ...definition,
    amount: toNumber(transportDriverPayrollRows.value.find(record => record.crewRole === '模式配置' && normalizeSalaryMode(record.salaryMode) === definition.mode)?.modeAmount
      || drivers.find(record => normalizeSalaryMode(record.salaryMode) === definition.mode)?.modeAmount
      || 0),
    drivers: drivers.filter((record: Record<string, any>) => normalizeSalaryMode(record.salaryMode) === definition.mode),
  }))
})
const driverSalaryModeAmountMap = computed(() => Object.fromEntries(driverSalaryModeCards.value.map(card => [card.mode, card.amount])))

async function saveGlobalSalaryMode(mode: string, amount: number) {
  const normalizedAmount = formatPlainAmount(toNumber(amount))
  let lastError: any
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await loadTransportOperationData({ force: attempt > 0 })
      await nextTick()
      if (transportOperationError.value)
        throw new Error(transportOperationError.value)
      let configRecord = transportDriverPayrollRows.value.find(record => record.crewRole === '模式配置' && normalizeSalaryMode(record.salaryMode) === mode)
      if (!configRecord) {
        configRecord = {
          code: `MODE_CONFIG_${mode}`,
          name: `${mode}统一金额`,
          crewRole: '模式配置',
          financeMonth: '2000-01',
          owner: '薪资模式配置',
          status: '已配置',
          salaryMode: mode,
          modeAmount: normalizedAmount,
          amount: normalizedAmount,
          updatedAt: dayjs().format('YYYY-MM-DD'),
        }
        transportDriverPayrollRows.value.push(configRecord)
      }
      else {
        configRecord.modeAmount = normalizedAmount
        configRecord.amount = normalizedAmount
        configRecord.updatedAt = dayjs().format('YYYY-MM-DD')
      }
      tableRows.value.filter((record: Record<string, any>) => String(record.crewRole || '司机').includes('司机') && normalizeSalaryMode(record.salaryMode) === mode).forEach((record: Record<string, any>) => {
        record.salaryMode = mode
        record.modeAmount = normalizedAmount
        if (mode.includes('固定') || mode === '底薪+差费')
          record.baseSalary = normalizedAmount
        else
          record.tripCommission = normalizedAmount
        recalculateDriverPayroll(record)
      })
      await nextTick()
      await flushTransportOperationData()
      await loadTransportOperationData({ force: true })
      const savedRecord = transportDriverPayrollRows.value.find(record => record.crewRole === '模式配置' && normalizeSalaryMode(record.salaryMode) === mode)
      if (!savedRecord || formatPlainAmount(toNumber(savedRecord.modeAmount)) !== normalizedAmount)
        throw new Error('服务器未返回刚保存的模式金额')
      salaryModeSaveResult.success = true
      salaryModeSaveResult.title = '保存成功'
      salaryModeSaveResult.detail = `${mode}金额已保存：${normalizedAmount} 元。刷新页面后仍会保留。`
      salaryModeSaveResultOpen.value = true
      return
    }
    catch (error: any) {
      lastError = error
      if (!String(error?.message || '').includes('数据已被其他用户更新') && attempt === 2)
        break
    }
  }
  salaryModeSaveResult.success = false
  salaryModeSaveResult.title = '保存失败'
  salaryModeSaveResult.detail = lastError?.message || `${mode}统一金额保存失败，请稍后重试。`
  salaryModeSaveResultOpen.value = true
}

function normalizeSalaryMode(mode: unknown) {
  return String(mode || '固定月薪') === '纯里程' ? '市区倒短固定工资' : String(mode || '固定月薪')
}

function handleQuery() {
  tablePagination.current = 1
  loadModuleSummary()
}

async function exportCurrentRows() {
  const XLSX = await loadXlsx()
  const payload = queryFiscalPayload.value
  const workbook = XLSX.utils.book_new()
  const activeBaseTab = baseDataTabs.find(tab => tab.key === activeBaseDataTab.value)
  const exportRows = tableRows.value
  const exportColumns = route.name === 'TransportBaseData' && activeBaseTab ? activeBaseTab.columns : activeProfile.value.columns
  const conditionSheet = XLSX.utils.json_to_sheet([
    {
      页面: pageTitle.value,
      分组: route.name === 'TransportBaseData' ? activeBaseTab?.title : '',
      关键字: queryModel.keyword || '',
      状态: queryModel.status || '',
      车辆: route.name === 'TransportOrders' ? queryModel.vehicle || '' : '',
      客户: route.name === 'TransportOrders' ? queryModel.customer || '' : '',
      ...(route.name === 'TransportBaseData'
        ? Object.fromEntries(activeBaseDataFilterColumns.value.map(column => [column.title, baseDataQueryModel[String(column.dataIndex)] || '']))
        : {}),
      startDate: payload.startDate,
      endDate: payload.endDate,
    },
  ])
  const dataSheet = XLSX.utils.json_to_sheet(exportRows.map(row => Object.fromEntries(
    exportColumns.map(column => [column.title, getExportCellValue(row, column.dataIndex)]),
  )))

  XLSX.utils.book_append_sheet(workbook, conditionSheet, '筛选条件')
  XLSX.utils.book_append_sheet(workbook, dataSheet, '导出数据')
  XLSX.writeFile(workbook, `${pageTitle.value}_${payload.startDate}_${payload.endDate}.xlsx`)
}

function getVehicleAgeTypeLabel(plateNo?: string) {
  return getVehicleAgeType(plateNo) === 'new' ? '新车' : '旧车'
}

function getVehicleScrapDate(plateNo?: string) {
  const vehicle = getVehicleArchive(plateNo)
  const purchaseDate = dayjs(normalizeTransportDate(vehicle?.purchaseDate))
  return purchaseDate.isValid() ? purchaseDate.add(10, 'year').format('YYYY-MM-DD') : ''
}

function isVehicleScrapWarning(plateNo?: string) {
  const scrapDate = dayjs(getVehicleScrapDate(plateNo))
  return scrapDate.isValid() && scrapDate.diff(dayjs(), 'month', true) < 6
}

const transportOrderNumericExportFields = new Set([
  'sentWeight',
  'receivedWeight',
  'freightPrice',
  'freightTotal',
  'taxedFreight',
  'actualFuelAmount',
  'etcFee',
])

function getExportCellValue(row: Record<string, string | undefined>, dataIndex: unknown) {
  const key = String(dataIndex ?? '')
  if (route.name === 'TransportBaseData' && activeBaseDataTab.value === 'vehicle' && key === 'vehicleAgeType')
    return getVehicleAgeTypeLabel(row.code || row.plateNo)
  if (route.name === 'TransportBaseData' && activeBaseDataTab.value === 'vehicle' && key === 'scrapDate')
    return getVehicleScrapDate(row.code || row.plateNo)

  if (route.name === 'TransportOrders') {
    const value = row[key]
    if (transportOrderNumericExportFields.has(key))
      return value === undefined || value === null || String(value).trim() === '' ? '' : toNumber(value)
  }

  return row[key] ?? ''
}

function resetQuery() {
  queryModel.keyword = ''
  queryModel.status = undefined
  queryModel.vehicle = undefined
  queryModel.customer = undefined
  Object.keys(baseDataQueryModel).forEach(key => delete baseDataQueryModel[key])
  tablePagination.current = 1
  const currentMonth = getCurrentFinancialMonthRange()
  resetFinancialPeriodFilter(route.name !== 'TransportBaseData'
    ? {
        financialYear: Number(currentMonth.key.slice(0, 4)),
        financialMonth: Number(currentMonth.key.slice(4, 6)),
      }
    : undefined)
  loadModuleSummary()
}

function appendActionColumn(columns: Array<Record<string, any>>) {
  const nextColumns = columns.some(column => column.dataIndex === 'action')
    ? columns
    : [...columns, actionColumn]
  return nextColumns.map(enhanceTableColumn)
}

function enhanceTableColumn(column: Record<string, any>) {
  const dataIndex = String(column.dataIndex ?? '')
  const enhanced: Record<string, any> = {
    ...column,
    width: column.width ?? inferTransportColumnWidth(column, dataIndex),
    ellipsis: false,
    customCell: () => ({ class: [tableCellClass(dataIndex), column.ellipsis === false ? 'table-cell-no-ellipsis' : ''].filter(Boolean).join(' ') }),
  }
  if (!enhanced.align) {
    if (['amount', 'bidAmount', 'freightTotal', 'taxedFreight', 'quantity', 'distance', 'actualFuelVolume', 'actualFuelAmount', 'etcFee', 'modeAmount', 'baseSalary', 'tripCommission', 'allowance', 'deduction', 'grossSalary', 'netSalary'].includes(dataIndex))
      enhanced.align = 'right'
    else if (/date|time|At|Month/i.test(dataIndex))
      enhanced.align = 'center'
    else if (['action', 'gpsAction', 'status'].includes(dataIndex))
      enhanced.align = 'center'
  }
  if (dataIndex && !['action', 'gpsAction'].includes(dataIndex) && !enhanced.sorter) {
    enhanced.sorter = (a: Record<string, string>, b: Record<string, string>) => compareTableValue(a[dataIndex], b[dataIndex])
    enhanced.sortDirections = ['ascend', 'descend']
    enhanced.showSorterTooltip = { target: 'full-header' }
  }
  return enhanced
}

function inferTransportColumnWidth(column: Record<string, any>, dataIndex: string) {
  const title = String(column.title ?? '')
  if (['action'].includes(dataIndex))
    return 180
  if (['status', 'receiptStatus', 'settlementStatus', 'gpsAction'].includes(dataIndex))
    return 110
  if (['id', 'sequenceNo', 'sortNo'].includes(dataIndex))
    return 80
  if (['amount', 'bidAmount', 'freightTotal', 'taxedFreight', 'freightPrice', 'quantity', 'distance', 'actualFuelVolume', 'actualFuelAmount', 'etcFee', 'baseSalary', 'tripCommission', 'allowance', 'deduction', 'grossSalary', 'netSalary'].includes(dataIndex))
    return 120
  if (/date|time|At|Month/i.test(dataIndex))
    return 120
  if (/address|route|line|location|remark|items|responsibility/i.test(dataIndex))
    return 180
  if (/code|No|invoice|card/i.test(dataIndex))
    return 150
  if (/name|customer|driver|escort|vehicle|owner|supplier|shop/i.test(dataIndex))
    return 140
  return title.length <= 2 ? 90 : title.length <= 5 ? 120 : 150
}

function compareTableValue(a: unknown, b: unknown) {
  const aNumber = Number(String(a ?? '').replace(/[¥,吨公里]/g, ''))
  const bNumber = Number(String(b ?? '').replace(/[¥,吨公里]/g, ''))
  if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber))
    return aNumber - bNumber
  const aDate = dayjs(String(a ?? ''))
  const bDate = dayjs(String(b ?? ''))
  if (aDate.isValid() && bDate.isValid())
    return aDate.valueOf() - bDate.valueOf()
  return String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN')
}

function tableCellClass(dataIndex: string) {
  if (['amount', 'freightTotal', 'taxedFreight', 'quantity', 'distance', 'actualFuelVolume', 'actualFuelAmount', 'etcFee', 'baseSalary', 'tripCommission', 'allowance', 'deduction', 'grossSalary', 'netSalary'].includes(dataIndex))
    return 'table-cell-money'
  if (/date|time|At|Month/i.test(dataIndex))
    return 'table-cell-date'
  if (['action', 'gpsAction', 'status'].includes(dataIndex))
    return 'table-cell-action'
  return ''
}

function findRouteFence(record: Record<string, any>) {
  const routeKey = normalizeRouteToken(record.routeLine)
  const loadingKey = normalizeRouteToken(record.loadingAddress)
  const unloadingKey = normalizeRouteToken(record.unloadingAddress)
  const customerKey = normalizeRouteToken(record.customer)
  return importedRouteRows.find((item) => {
    const itemRouteKey = normalizeRouteToken(item.name)
    const itemLoadingKey = normalizeRouteToken(item.loadingAddress)
    const itemUnloadingKey = normalizeRouteToken(item.unloadingAddress)
    const itemCustomerKey = normalizeRouteToken(item.customer)
    if (routeKey && itemRouteKey === routeKey)
      return true
    if (loadingKey && unloadingKey && itemLoadingKey === loadingKey && itemUnloadingKey === unloadingKey)
      return true
    return Boolean(
      routeKey
      && itemRouteKey
      && (!customerKey || !itemCustomerKey || customerKey === itemCustomerKey)
      && (routeKey.includes(itemRouteKey) || itemRouteKey.includes(routeKey)),
    )
  })
}

function resolveTransportStage(record: Record<string, any>): TransportStage {
  const location = getOrderGpsLocation(record)
  const nearbyFence = getNearbyOrderGpsFence(record)
  if (nearbyFence?.routeStage === 'unloading' || /卸车/.test(nearbyFence?.name ?? ''))
    return 'unloading'
  if (nearbyFence?.routeStage === 'loading' || /装车/.test(nearbyFence?.name ?? ''))
    return 'loading'

  const status = String(record.status ?? '')
  const receiptStatus = String(record.receiptStatus ?? '')
  const settlementStatus = String(record.settlementStatus ?? '')
  const routeFence = findRouteFence(record)
  const addressStage = location
    ? resolveGpsRouteStageByAddress(getOrderGpsLocationLabel(record), {
        loadingAddress: record.loadingAddress || routeFence?.loadingAddress,
        unloadingAddress: record.unloadingAddress || routeFence?.unloadingAddress,
      })
    : undefined

  if (addressStage)
    return addressStage

  // Real GPS integration can replace this block with: point in loading/transit/unloading/return fence.
  if (/空返|返程|回场|返场/.test(status))
    return 'returning'
  if (/卸车|已到达|已签收|已回单|已完成/.test(status) || receiptStatus.includes('已回单'))
    return settlementStatus.includes('已结算') ? 'returning' : 'unloading'
  if (/运输中|在途|已发车|配送中/.test(status))
    return 'transit'
  if (!location && routeFence && /待审核|待派车|待装车|装车|草稿/.test(status))
    return 'loading'
  return 'transit'
}

function getTransportStageTag(record: Record<string, any>) {
  const stage = resolveTransportStage(record)
  const profile = transportStageProfiles[stage]
  const nearbyFence = getNearbyOrderGpsFence(record)
  return {
    ...profile,
    stage,
    fenceName: nearbyFence?.name || '',
  }
}

const routeFenceDisplayFields = new Set([
  'loadingFenceName',
  'loadingFenceRadius',
  'transitFenceName',
  'unloadingFenceName',
  'unloadingFenceRadius',
  'returnFenceName',
])

function displayTableValue(record: Record<string, string>, dataIndex: unknown) {
  const key = String(dataIndex ?? '')
  const value = route.name === 'TransportBaseData'
    && activeBaseDataTab.value === 'route'
    && routeFenceDisplayFields.has(key)
    ? (decorateRouteGeofences(record) as Record<string, string>)[key]
    : record[key]
  return value == null || value === '' ? '-' : value
}

function getBaseDataColumns(columns: Array<Record<string, any>>, tabKey?: BaseDataTab['key']) {
  if (tabKey === 'customer')
    return [...columns, { ...actionColumn, fixed: undefined }].map(enhanceTableColumn)
  return appendActionColumn(columns)
}

function createBaseDataCode(tab: BaseDataTab) {
  const prefixMap: Record<string, string> = {
    company: 'GS',
    customer: 'KH',
    vehicle: 'CL',
    crew: 'RY',
    route: 'LX',
  }
  const prefix = prefixMap[tab.key] || 'BD'
  const maxNo = tab.rows.reduce((max, row) => {
    const match = String(row.code || '').match(new RegExp(`^${prefix}(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `${prefix}${String(maxNo + 1).padStart(3, '0')}`
}

function defaultBaseDataStatus(tabKey: string) {
  if (tabKey === 'customer')
    return '合作中'
  if (tabKey === 'vehicle')
    return '营运中'
  if (tabKey === 'crew')
    return '在岗'
  if (tabKey === 'route')
    return '启用'
  return '正常'
}

function resetBaseDataForm(tab = activeBaseDataTabConfig.value) {
  Object.keys(baseDataForm).forEach(key => delete baseDataForm[key])
  baseDataFormColumns.value.forEach((column) => {
    baseDataForm[column.dataIndex] = ''
  })
  baseDataForm.code = createBaseDataCode(tab)
  baseDataForm.status = defaultBaseDataStatus(tab.key)
  if (tab.key === 'route')
    baseDataForm.routeValidityType = '长期'
  routeCoordinateSourceAddress.loading = ''
  routeCoordinateSourceAddress.unloading = ''
  baseDataForm.updatedAt = dayjs().format('YYYY-MM-DD')
}

function openBaseDataCreate() {
  if (activeBaseDataTab.value === 'company' && activeBaseDataTabConfig.value.rows.length) {
    openBaseDataEdit(activeBaseDataTabConfig.value.rows[0])
    return
  }
  baseDataEditingCode.value = ''
  resetBaseDataForm()
  baseDataModalOpen.value = true
}

function openBaseDataEdit(record: Record<string, string>) {
  baseDataEditingCode.value = record.code
  resetBaseDataForm()
  Object.assign(baseDataForm, record)
  if (activeBaseDataTab.value === 'route' && !baseDataForm.routeValidityType)
    baseDataForm.routeValidityType = baseDataForm.routeValidityRange ? '时间范围' : '长期'
  if (activeBaseDataTab.value === 'route') {
    routeCoordinateSourceAddress.loading = String(baseDataForm.loadingAddress || '').trim()
    routeCoordinateSourceAddress.unloading = String(baseDataForm.unloadingAddress || '').trim()
  }
  syncBaseRouteGeofenceDraft()
  baseDataModalOpen.value = true
}

function normalizeCoordinateAddress(value: unknown) {
  return normalizeRouteCoordinateAddress(value)
}

function validCoordinatePair(longitude: unknown, latitude: unknown) {
  return validRouteCoordinatePair(longitude, latitude)
}

type RouteCoordinateStage = 'loading' | 'unloading'

function routeCoordinateFields(stage: RouteCoordinateStage) {
  return stage === 'loading'
    ? { address: 'loadingAddress', longitude: 'loadingLongitude', latitude: 'loadingLatitude' }
    : { address: 'unloadingAddress', longitude: 'unloadingLongitude', latitude: 'unloadingLatitude' }
}

interface RouteCoordinateSummary {
  resolved: number
  unresolved: number
}

let routeCoordinateBackfillRunning = false
let routeCoordinateAutosaveQueue: Promise<void> = Promise.resolve()

async function resolveImportedRouteCoordinates(rows: Array<Record<string, string>>): Promise<RouteCoordinateSummary> {
  const coordinateCache = new Map<string, Promise<[number, number] | undefined>>()
  let fences: GpsGeofence[] = []
  try {
    const response = await getGpsGeofencesApi()
    fences = response.data || []
  }
  catch {
    // Geofences are an optimization; address geocoding can still resolve coordinates.
  }

  let resolved = 0
  let unresolved = 0
  const pending = rows.flatMap(row => (['loading', 'unloading'] as RouteCoordinateStage[]).map(stage => ({ row, stage })))
  let cursor = 0

  async function resolveOne(item: { row: Record<string, string>, stage: RouteCoordinateStage }) {
    const fields = routeCoordinateFields(item.stage)
    const row = item.row
    if (validRouteCoordinatePair(row[fields.longitude], row[fields.latitude]))
      return

    const address = String(row[fields.address] || '').trim()
    const normalizedAddress = normalizeRouteCoordinateAddress(address)
    if (!normalizedAddress)
      return

    const cacheKey = `${item.stage}:${normalizedAddress}`
    let coordinatePromise = coordinateCache.get(cacheKey)
    if (!coordinatePromise) {
      coordinatePromise = (async () => {
        let coordinate: [number, number] | undefined
        const historicalRoute = transportBaseRouteRows.value.find((candidate) => {
          const candidateFields = routeCoordinateFields(item.stage)
          return normalizeRouteCoordinateAddress(candidate[candidateFields.address]) === normalizedAddress
            && validRouteCoordinatePair(candidate[candidateFields.longitude], candidate[candidateFields.latitude])
        })
        if (historicalRoute)
          coordinate = validRouteCoordinatePair(historicalRoute[fields.longitude], historicalRoute[fields.latitude])

        if (!coordinate) {
          const fence = fences.find(candidate => candidate.shape === 'circle'
            && candidate.center
            && normalizeRouteCoordinateAddress(candidate.address) === normalizedAddress)
          coordinate = fence?.center && validRouteCoordinatePair(fence.center[0], fence.center[1])
        }

        if (!coordinate) {
          try {
            const geocodeResult = await geocodeGpsAddressApi(address)
            if (geocodeResult.code === 200 && geocodeResult.data?.precise)
              coordinate = validRouteCoordinatePair(geocodeResult.data.longitude, geocodeResult.data.latitude)
          }
          catch {
            // Keep the row importable when the geocoding provider is unavailable.
          }
        }
        return coordinate
      })()
      coordinateCache.set(cacheKey, coordinatePromise)
    }

    const coordinate = await coordinatePromise
    if (!coordinate) {
      unresolved++
      return
    }
    row[fields.longitude] = coordinate[0].toFixed(6)
    row[fields.latitude] = coordinate[1].toFixed(6)
    resolved++
  }

  async function worker() {
    while (cursor < pending.length) {
      const index = cursor++
      await resolveOne(pending[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, pending.length) }, () => worker()))
  return { resolved, unresolved }
}

async function resolveMissingRouteCoordinates() {
  if (route.name !== 'TransportBaseData' || activeBaseDataTab.value !== 'route' || routeCoordinateBackfillRunning)
    return

  const rows = transportBaseRouteRows.value.filter((row) => {
    const loadingMissing = String(row.loadingAddress || '').trim()
      && !validRouteCoordinatePair(row.loadingLongitude, row.loadingLatitude)
    const unloadingMissing = String(row.unloadingAddress || '').trim()
      && !validRouteCoordinatePair(row.unloadingLongitude, row.unloadingLatitude)
    return loadingMissing || unloadingMissing
  })
  if (!rows.length)
    return

  routeCoordinateBackfillRunning = true
  try {
    const summary = await resolveImportedRouteCoordinates(rows)
    if (summary.resolved) {
      baseDataVersion.value += 1
      await flushTransportOperationData()
      refreshModuleList()
      message.success(`已自动补齐 ${summary.resolved} 个装卸车点坐标`)
    }
    if (summary.unresolved)
      message.warning(`${summary.unresolved} 个装卸车点未找到精确坐标，已保留为空，请人工确认`)
  }
  catch {
    message.warning('路线坐标自动回填暂时不可用，请稍后重试')
  }
  finally {
    routeCoordinateBackfillRunning = false
  }
}

function enqueueRouteCoordinateAutosave(stage: RouteCoordinateStage, address: string, coordinate: [number, number]) {
  routeCoordinateAutosaveQueue = routeCoordinateAutosaveQueue
    .catch(() => undefined)
    .then(() => persistRouteCoordinateChange(stage, address, coordinate))
  return routeCoordinateAutosaveQueue
}

async function persistRouteCoordinateChange(stage: RouteCoordinateStage, address: string, coordinate: [number, number]) {
  const editingCode = String(baseDataEditingCode.value || '').trim()
  if (!editingCode)
    return
  const row = transportBaseRouteRows.value.find(item => item.code === editingCode)
  if (!row)
    return

  const fields = routeCoordinateFields(stage)
  const snapshot = { ...row }
  Object.assign(row, {
    [fields.address]: address,
    [fields.longitude]: coordinate[0].toFixed(6),
    [fields.latitude]: coordinate[1].toFixed(6),
    updatedAt: dayjs().format('YYYY-MM-DD'),
  })
  baseDataVersion.value += 1
  try {
    const hasBothCoordinates = validRouteCoordinatePair(row.loadingLongitude, row.loadingLatitude)
      && validRouteCoordinatePair(row.unloadingLongitude, row.unloadingLatitude)
    if (hasBothCoordinates)
      await syncRouteGeofencesForPayload(row)
    await flushTransportOperationData()
    refreshModuleList()
  }
  catch (error) {
    Object.assign(row, snapshot)
    baseDataVersion.value += 1
    throw error
  }
}

async function autoResolveRouteCoordinates(field: string) {
  if (activeBaseDataTab.value !== 'route' || !['loadingAddress', 'unloadingAddress'].includes(field))
    return

  const stage = field === 'loadingAddress' ? 'loading' : 'unloading'
  const longitudeField = stage === 'loading' ? 'loadingLongitude' : 'unloadingLongitude'
  const latitudeField = stage === 'loading' ? 'loadingLatitude' : 'unloadingLatitude'
  const address = String(baseDataForm[field] || '').trim()
  const normalizedAddress = normalizeCoordinateAddress(address)
  if (!normalizedAddress)
    return

  if (address === routeCoordinateSourceAddress[stage] && validCoordinatePair(baseDataForm[longitudeField], baseDataForm[latitudeField]))
    return

  routeCoordinateResolving[stage] = true
  try {
    const historicalRoute = transportBaseRouteRows.value.find((row) => {
      const rowAddress = stage === 'loading' ? row.loadingAddress : row.unloadingAddress
      const longitude = stage === 'loading' ? row.loadingLongitude : row.unloadingLongitude
      const latitude = stage === 'loading' ? row.loadingLatitude : row.unloadingLatitude
      return normalizeCoordinateAddress(rowAddress) === normalizedAddress && validCoordinatePair(longitude, latitude)
    })
    let coordinate = historicalRoute
      ? validCoordinatePair(
          stage === 'loading' ? historicalRoute.loadingLongitude : historicalRoute.unloadingLongitude,
          stage === 'loading' ? historicalRoute.loadingLatitude : historicalRoute.unloadingLatitude,
        )
      : undefined

    if (!coordinate) {
      const response = await getGpsGeofencesApi()
      const fence = (response.data || []).find(item => item.shape === 'circle'
        && item.center
        && normalizeCoordinateAddress(item.address) === normalizedAddress)
      coordinate = fence?.center && validCoordinatePair(fence.center[0], fence.center[1])
    }

    if (!coordinate) {
      const geocodeResult = await geocodeGpsAddressApi(address)
      if (geocodeResult.code === 200 && geocodeResult.data?.precise)
        coordinate = validCoordinatePair(geocodeResult.data.longitude, geocodeResult.data.latitude)
      else if (geocodeResult.code === 200)
        message.warning(`${stage === 'loading' ? '装货地' : '卸货地'}仅匹配到${geocodeResult.data?.level || '行政区域'}，请在地图中确认`)
    }

    if (!coordinate) {
      baseDataForm[longitudeField] = ''
      baseDataForm[latitudeField] = ''
      routeCoordinateSourceAddress[stage] = ''
      message.warning(`${stage === 'loading' ? '装货地' : '卸货地'}未找到可信坐标，请在地图定位后确认`)
      return
    }

    baseDataForm[longitudeField] = coordinate[0].toFixed(6)
    baseDataForm[latitudeField] = coordinate[1].toFixed(6)
    routeCoordinateSourceAddress[stage] = address
    await enqueueRouteCoordinateAutosave(stage, address, coordinate)
  }
  catch {
    message.warning('坐标自动解析暂时不可用，请稍后重试')
  }
  finally {
    routeCoordinateResolving[stage] = false
  }
}

function syncBaseRouteGeofenceDraft() {
  if (activeBaseDataTab.value !== 'route')
    return
  const decorated = decorateRouteGeofences(baseDataForm)
  Object.assign(baseDataForm, {
    name: decorated.name,
    area: decorated.area,
    detailAddress: decorated.detailAddress,
    loadingFenceName: decorated.loadingFenceName,
    loadingFenceRadius: decorated.loadingFenceRadius,
    transitFenceName: decorated.transitFenceName,
    unloadingFenceName: decorated.unloadingFenceName,
    unloadingFenceRadius: decorated.unloadingFenceRadius,
    returnFenceName: decorated.returnFenceName,
  })
}

function getBaseDataRequiredField(tab: BaseDataTab) {
  if (tab.key === 'crew')
    return { dataIndex: 'plateNo', title: '车号' }
  if (tab.key === 'vehicle')
    return { dataIndex: 'fuelType', title: '燃料类型' }
  return baseDataFormColumns.value.find(column => !['code', 'status', 'updatedAt'].includes(column.dataIndex))
}

function getCustomerBidBalance(record: Record<string, string>) {
  return calculateCustomerBidBalance(record, transportOrderRows.value)
}

function fillBaseCrewVehicle(value: unknown) {
  const vehicle = baseVehicleOptions.value.find(option => option.value === String(value ?? ''))?.row
  if (!vehicle)
    return
  baseDataForm.plateNo = vehicle.code || ''
  baseDataForm.trailerNo = vehicle.trailerNo || ''
  if (!baseDataForm.driverName)
    baseDataForm.driverName = vehicle.driver || ''
  if (!baseDataForm.escortName)
    baseDataForm.escortName = vehicle.escort || ''
}

function fillBaseRouteCustomer(value: unknown) {
  const customer = baseCustomerOptions.value.find(option => option.value === String(value ?? ''))?.row
  if (!customer)
    return
  baseDataForm.customer = customer.name || ''
}

function getBaseVehicleRows() {
  return baseDataTabs.find(tab => tab.key === 'vehicle')?.rows ?? []
}

function getBaseCustomerRows() {
  return baseDataTabs.find(tab => tab.key === 'customer')?.rows ?? []
}

function getBaseCrewRows() {
  return baseDataTabs.find(tab => tab.key === 'crew')?.rows ?? []
}

function formatCrewVehicleInfo(row: Record<string, string>) {
  return `${row.plateNo || ''}${row.trailerNo ? ` / ${row.trailerNo}` : ''}`.trim()
}

function formatCrewName(row: Record<string, string>) {
  return `${row.driverName || ''}${row.escortName ? ` / ${row.escortName}` : ''}`.trim()
}

function normalizeBaseDataPayload(tab: BaseDataTab) {
  const payload = baseDataFormColumns.value.reduce<Record<string, string>>((target, column) => {
    target[column.dataIndex] = String(baseDataForm[column.dataIndex] ?? '').trim()
    return target
  }, {})

  if (tab.key === 'company') {
    payload.businessLicenseUrl = String(baseDataForm.businessLicenseUrl ?? '').trim()
    payload.roadTransportLicenseUrl = String(baseDataForm.roadTransportLicenseUrl ?? '').trim()
  }

  if (tab.key === 'crew') {
    payload.vehicleInfo = formatCrewVehicleInfo(payload)
    payload.name = formatCrewName(payload)
  }
  if (tab.key === 'vehicle') {
    ;['purchaseDate', 'insuranceExpireDate', 'inspectionExpireDate'].forEach((field) => {
      payload[field] = normalizeTransportDate(payload[field])
    })
  }
  if (tab.key === 'route') {
    routeCoordinateDataFields.forEach((field) => {
      payload[field] = String(baseDataForm[field] ?? '').trim()
    })
    payload.routeValidityType = String(baseDataForm.routeValidityType ?? payload.routeValidityType ?? '长期').trim() || '长期'
    payload.routeEffectiveStartDate = String(baseDataForm.routeEffectiveStartDate ?? '').trim()
    payload.routeEffectiveEndDate = String(baseDataForm.routeEffectiveEndDate ?? '').trim()
    if (payload.routeValidityType === '时间范围') {
      payload.routeValidityRange = payload.routeValidityRange
        || [payload.routeEffectiveStartDate, payload.routeEffectiveEndDate].filter(Boolean).join(' 至 ')
    }
    else {
      payload.routeValidityType = payload.routeValidityType || '长期'
      payload.routeValidityRange = ''
      payload.routeEffectiveStartDate = ''
      payload.routeEffectiveEndDate = ''
    }
    delete payload.routeEffectiveDateRange
    Object.assign(payload, decorateRouteGeofences(payload))
  }

  payload.updatedAt = payload.updatedAt || dayjs().format('YYYY-MM-DD')
  return payload
}

function getRouteCoordinateCenter(payload: Record<string, string>, stage: RouteCoordinateStage): [number, number] | undefined {
  const fields = routeCoordinateFields(stage)
  const longitude = String(payload[fields.longitude] ?? '').trim()
  const latitude = String(payload[fields.latitude] ?? '').trim()
  if (!longitude && !latitude)
    return undefined
  const coordinate = validRouteCoordinatePair(longitude, latitude)
  if (!coordinate)
    throw new Error(`${stage === 'loading' ? '装车地' : '卸车地'}经纬度不合法`)
  return coordinate
}

async function syncRouteGeofencesForPayload(payload: Record<string, string>) {
  const fenceResult = await syncGpsRouteGeofencesApi({
    routeCode: payload.code,
    routeName: payload.name,
    loadingAddress: payload.loadingAddress,
    unloadingAddress: payload.unloadingAddress,
    loadingCenter: getRouteCoordinateCenter(payload, 'loading'),
    unloadingCenter: getRouteCoordinateCenter(payload, 'unloading'),
    radius: 1500,
  })
  if (fenceResult.code !== 200)
    throw new Error(fenceResult.msg || '路线电子围栏创建失败')
}

function ensureVehicleForCrew(crew: Record<string, string>, previousCrew?: Record<string, string>) {
  const vehicles = getBaseVehicleRows()
  const previousPlateNo = previousCrew?.plateNo || previousCrew?.vehicleInfo?.split('/')[0]?.trim()
  let vehicle = vehicles.find(row => row.code === (previousPlateNo || crew.plateNo))
    || vehicles.find(row => row.code === crew.plateNo)

  if (!vehicle && crew.plateNo) {
    vehicle = {
      code: crew.plateNo,
      trailerNo: crew.trailerNo || '',
      area: '',
      name: '重型半挂牵引车',
      fuelType: '',
      driver: crew.driverName || '',
      escort: crew.escortName || '',
      status: '运营中',
      mileage: '0',
      purchaseDate: '',
      engineNo: '',
      vin: '',
      insuranceExpireDate: '',
      inspectionExpireDate: '',
      updatedAt: crew.updatedAt || dayjs().format('YYYY-MM-DD'),
    }
    vehicles.unshift(vehicle)
    return
  }

  if (!vehicle)
    return

  vehicle.code = crew.plateNo || vehicle.code
  vehicle.trailerNo = crew.trailerNo || ''
  vehicle.driver = crew.driverName || ''
  vehicle.escort = crew.escortName || ''
  vehicle.updatedAt = crew.updatedAt || dayjs().format('YYYY-MM-DD')
}

function syncCrewForVehicle(vehicle: Record<string, string>, previousVehicle?: Record<string, string>) {
  const crews = getBaseCrewRows()
  const previousPlateNo = previousVehicle?.code
  const crew = crews.find(row => row.plateNo === (previousPlateNo || vehicle.code))
    || crews.find(row => row.plateNo === vehicle.code)

  if (!crew)
    return

  crew.plateNo = vehicle.code || crew.plateNo
  crew.trailerNo = vehicle.trailerNo || ''
  crew.driverName = vehicle.driver || crew.driverName || ''
  crew.escortName = vehicle.escort || crew.escortName || ''
  crew.vehicleInfo = formatCrewVehicleInfo(crew)
  crew.name = formatCrewName(crew)
  crew.updatedAt = vehicle.updatedAt || dayjs().format('YYYY-MM-DD')
}

async function saveBaseDataRecord() {
  const tab = activeBaseDataTabConfig.value
  const nameColumn = getBaseDataRequiredField(tab)
  if (!baseDataForm.code?.trim()) {
    message.warning('请输入编号')
    return
  }
  if (nameColumn && !baseDataForm[nameColumn.dataIndex]?.trim()) {
    message.warning(`请输入${nameColumn.title}`)
    return
  }
  if (tab.key === 'route' && baseDataForm.routeValidityType === '时间范围') {
    if (!baseDataForm.routeEffectiveStartDate?.trim() || !baseDataForm.routeEffectiveEndDate?.trim()) {
      message.warning('请选择时间范围')
      return
    }
  }
  if (tab.key === 'customer' && toNumber(baseDataForm.bidAmount) > 0 && !baseDataForm.bidStartDate?.trim()) {
    message.warning('录入中标金额后，请选择开始时间')
    return
  }
  if (tab.key === 'route')
    await Promise.all([autoResolveRouteCoordinates('loadingAddress'), autoResolveRouteCoordinates('unloadingAddress')])

  baseDataSubmitting.value = true
  const snapshots = {
    companies: cloneDeep(transportBaseCompanyRows.value),
    customers: cloneDeep(transportBaseCustomerRows.value),
    vehicles: cloneDeep(transportBaseVehicleRows.value),
    crews: cloneDeep(transportBaseCrewRows.value),
    routes: cloneDeep(transportBaseRouteRows.value),
  }
  try {
    const payload = normalizeBaseDataPayload(tab)

    const duplicate = tab.rows.some(row => row.code === payload.code && row.code !== baseDataEditingCode.value)
    if (duplicate) {
      message.warning('编号已存在，请修改编号')
      return
    }

    const index = tab.rows.findIndex(row => row.code === baseDataEditingCode.value)
    const previousRecord = index > -1 ? { ...tab.rows[index] } : undefined
    const successMessage = index > -1 ? '基础资料已更新' : '基础资料已新增'
    if (index > -1) {
      tab.rows[index] = payload
    }
    else {
      if (tab.key === 'company')
        tab.rows.splice(0, tab.rows.length)
      tab.rows.unshift(payload)
    }
    if (tab.key === 'crew')
      ensureVehicleForCrew(payload, previousRecord)
    if (tab.key === 'vehicle')
      syncCrewForVehicle(payload, previousRecord)
    baseDataVersion.value += 1
    await nextTick()
    if (tab.key === 'route')
      await syncRouteGeofencesForPayload(payload)
    await flushTransportOperationData()
    message.success(successMessage)
    baseDataModalOpen.value = false
    refreshModuleList()
  }
  catch (error: any) {
    transportBaseCompanyRows.value.splice(0, transportBaseCompanyRows.value.length, ...snapshots.companies)
    transportBaseCustomerRows.value.splice(0, transportBaseCustomerRows.value.length, ...snapshots.customers)
    transportBaseVehicleRows.value.splice(0, transportBaseVehicleRows.value.length, ...snapshots.vehicles)
    transportBaseCrewRows.value.splice(0, transportBaseCrewRows.value.length, ...snapshots.crews)
    transportBaseRouteRows.value.splice(0, transportBaseRouteRows.value.length, ...snapshots.routes)
    message.error(error?.message || '基础资料保存失败，已恢复修改前数据')
  }
  finally {
    baseDataSubmitting.value = false
  }
}

function getTableScrollX(columns: Array<Record<string, any>>, minWidth = 1200) {
  return createBusinessTableScrollX(columns, minWidth)
}

function getTransportRowClassName(record: Record<string, string>) {
  if (route.name === 'TransportOrders' && isOrderFuelOverrun(record))
    return 'order-fuel-overrun-row'
  return ''
}

function openRecordDetail(record: Record<string, string>) {
  detailRecord.value = record
  detailOpen.value = true
}

function getDetailLabel(key: string) {
  return detailLabelMap[key] ?? '字段'
}

const detailEntries = computed(() => {
  if (!detailRecord.value)
    return []
  return Object.entries(detailRecord.value).filter(([key]) => !hiddenDetailKeys.has(key))
})

function isLockedBusinessRecord(record: Record<string, string>) {
  return /已审核|已归档|已作废|作废|已导入/.test(String(record.status ?? ''))
}

function getCurrentEditableRows(record: Record<string, string>) {
  if (route.name === 'TransportBaseData') {
    const activeBaseTab = baseDataTabs.find(tab => tab.key === activeBaseDataTab.value)
    return activeBaseTab?.rows
  }

  if (route.name === 'TransportOrders')
    return orderRows.value
  if (route.name === 'TransportFuel')
    return fuelRows.value
  if (route.name === 'TransportEtc')
    return etcRows.value

  return activeProfile.value.rows.includes(record) ? activeProfile.value.rows : undefined
}

function refreshModuleList() {
  loadModuleSummary()
}

async function updateBusinessStatus(record: Record<string, string>, status: string, successMessage: string) {
  const previousStatus = record.status
  try {
    record.status = status
    await nextTick()
    await flushTransportOperationData()
    message.success(successMessage)
    refreshModuleList()
  }
  catch (error: any) {
    record.status = previousStatus
    message.error(error?.message || '状态保存失败')
  }
}

async function submitTransportApproval(record: Record<string, string>) {
  if (['审批中', '已审核', '已入账', '已确认'].includes(String(record.status ?? '')) || String(record.approvalStatus ?? '') === '审批中')
    return message.warning('该记录已提交审批或已确认')

  const approvalMeta = resolveTransportApprovalMeta(record)
  if (!approvalMeta)
    return message.warning('当前模块暂未配置审批类型')

  const snapshot = { ...record }
  try {
    const detail = await submitApprovalApi({
      businessType: approvalMeta.businessType,
      businessModule: approvalMeta.moduleName,
      businessId: String(record.code ?? ''),
      businessNo: String(record.code ?? ''),
      title: approvalMeta.title,
      applicantId: 1,
      applicantName: '超级管理员',
      deptId: 'transport',
      deptName: '运输管理部',
      amount: approvalMeta.amount,
      formData: {
        moduleName: approvalMeta.moduleName,
        modulePath: route.path,
        plateNo: approvalMeta.plateNo,
        driver: approvalMeta.driver,
        occurredDate: approvalMeta.occurredDate,
        feeType: approvalMeta.feeType,
        routeLine: record.routeLine,
        status: record.status,
        amount: approvalMeta.amount,
        businessNo: record.code,
      },
    })
    record.approvalStatus = detail.data?.instance?.status || 'PENDING'
    record.approvalInstanceId = detail.data?.instance?.id || ''
    await updateBusinessStatus(record, '审批中', '已提交审批')
  }
  catch (error: any) {
    Object.assign(record, snapshot)
    message.error(error?.message || '提交审批失败')
  }
}

function resolveTransportApprovalMeta(record: Record<string, string>) {
  const routeName = String(route.name ?? '')
  if (routeName === 'TransportFuel') {
    return {
      businessType: 'transport_fuel',
      moduleName: '加油明细',
      feeType: '燃油费',
      title: `燃油费审批-${record.plateNo || record.code}`,
      amount: toNumber(record.amount),
      plateNo: record.plateNo || '',
      driver: record.driver || '',
      occurredDate: record.date || '',
    }
  }
  if (routeName === 'TransportEtc') {
    return {
      businessType: 'transport_etc',
      moduleName: 'ETC费用',
      feeType: 'ETC费',
      title: `ETC费审批-${record.plateNo || record.code}`,
      amount: toNumber(record.amount),
      plateNo: record.plateNo || '',
      driver: '',
      occurredDate: record.updatedAt || '',
    }
  }
  if (routeName === 'TransportOrders') {
    return {
      businessType: 'transport_order',
      moduleName: '运输订单',
      feeType: '运输订单',
      title: `运输订单审批-${record.code}`,
      amount: toNumber(record.freightTotal),
      plateNo: record.plateNo || '',
      driver: record.driver || '',
      occurredDate: record.shipDate || '',
    }
  }
  if (routeName === 'TransportDriverPayroll') {
    const plateNo = String(record.owner || '').split('/')[0]?.trim() || ''
    return {
      businessType: 'salary',
      moduleName: '司机薪酬',
      feeType: '工资',
      title: `司机薪酬审批-${record.name || record.code}`,
      amount: toNumber(record.amount),
      plateNo,
      driver: record.name || '',
      occurredDate: record.updatedAt || '',
    }
  }
  return undefined
}

function editBusinessRecord(record: Record<string, string>) {
  if (isLockedBusinessRecord(record))
    return message.warning('已审核、已归档、已作废的数据不能编辑')

  if (route.name === 'TransportBaseData') {
    openBaseDataEdit(record)
    return
  }

  if (route.name === 'TransportOrders') {
    editingOrderCode.value = record.code
    Object.assign(orderForm, createEmptyTransportOrderForm(), record, {
      sentWeight: formatOrderWeight(record.sentWeight),
      receivedWeight: formatOrderWeight(record.receivedWeight),
    })
    orderModalOpen.value = true
    return
  }

  if (['TransportFuel', 'TransportEtc', 'TransportDriverPayroll'].includes(String(route.name))) {
    businessEditingRecord.value = record
    Object.keys(businessEditForm).forEach(key => delete businessEditForm[key])
    Object.assign(businessEditForm, record)
    businessEditOpen.value = true
    return
  }

  message.warning('当前记录不支持编辑')
}

const businessEditFields = computed(() => {
  if (route.name === 'TransportFuel') {
    return [
      { key: 'date', label: '加油日期', type: 'date' },
      { key: 'plateNo', label: '车牌号' },
      { key: 'driver', label: '司机' },
      { key: 'location', label: '加油地点' },
      { key: 'product', label: '油品' },
      { key: 'quantity', label: '加油量' },
      { key: 'amount', label: '金额' },
      { key: 'status', label: '状态' },
    ]
  }
  if (route.name === 'TransportEtc') {
    return [
      { key: 'updatedAt', label: '通行日期', type: 'date' },
      { key: 'plateNo', label: '车牌号' },
      { key: 'routeLine', label: '通行路线' },
      { key: 'invoiceNo', label: '发票号码' },
      { key: 'cardNo', label: 'ETC卡号' },
      { key: 'amount', label: '金额' },
      { key: 'status', label: '状态' },
    ]
  }
  return [
    { key: 'name', label: '司机姓名' },
    { key: 'owner', label: '关联车辆' },
    { key: 'financeMonth', label: '财务月' },
    { key: 'salaryMode', label: '薪资模式' },
    { key: 'baseSalary', label: '基础工资' },
    { key: 'tripCommission', label: '趟次提成' },
    { key: 'allowance', label: '补贴' },
    { key: 'deduction', label: '扣款' },
    { key: 'amount', label: '实发金额' },
    { key: 'status', label: '状态' },
  ]
})

async function saveBusinessEdit() {
  const record = businessEditingRecord.value
  if (!record)
    return
  const snapshot = { ...record }
  businessEditSaving.value = true
  try {
    Object.assign(record, businessEditForm)
    await nextTick()
    await flushTransportOperationData()
    businessEditOpen.value = false
    refreshModuleList()
    message.success('编辑保存成功')
  }
  catch (error: any) {
    Object.assign(record, snapshot)
    message.error(error?.message || '编辑保存失败，已恢复原数据')
  }
  finally {
    businessEditSaving.value = false
  }
}

async function deleteBusinessRecord(record: Record<string, string>) {
  if (isLockedBusinessRecord(record))
    return message.warning('已审核、已归档、已作废的数据不能删除')

  const rows = getCurrentEditableRows(record)
  const index = rows?.findIndex(item => item.code === record.code)
  if (rows && index !== undefined && index > -1) {
    const snapshot = cloneDeep(rows)
    try {
      rows.splice(index, 1)
      await nextTick()
      await flushTransportOperationData({ confirmDestructiveReplace: true })
      message.success('删除成功')
      refreshModuleList()
    }
    catch (error: any) {
      rows.splice(0, rows.length, ...snapshot)
      message.error(error?.message || '删除失败，已恢复原数据')
    }
  }
}

async function downloadBusinessRecord(record: Record<string, string>) {
  const XLSX = await loadXlsx()
  const worksheet = XLSX.utils.json_to_sheet([{ ...record }])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '记录')
  XLSX.writeFile(workbook, `${record.code || pageTitle.value}_记录.xlsx`)
}

function reuploadBusinessRecord() {
  message.info('请使用列表右上角导入入口重新上传')
}

function getBusinessActions(record: Record<string, string>): RecordActionItem[] {
  const locked = isLockedBusinessRecord(record)
  const isOrder = route.name === 'TransportOrders'
  const isBaseVehicle = route.name === 'TransportBaseData' && (record.name === 'LNG牵引车' || record.name === '危化品运输车')
  const isImportLike = ['TransportOrders', 'TransportFuel', 'TransportEtc'].includes(String(route.name))

  return [
    {
      key: 'view',
      label: '查看',
      onClick: () => openRecordDetail(record),
    },
    {
      key: 'edit',
      label: '编辑',
      hidden: locked,
      onClick: () => editBusinessRecord(record),
    },
    {
      key: 'gps',
      label: isOrder ? '看轨迹' : '实时定位',
      hidden: !(isOrder || isBaseVehicle),
      onClick: () => openGpsMonitor(record),
    },
    {
      key: 'submit',
      label: '提交审核',
      hidden: !/草稿|已驳回/.test(String(record.status ?? '')),
      onClick: () => updateBusinessStatus(record, '待审核', '已提交审核'),
    },
    {
      key: 'submitApproval',
      label: '提交审批',
      hidden: true,
      onClick: () => submitTransportApproval(record),
    },
    {
      key: 'approve',
      label: '审核通过',
      hidden: !/待审核|待审批|审批中/.test(String(record.status ?? '')),
      onClick: () => updateBusinessStatus(record, '已审核', '审核通过'),
    },
    {
      key: 'reject',
      label: '审核驳回',
      hidden: !/待审核|待审批/.test(String(record.status ?? '')),
      onClick: () => updateBusinessStatus(record, '已驳回', '已驳回'),
    },
    {
      key: 'revoke',
      label: '撤回',
      hidden: !/待审核|待审批|审批中/.test(String(record.status ?? '')),
      onClick: () => updateBusinessStatus(record, '已撤回', '已撤回'),
    },
    {
      key: 'preview',
      label: '预览',
      hidden: !isImportLike,
      onClick: () => openRecordDetail(record),
    },
    {
      key: 'download',
      label: '下载',
      hidden: !isImportLike,
      onClick: () => downloadBusinessRecord(record),
    },
    {
      key: 'reupload',
      label: '重新上传',
      hidden: !isImportLike,
      onClick: reuploadBusinessRecord,
    },
    {
      key: 'void',
      label: '作废',
      danger: true,
      confirm: true,
      confirmTitle: '确定作废该记录？',
      hidden: /已作废|作废/.test(String(record.status ?? '')),
      onClick: () => updateBusinessStatus(record, '已作废', '已作废'),
    },
    {
      key: 'delete',
      label: '删除',
      danger: true,
      confirm: true,
      confirmTitle: '确定删除该记录？',
      hidden: locked,
      onClick: () => deleteBusinessRecord(record),
    },
  ]
}

async function loadModuleSummary() {
  summaryLoading.value = true
  try {
    const currentMonth = getCurrentFinancialMonthRange()
    const fiscalFilters = route.name === 'TransportBaseData'
      ? {
          financialYear: Number(currentMonth.key.slice(0, 4)),
          financialMonth: Number(currentMonth.key.slice(4, 6)),
          periodType: 'financialMonth' as const,
          startDate: currentMonth.startDate,
          endDate: currentMonth.endDate,
        }
      : queryFiscalPayload.value
    const res = await getTransportModuleSummaryApi({
      moduleName: String(route.name ?? 'TransportOrders'),
      rows: getModuleSummarySourceRows(),
      filters: {
        ...queryModel,
        ...fiscalFilters,
      },
    })
    moduleSummaryCards.value = res.data ?? []
  }
  finally {
    summaryLoading.value = false
  }
}

function getModuleSummarySourceRows() {
  return sourceTableRows.value
}

function isDriverPayrollMoneyColumn(dataIndex: unknown) {
  return ['modeAmount', 'baseSalary', 'tripCommission', 'allowance', 'deduction', 'grossSalary', 'netSalary'].includes(String(dataIndex))
}

function isDriverPayrollStatColumn(dataIndex: unknown) {
  return ['attendanceDays', 'tripCount'].includes(String(dataIndex))
}

function getSalaryModeColor(mode?: string) {
  if (String(mode || '').includes('固定'))
    return 'blue'
  if (String(mode || '').includes('纯'))
    return 'purple'
  if (String(mode || '').includes('里程'))
    return 'orange'
  return 'green'
}

function getSalaryModeClass(mode?: string) {
  if (String(mode || '').includes('固定'))
    return 'mode-fixed'
  if (String(mode || '').includes('纯'))
    return 'mode-mileage'
  if (String(mode || '').includes('里程'))
    return 'mode-base-mileage'
  return 'mode-base-diff'
}

function displayDriverPlateNos(record: Record<string, any>) {
  return String(record.plateNos || record.plateNo || '-').split(/[、,，/]/).map(item => item.trim()).filter(Boolean)
}

function normalizePayrollPlateNo(value: unknown) {
  return String(value ?? '').trim().replace(/[\s·•\-]/g, '').toUpperCase()
}

function removeDriverPlateNo(plate: string) {
  const plates = displayDriverPlateNos(driverModeForm).filter(item => item !== plate && item !== '-')
  driverModeForm.plateNos = plates.join('、')
}

function addDriverPlateNo() {
  const plate = normalizePayrollPlateNo(driverModeForm.newPlateNo)
  if (!plate)
    return
  const archivedVehicle = getBaseVehicleRows().some(row => normalizePayrollPlateNo(row.code) === plate)
  if (!archivedVehicle) {
    message.warning('请选择基础资料中的车辆')
    return
  }
  if (!driverModeForm.newPlateStartDate) {
    message.warning('请选择车牌启用日期')
    return
  }
  const plates = displayDriverPlateNos(driverModeForm).filter(item => item !== '-')
  if (!plates.includes(plate))
    plates.push(plate)
  driverModeForm.plateNos = plates.join('、')
  driverModeForm.plateStartDates[plate] = driverModeForm.newPlateStartDate
  driverModeForm.modeEffectiveDate = driverModeForm.newPlateStartDate
  driverModeForm.newPlateNo = ''
}

interface SalaryModeHistoryItem {
  mode: string
  startDate: string
  amount: string
}

function parseSalaryModeHistory(record: Record<string, any>): SalaryModeHistoryItem[] {
  const financialMonthStart = getDriverFinancialMonthStart(record)
  try {
    const parsed = JSON.parse(String(record.salaryModeHistory || '[]'))
    if (Array.isArray(parsed) && parsed.length) {
      const history = parsed
        .filter(item => item?.mode && dayjs(item?.startDate).isValid())
        .map(item => ({ mode: String(item.mode), startDate: String(item.startDate), amount: formatPlainAmount(toNumber(item.amount)) }))
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
      return history
    }
  }
  catch {}
  return [{
    mode: String(record.salaryMode || '固定月薪'),
    startDate: financialMonthStart,
    amount: formatPlainAmount(toNumber(record.modeAmount || (normalizeSalaryMode(record.salaryMode).includes('固定') || normalizeSalaryMode(record.salaryMode) === '底薪+差费' ? record.baseSalary : record.tripCommission))),
  }]
}

function getSalaryModeForDate(record: Record<string, any>, date: string) {
  return parseSalaryModeHistory(record).filter(item => !dayjs(date).isBefore(dayjs(item.startDate), 'day')).at(-1)
}

function getActiveDriverPlates(record: Record<string, any>, date: string) {
  let startDates: Record<string, string> = {}
  try {
    startDates = JSON.parse(String(record.plateStartDates || '{}'))
  }
  catch {}
  return displayDriverPlateNos(record)
    .map(normalizePayrollPlateNo)
    .filter((plate) => {
      const startDate = startDates[plate] || startDates[displayDriverPlateNos(record).find(item => normalizePayrollPlateNo(item) === plate) || '']
      return !startDate || !dayjs(date).isBefore(dayjs(startDate), 'day')
    })
}

function findDuplicatePlateAttendance(record: Record<string, any>, date: string) {
  const currentCode = String(record.code || '')
  const currentPlates = new Set(getActiveDriverPlates(record, date))
  const financeMonth = normalizeMonthKey(record.financeMonth)
  for (const row of transportDriverPayrollRows.value) {
    if (String(row.code || '') === currentCode
      || !String(row.crewRole || '司机').includes('司机')
      || normalizeMonthKey(row.financeMonth) !== financeMonth
      || !isAttendanceDateMarked(row, date)) {
      continue
    }
    const duplicatePlate = getActiveDriverPlates(row, date).find(plate => currentPlates.has(plate))
    if (duplicatePlate)
      return duplicatePlate
  }
  return ''
}

function isDriverModeActive(record: Record<string, any>, date: string) {
  return Boolean(getSalaryModeForDate(record, date))
}

function getDriverFinancialMonthStart(record: Record<string, any>) {
  const financeMonthDate = /^\d{4}-\d{2}$/.test(String(record.financeMonth || ''))
    ? dayjs(`${record.financeMonth}-01`)
    : dayjs(todayAttendanceDate.value)
  return getFinancialMonthByDate(financeMonthDate).displayStartDate
}

function isAttendanceDateColored(record: Record<string, any>, date: string) {
  return isAttendanceDateMarked(record, date) && isDriverModeActive(record, date)
}

function openDriverModeConfig(record: Record<string, any>) {
  syncDriverPayrollFromBaseData()
  driverModeEditingRecord.value = record
  driverModeForm.plateNos = String(record.plateNos || record.plateNo || '')
  driverModeForm.newPlateNo = ''
  driverModeForm.newPlateStartDate = getDriverFinancialMonthStart(record)
  try {
    driverModeForm.plateStartDates = JSON.parse(String(record.plateStartDates || '{}'))
  }
  catch {
    driverModeForm.plateStartDates = {}
  }
  driverModeForm.salaryMode = normalizeSalaryMode(record.salaryMode)
  driverModeForm.currentSalaryMode = driverModeForm.salaryMode
  driverModeForm.modeHistory = parseSalaryModeHistory(record)
  driverModeForm.modeEffectiveDate = todayAttendanceDate.value || getDriverFinancialMonthStart(record)
  driverModeForm.modeAmount = toNumber(record.modeAmount || (driverModeForm.salaryMode.includes('固定') || driverModeForm.salaryMode === '底薪+差费' ? record.baseSalary : record.tripCommission))
  driverModeModalOpen.value = true
}

async function saveDriverModeConfig() {
  if (driverModeSaving.value)
    return
  const record = driverModeEditingRecord.value
  if (!record)
    return

  const snapshot = { ...record }
  const previousMode = String(record.salaryMode || '固定月薪')
  const previousAmount = formatPlainAmount(toNumber(record.modeAmount))
  const effectiveDate = String(driverModeForm.modeEffectiveDate || '')
  if (!dayjs(effectiveDate).isValid()) {
    message.warning('请选择模式生效日期')
    return
  }
  record.salaryMode = driverModeForm.salaryMode
  record.modeAmount = formatPlainAmount(toNumber(driverModeForm.modeAmount))
  const plates = displayDriverPlateNos(driverModeForm).filter(item => item !== '-')
  if (!plates.length) {
    message.warning('请至少保留一个车牌号')
    return
  }
  record.plateNos = plates.join('、')
  record.plateNo = plates[0]
  record.plateStartDates = JSON.stringify(driverModeForm.plateStartDates)
  record.owner = `${record.plateNos} / ${record.financeMonth || ''}`
  record.manualPlateNos = 'true'
  const financialMonthStart = getDriverFinancialMonthStart(record)
  if (previousMode !== record.salaryMode || previousAmount !== record.modeAmount || effectiveDate !== record.modeStartDate) {
    const history = parseSalaryModeHistory({ ...record, salaryMode: previousMode, modeAmount: previousAmount })
      .filter(item => item.startDate !== effectiveDate)
    const hasEarlierDifferentMode = history.some(item => item.startDate < effectiveDate && normalizeSalaryMode(item.mode) !== normalizeSalaryMode(record.salaryMode))
    if (effectiveDate > financialMonthStart && !hasEarlierDifferentMode) {
      const openingAmount = formatPlainAmount(toNumber(record.baseSalary || previousAmount))
      history.splice(0, history.length, { mode: '固定月薪', startDate: financialMonthStart, amount: openingAmount })
    }
    history.push({ mode: record.salaryMode, startDate: effectiveDate, amount: record.modeAmount })
    history.sort((a, b) => a.startDate.localeCompare(b.startDate))
    record.salaryModeHistory = JSON.stringify(history)
    record.modeStartDate = effectiveDate
  }
  if (record.salaryMode.includes('固定') || record.salaryMode === '底薪+差费')
    record.baseSalary = record.modeAmount
  else
    record.tripCommission = record.modeAmount
  recalculateDriverPayroll(record)
  driverModeSaving.value = true
  try {
    await nextTick()
    await flushTransportOperationData()
    driverModeModalOpen.value = false
    message.success('司机计薪配置已保存')
  }
  catch (error: any) {
    Object.assign(record, snapshot)
    message.error(error?.message || '司机计薪配置保存失败')
  }
  finally {
    driverModeSaving.value = false
  }
}

function getAttendanceStatusColor(value?: string) {
  return value === '出勤' ? 'green' : 'default'
}

function parseAttendanceDates(record: Record<string, any>) {
  return new Set(String(record.attendanceDates || '').split(',').map(item => item.trim()).filter(Boolean))
}

function writeAttendanceDates(record: Record<string, any>, dates: Set<string>) {
  const sortedDates = [...dates].sort()
  record.attendanceDates = sortedDates.join(',')
  record.attendanceDays = String(sortedDates.length)
  record.lastAttendanceDate = sortedDates[sortedDates.length - 1] || ''
  record.todayAttendance = dates.has(todayAttendanceDate.value) ? '出勤' : '空白'
}

function isAttendanceDateMarked(record: Record<string, any>, date: string) {
  return parseAttendanceDates(record).has(date)
}

async function setAttendanceDate(record: Record<string, any>, date: string, attended: boolean) {
  if (!String(record.crewRole || '司机').includes('司机')) {
    message.info('押运员无需记录考勤')
    return
  }

  if (attended && !getSalaryModeForDate(record, date)) {
    message.warning('所选日期早于计薪模式生效日期')
    return
  }

  const duplicatePlate = attended ? findDuplicatePlateAttendance(record, date) : ''
  if (duplicatePlate) {
    message.warning(`${duplicatePlate} 在 ${date} 已登记司机考勤，同一天不能重复`)
    return
  }

  const snapshot = { ...record }
  const dates = parseAttendanceDates(record)
  if (attended)
    dates.add(date)
  else
    dates.delete(date)

  writeAttendanceDates(record, dates)
  recalculateDriverPayroll(record)
  try {
    await nextTick()
    await flushTransportOperationData()
  }
  catch (error: any) {
    Object.assign(record, snapshot)
    message.error(error?.message || '考勤保存失败，已恢复原数据')
  }
}

async function toggleAttendanceDate(record: Record<string, any>, date: string) {
  await setAttendanceDate(record, date, !isAttendanceDateMarked(record, date))
}

async function markTodayAttendance(record: Record<string, any>, attended = true) {
  await setAttendanceDate(record, todayAttendanceDate.value, attended)
}

function recalculateDriverPayroll(record: Record<string, any>) {
  const mode = normalizeSalaryMode(record.salaryMode)
  const modeAmount = toNumber(record.modeAmount || (mode.includes('固定') || mode === '底薪+差费' ? record.baseSalary : record.tripCommission))
  const allowance = toNumber(record.allowance)
  const deduction = toNumber(record.deduction)
  const attendanceDates = [...parseAttendanceDates(record)]
    .filter(date => getSalaryModeForDate(record, date))
    .sort()
  const activeModes = new Map<string, SalaryModeHistoryItem>()
  let fixedPay = 0
  let variablePay = 0
  attendanceDates.forEach((date) => {
    const activeMode = getSalaryModeForDate(record, date)
    if (!activeMode)
      return
    const normalizedMode = normalizeSalaryMode(activeMode.mode)
    activeModes.set(`${normalizedMode}-${activeMode.startDate}`, activeMode)
    if (normalizedMode.includes('固定') || normalizedMode === '底薪+差费')
      fixedPay += toNumber(activeMode.amount) / 30
  })
  activeModes.forEach((activeMode) => {
    const normalizedMode = normalizeSalaryMode(activeMode.mode)
    if (!normalizedMode.includes('固定') && normalizedMode !== '底薪+差费')
      variablePay += toNumber(activeMode.amount)
  })
  fixedPay = Math.round(fixedPay * 100) / 100
  variablePay = Math.round(variablePay * 100) / 100
  const orderExtraFee = getDriverOrderExtraFee(record)
  record.salaryMode = mode
  record.modeAmount = formatPlainAmount(modeAmount)
  const modePay = fixedPay + variablePay + orderExtraFee
  record.baseSalary = formatPlainAmount(fixedPay)
  record.tripCommission = formatPlainAmount(variablePay + orderExtraFee)
  const grossSalary = Math.max(0, modePay + allowance)
  const netSalary = Math.max(0, grossSalary - deduction)

  record.grossSalary = formatPlainAmount(grossSalary)
  record.netSalary = formatPlainAmount(netSalary)
  record.amount = record.netSalary
  if (!String(record.status || '').includes('已发放'))
    record.status = '核算中'
}

function getDriverSalaryComposition(record: Record<string, any>) {
  const mode = normalizeSalaryMode(record.salaryMode)
  const amount = formatPlainAmount(toNumber(record.modeAmount))
  if (mode === '底薪+差费')
    return `底薪 ${amount} + 运单差费 ${formatPlainAmount(getDriverOrderExtraFee(record))}`
  if (mode === '市区倒短固定工资')
    return `固定金额 ${amount}`
  if (mode === '固定月薪')
    return `固定金额 ${amount}`
  return `模式金额 ${amount}`
}

function recalculateAllDriverPayroll() {
  transportDriverPayrollRows.value
    .filter(record => String(record.crewRole || '司机').includes('司机'))
    .forEach(record => recalculateDriverPayroll(record))
}

function getDriverOrderExtraFee(record: Record<string, any>) {
  const driverName = String(record.name || '').replace(/\s+/g, '')
  const financeMonth = normalizeMonthKey(record.financeMonth)
  if (!driverName || !financeMonth)
    return 0

  return orderRows.value.reduce((total, order) => {
    const orderDriver = String(order.driver || '').replace(/\s+/g, '')
    const orderMonth = normalizeMonthKey(order.financeMonth || order.month || order.shipDate)
    const orderDate = dayjs(order.shipDate || order.updatedAt)
    const activeMode = orderDate.isValid() ? getSalaryModeForDate(record, orderDate.format('YYYY-MM-DD')) : undefined
    return orderDriver === driverName && orderMonth === financeMonth && normalizeSalaryMode(activeMode?.mode) === '底薪+差费'
      ? total + toNumber(order.extraFee)
      : total
  }, 0)
}

function openGpsMonitor(record: Record<string, string>) {
  const plateNo = record.plateNo || record.name || record.vehicleDriver?.split('/')[0]?.trim()
  router.push({
    path: '/transport/tracking',
    query: {
      businessType: route.name === 'TransportOrders' ? 'transport_order' : 'vehicle_archive',
      businessId: record.code,
      plateNo,
    },
  })
}

function formatFiscalMonthSummary(keys: string[]) {
  const periods = keys
    .map(key => parseFinancialMonthKey(key))
    .filter((period): period is NonNullable<ReturnType<typeof parseFinancialMonthKey>> => !!period)
    .sort((a, b) => a.key.localeCompare(b.key))

  if (!periods.length)
    return '-'

  if (periods.length === 1) {
    const [period] = periods
    return `${period.label}（${formatFinancialDisplayRange(period)}）`
  }

  const first = periods[0]
  const last = periods[periods.length - 1]
  return `${first.label} 至 ${last.label}`
}

function buildOrderSummary(rows: TransportOrderRecord[]): OrderSummary {
  const normalizedRows: TransportOrderRecord[] = rows.map((row) => {
    const financeMonth = normalizeFinanceMonth(row.financeMonth, row.shipDate)
    return {
      ...row,
      financeMonth,
    }
  })
  const months = [...new Set(normalizedRows.map(row => row.financeMonth).filter(Boolean))].sort()
  const dates = rows.map(row => row.shipDate).filter(Boolean).sort()
  const plateCount = new Set(normalizedRows.map(row => row.plateNo).filter(Boolean)).size
  const totalAmount = normalizedRows.reduce((sum, row) => sum + toNumber(row.freightTotal), 0)

  return {
    monthRange: formatFiscalMonthSummary(months),
    recordCount: normalizedRows.length,
    plateCount,
    totalAmount: formatFuelAmount(totalAmount),
    dateRange: dates.length > 1 ? `${dates[0]} 至 ${dates[dates.length - 1]}` : (dates[0] || '-'),
    rows: normalizedRows as TransportOrderRecord[],
  }
}

function applyOrderRecords(summary: OrderSummary) {
  const normalizedSummary = buildOrderSummary(summary.rows)
  orderRows.value = mergeTransportRecords(orderRows.value, normalizedSummary.rows)
  recalculateAllDriverPayroll()
  syncTransportCustomersFromOrders()
  baseDataVersion.value += 1
  orderImportSummary.value = buildOrderSummary(orderRows.value)
}

function importOrderRecords(summary: OrderSummary, file?: File) {
  const normalizedSummary = buildOrderSummary(summary.rows)
  openImportPreview({
    kind: 'order',
    title: '运输订单导入确认',
    fileName: file?.name ?? '运单导入.xlsx',
    fileSize: file?.size,
    rows: normalizedSummary.rows,
    apply: selectedRows => applyOrderRecords(buildOrderSummary(selectedRows as TransportOrderRecord[])),
  })
}

async function importOrderRecordsFromFile(file: File) {
  openParsingImport('order', '运输订单导入确认', file)
  const [sheet] = await parseTransportWorkbook(file)
  if (!sheet) {
    openImportFailure('order', '运输订单导入确认', file, '未识别到运单工作表')
    return
  }

  const rows = normalizeOrderRows(readOrderRowsFromMatrix(sheet.matrix))
  if (!rows.length) {
    openImportFailure('order', '运输订单导入确认', file, '未识别到订单编号、车辆、路线、运费等运单字段')
    return
  }

  importOrderRecords(buildOrderSummary(rows), file)
}

function beforeUploadOrderRecords(file: File) {
  void importOrderRecordsFromFile(file)
  return false
}

function resetOrderForm() {
  Object.assign(orderForm, createEmptyTransportOrderForm())
}

function syncOrderDerivedAmounts() {
  const weight = toNumber(orderForm.receivedWeight || orderForm.sentWeight)
  const mileage = toNumber(orderForm.mileage)
  const price = toNumber(orderForm.freightPrice)
  const extraFee = toNumber(orderForm.extraFee)
  const formula = orderForm.priceFormula === '吨位×运距×单价' ? '吨位×运距×单价' : '吨位×单价'
  const baseAmount = calculateTransportFreight(weight, mileage, price, formula)
  const freightTotal = baseAmount > 0 ? baseAmount + extraFee : 0

  orderForm.taxRate = '9.00%'
  orderForm.freightTotal = freightTotal > 0 ? freightTotal.toFixed(2) : ''
  orderForm.taxedFreight = freightTotal > 0 ? calculateTransportFreightExcludingTax(freightTotal).toFixed(2) : ''

  const lossAmount = toNumber(orderForm.lossWeight) * toNumber(orderForm.lossUnitPrice)
  orderForm.lossAmount = lossAmount.toFixed(2)
}

function syncOrderPriceFormula() {
  orderForm.priceFormula = getTransportFreightFormula(toNumber(orderForm.freightPrice))
  syncOrderDerivedAmounts()
}

function fillOrderVehicle(value: unknown) {
  const plateNo = String(value ?? '')
  const vehicle = vehicleOptions.value.find(option => option.value === plateNo)?.row
  if (!vehicle)
    return

  orderForm.plateNo = vehicle.plateNo
  orderForm.trailerNo = vehicle.trailerNo || ''
  orderForm.driver = vehicle.driverName || vehicle.driver || ''
  orderForm.escort = vehicle.escortName || ''
  syncOrderPlannedFuelConsumption()
  syncOrderEtcFee()
}

function clearOrderRouteFields() {
  orderForm.routeLine = ''
  orderForm.loadingAddress = ''
  orderForm.unloadingAddress = ''
  orderForm.mileage = ''
  orderForm.freightPrice = ''
  orderForm.extraFee = ''
  orderForm.plannedFuelConsumption = ''
  syncOrderDerivedAmounts()
}

function fillOrderCustomer(value: unknown) {
  const customer = String(value ?? '')
  orderForm.customer = customer
  const currentRoute = importedRouteRows.find(row => row.name === orderForm.routeLine)
  if (currentRoute && currentRoute.customer !== customer)
    clearOrderRouteFields()
}

function syncOrderPlannedFuelConsumption() {
  const routeItem = importedRouteRows.find(row => row.name === orderForm.routeLine)
  orderForm.plannedFuelConsumption = getRoutePlannedFuelConsumption(routeItem, orderForm.plateNo, orderForm.routeType)
}

function fillOrderRoute(value: unknown) {
  const routeName = String(value ?? '')
  const routeItem = importedRouteRows.find(row => row.name === routeName)
  if (!routeItem)
    return

  orderForm.customer = routeItem.customer
  orderForm.routeLine = routeItem.name
  orderForm.loadingAddress = routeItem.loadingAddress
  orderForm.unloadingAddress = routeItem.unloadingAddress
  orderForm.mileage = routeItem.distance || ''
  orderForm.freightPrice = routeItem.freightPrice || orderForm.freightPrice
  orderForm.extraFee = routeItem.extraFee || orderForm.extraFee
  syncOrderPlannedFuelConsumption()
  syncOrderPriceFormula()
}

function syncOrderEtcFee() {
  const plateKey = normalizePlateNo(orderForm.plateNo)
  const currentTime = parseBusinessDayTime(orderForm.shipDate)
  if (!plateKey || !currentTime) {
    orderForm.etcFee = '0.00'
    return
  }

  const previousOrderTime = orderRows.value
    .filter(row => row.code !== editingOrderCode.value && normalizePlateNo(row.plateNo) === plateKey)
    .map(row => parseBusinessDayTime(row.shipDate))
    .filter((time): time is number => Boolean(time && time < currentTime))
    .sort((a, b) => b - a)[0]
  const total = etcRows.value.reduce((sum, etc) => {
    if (normalizePlateNo(etc.plateNo) !== plateKey)
      return sum
    const feeTime = parseBusinessDayTime(etc.updatedAt)
    return feeTime && isFeeInClosingOrderPeriod(feeTime, previousOrderTime, currentTime)
      ? sum + toNumber(etc.amount)
      : sum
  }, 0)
  orderForm.etcFee = total.toFixed(2)
}

function openOrderModal() {
  editingOrderCode.value = ''
  resetOrderForm()
  orderModalOpen.value = true
}

async function submitOrderForm() {
  if (orderSaving.value)
    return
  if (!orderForm.code || !orderForm.plateNo || !orderForm.routeLine) {
    message.warning('请至少填写订单编号、车辆和路线')
    return
  }
  orderForm.financeMonth = normalizeFinanceMonth(orderForm.financeMonth, orderForm.shipDate)
  orderForm.sentWeight = formatOrderWeight(orderForm.sentWeight)
  orderForm.receivedWeight = formatOrderWeight(orderForm.receivedWeight)
  orderSaving.value = true
  const newOrder = decorateOrderRecord({ ...orderForm })
  let snapshot: { orders: any[], customers: any[], routes: any[] } | undefined
  try {
    await refreshTransportOperationDataForOrderSave()
    if (transportOperationError.value)
      throw new Error(transportOperationError.value)
    snapshot = {
      orders: cloneDeep(orderRows.value),
      customers: cloneDeep(transportBaseCustomerRows.value),
      routes: cloneDeep(transportBaseRouteRows.value),
    }
    if (editingOrderCode.value) {
      const index = orderRows.value.findIndex(row => row.code === editingOrderCode.value)
      if (index > -1)
        orderRows.value[index] = newOrder
    }
    else {
      orderRows.value = [newOrder, ...orderRows.value]
    }
    recalculateAllDriverPayroll()
    syncTransportCustomersFromOrders()
    baseDataVersion.value += 1
    orderImportSummary.value = buildOrderSummary(orderRows.value)
    await nextTick()
    await flushTransportOperationData()
    orderModalOpen.value = false
    message.success(editingOrderCode.value ? `已更新运单 ${newOrder.code}` : `已新增运单 ${newOrder.code}`)
    editingOrderCode.value = ''
  }
  catch (error: any) {
    if (snapshot) {
      orderRows.value = snapshot.orders
      transportBaseCustomerRows.value.splice(0, transportBaseCustomerRows.value.length, ...snapshot.customers)
      transportBaseRouteRows.value.splice(0, transportBaseRouteRows.value.length, ...snapshot.routes)
    }
    message.error(error?.message || '运单保存失败，已恢复修改前数据')
  }
  finally {
    orderSaving.value = false
  }
}

watch(
  () => [
    orderForm.sentWeight,
    orderForm.receivedWeight,
    orderForm.mileage,
    orderForm.extraFee,
    orderForm.taxRate,
    orderForm.lossWeight,
    orderForm.lossUnitPrice,
  ],
  syncOrderDerivedAmounts,
)

watch(
  () => orderForm.freightPrice,
  syncOrderPriceFormula,
)

watch(
  () => [orderForm.plateNo, orderForm.shipDate, etcRows.value],
  syncOrderEtcFee,
  { deep: true },
)

function normalizePlateNo(value?: string) {
  return String(value ?? '').replace(/[\s·.。-]/g, '').toUpperCase()
}

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return value
  }
  const numberText = String(value ?? '').replace(/[^\d.-]/g, '')
  return Number(numberText) || 0
}

function getVehicleArchive(plateNo?: string) {
  const plateKey = normalizePlateNo(plateNo)
  return getBaseVehicleRows().find(row => normalizePlateNo(row.code || row.plateNo) === plateKey)
}

function getVehicleAgeType(plateNo?: string): 'new' | 'old' {
  const vehicle = getVehicleArchive(plateNo)
  const purchaseDate = dayjs(normalizeTransportDate(vehicle?.purchaseDate))
  if (!purchaseDate.isValid())
    return 'old'
  return dayjs().diff(purchaseDate, 'year', true) < 3 ? 'new' : 'old'
}

function getRoutePlannedFuelConsumption(routeItem?: Record<string, string>, plateNo?: string, routeType?: string) {
  if (!routeItem)
    return ''
  const vehicleAgeType = getVehicleAgeType(plateNo)
  const vehicle = getVehicleArchive(plateNo)
  const fuelKind = resolveVehicleFuelKind(vehicle?.fuelType)
  const isRoundTrip = /往返|双程/.test(String(routeType ?? ''))
  const oneWayFieldMap = {
    gas: {
      new: 'newGasVehiclePlannedFuelConsumption',
      old: 'oldGasVehiclePlannedFuelConsumption',
    },
    diesel: {
      new: 'newDieselVehiclePlannedFuelConsumption',
      old: 'oldDieselVehiclePlannedFuelConsumption',
    },
  }
  const roundTripFieldMap = {
    gas: {
      new: 'roundTripNewGasVehiclePlannedFuelConsumption',
      old: 'roundTripOldGasVehiclePlannedFuelConsumption',
    },
    diesel: {
      new: 'roundTripNewDieselVehiclePlannedFuelConsumption',
      old: 'roundTripOldDieselVehiclePlannedFuelConsumption',
    },
  }
  const legacyField = vehicleAgeType === 'new' ? 'newVehiclePlannedFuelConsumption' : 'oldVehiclePlannedFuelConsumption'
  const oneWayField = oneWayFieldMap[fuelKind][vehicleAgeType]
  const roundTripField = roundTripFieldMap[fuelKind][vehicleAgeType]
  const oneWayPlan = routeItem[oneWayField] || routeItem[legacyField] || routeItem.plannedFuelConsumption || getDefaultRouteFuelPlan(routeItem.distance, vehicleAgeType, fuelKind)
  const normalizedOneWayPlan = normalizeFuelPlanUnit(oneWayPlan, fuelKind)
  return isRoundTrip
    ? (normalizeFuelPlanUnit(routeItem[roundTripField], fuelKind) || doubleFuelPlan(normalizedOneWayPlan, fuelKind))
    : normalizedOneWayPlan
}

function getOrderPlannedFuelConsumption(record: Record<string, string>) {
  const routeItem = importedRouteRows.find(row => row.name === record.routeLine)
  return getRoutePlannedFuelConsumption(routeItem, record.plateNo, record.routeType) || record.plannedFuelConsumption || ''
}

function isOrderFuelOverrun(record: Record<string, string>) {
  const actualFuelVolume = toNumber(record.actualFuelVolume)
  const plannedFuelConsumption = toNumber(record.plannedFuelConsumption || getOrderPlannedFuelConsumption(record))
  return plannedFuelConsumption > 0 && actualFuelVolume > plannedFuelConsumption
}

function parseBusinessDate(value: unknown) {
  if (!value)
    return null
  const parsed = parseFuelDate(value)
  if (parsed)
    return parsed
  const day = dayjs(String(value))
  return day.isValid() ? day.toDate() : null
}

function parseBusinessDayTime(value: unknown) {
  const date = parseBusinessDate(value)
  return date ? dayjs(date).startOf('day').valueOf() : undefined
}

function formatPlainAmount(value: number) {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatFuelVolume(value: number) {
  return value ? `${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}L` : '0.00L'
}

function buildOrderExpenseBuckets() {
  const sortedOrders = [...orderRows.value]
    .map(row => ({ row, plateKey: normalizePlateNo(row.plateNo), time: parseBusinessDate(row.shipDate)?.getTime() ?? 0 }))
    .filter(item => item.plateKey && item.time)
    .sort((a, b) => a.plateKey.localeCompare(b.plateKey) || a.time - b.time)
  const orderGroups = new Map<string, typeof sortedOrders>()
  sortedOrders.forEach((item) => {
    if (!orderGroups.has(item.plateKey))
      orderGroups.set(item.plateKey, [])
    orderGroups.get(item.plateKey)!.push(item)
  })

  const bucketMap = new Map<string, { fuelVolume: number, fuelAmount: number, etcFee: number }>()
  sortedOrders.forEach(item => bucketMap.set(item.row.code, { fuelVolume: 0, fuelAmount: 0, etcFee: 0 }))

  function findOwnerOrder(plateNo: string, timeValue: unknown) {
    const time = parseBusinessDate(timeValue)?.getTime()
    const group = orderGroups.get(normalizePlateNo(plateNo))
    if (!time || !group?.length)
      return undefined
    return group.find((item, index) => {
      const next = group[index + 1]
      return time >= item.time && (!next || time < next.time)
    })?.row
  }
  function findClosingOrder(plateNo: string, timeValue: unknown) {
    const time = parseBusinessDayTime(timeValue)
    const group = orderGroups.get(normalizePlateNo(plateNo))
    if (!time || !group?.length)
      return undefined
    return group.find((item, index) => {
      const previous = group[index - 1]
      return isFeeInClosingOrderPeriod(time, previous?.time, item.time)
    })?.row
  }

  fuelRows.value.forEach((fuel) => {
    const order = findOwnerOrder(fuel.plateNo, fuel.date)
    if (!order)
      return
    const bucket = bucketMap.get(order.code)
    if (!bucket)
      return
    bucket.fuelVolume += toNumber(fuel.quantity)
    bucket.fuelAmount += toNumber(fuel.amount)
  })

  etcRows.value.forEach((etc) => {
    const order = findClosingOrder(etc.plateNo, etc.updatedAt)
    if (!order)
      return
    const bucket = bucketMap.get(order.code)
    if (!bucket)
      return
    bucket.etcFee += toNumber(etc.amount)
  })

  return bucketMap
}

const orderExpenseBuckets = computed(buildOrderExpenseBuckets)

function decorateOrderExpense(record: TransportOrderRecord): TransportOrderRecord {
  const bucket = orderExpenseBuckets.value.get(record.code)
  const plannedFuelConsumption = getOrderPlannedFuelConsumption(record)
  if (!bucket)
    return { ...record, plannedFuelConsumption: plannedFuelConsumption || record.plannedFuelConsumption }
  const nextRecord = {
    ...record,
    plannedFuelConsumption: plannedFuelConsumption || record.plannedFuelConsumption,
    actualFuelVolume: formatFuelVolume(bucket.fuelVolume),
    actualFuelAmount: formatPlainAmount(bucket.fuelAmount),
    etcFee: formatPlainAmount(bucket.etcFee),
  }
  return {
    ...nextRecord,
    fuelOverrun: isOrderFuelOverrun(nextRecord) ? '超计划' : '',
  }
}

function buildFuelSummary(rows: FuelRecord[]): FuelSummary {
  const normalizedRows = rows.map((row) => {
    const parsedDate = parseFuelDate(row.date)
    return {
      ...row,
      month: parsedDate ? financialMonthKey(parsedDate) : normalizeFinanceMonth(row.month),
    }
  })
  const months = [...new Set(normalizedRows.map(row => row.month).filter(Boolean))].sort()
  const dates = rows.map(row => row.date).filter(Boolean).sort()
  const plateCount = new Set(normalizedRows.map(row => row.plateNo).filter(Boolean)).size
  const totalAmount = normalizedRows.reduce((sum, row) => sum + toNumber(row.amount), 0)

  return {
    monthRange: formatFiscalMonthSummary(months),
    recordCount: normalizedRows.length,
    plateCount,
    totalAmount: formatFuelAmount(totalAmount),
    dateRange: dates.length > 1 ? `${dates[0]} 至 ${dates[dates.length - 1]}` : (dates[0] || '-'),
    rows: normalizedRows,
  }
}

function matchPdfText(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const matched = text.match(pattern)
    if (matched?.[1])
      return matched[1].trim()
  }
  return ''
}

function normalizePdfAmount(value: string) {
  const matched = value.match(/\d+(?:,\d{3})*(?:\.\d{1,2})?/)
  return matched ? matched[0].replace(/,/g, '') : ''
}

function normalizeEtcPdfDate(match: RegExpMatchArray) {
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')} ${match[4] || '00:00'}`
}

function findEtcAmountWindow(values: string[], count: number, total: number) {
  for (let start = 0; start + count <= values.length; start += 1) {
    const window = values.slice(start, start + count)
    const sum = window.reduce((result, value) => result + toNumber(value), 0)
    if (Math.abs(sum - total) < 0.01)
      return window
  }
  return []
}

function findEtcPairedAmounts(values: string[], count: number, total: number) {
  for (let start = 0; start + count * 2 <= values.length; start += 1) {
    const window = values.slice(start, start + count * 2)
    const amounts: string[] = []
    let paired = true
    for (let index = 0; index < window.length; index += 2) {
      if (Math.abs(toNumber(window[index]) - toNumber(window[index + 1])) >= 0.01) {
        paired = false
        break
      }
      amounts.push(window[index])
    }
    if (paired && Math.abs(amounts.reduce((sum, value) => sum + toNumber(value), 0) - total) < 0.01)
      return amounts
  }
  return []
}

function _parseEtcRowsFromPdfText(text: string, file: File): EtcRecord[] {
  const boundedText = text.slice(0, 250_000)
  const compactText = boundedText.replace(/\s+/g, ' ')
  const invoiceNo = matchPdfText(compactText, [
    /(?:票据号码|票据号|发票号码|发票号|No\.?)\s*(?:[:：]\s*)?([A-Z0-9\-]{6,})/i,
    /(?:票据号码|票据号|发票号码|发票号)[\s\S]{0,100}?(\d{16,})/,
    /\d{1,2}\s+\*\s+(\d{16,})\s+[\d,]+(?:\.\d{1,2})?/,
    /\*\s*(\d{16,})/,
  ])
  const plateNo = matchPdfText(compactText, [
    /(?:车牌号码|车牌号|车牌|车辆)\s*(?:[:：]\s*)?([\u4E00-\u9FA5]\s*[A-Z](?:\s*[A-Z0-9·\-.]){4,8})/i,
  ]).replace(/\s+/g, '').replace(/[.。-]/g, '·')
  const cardNo = matchPdfText(compactText, [
    /(?:ETC卡号|通行卡号|卡号)\s*(?:[:：]\s*)?([A-Z0-9*\-]{5,})/i,
  ])

  if (compactText.includes('出入口信息')) {
    const stations = [...compactText.matchAll(/([\u4E00-\u9FA5]·(?:[\u4E00-\u9FA5]+\s*){1,10}收\s*费\s*站(?:入口|出口)?)/g)]
      .map(match => match[1].replace(/\s+/g, '').replace(/(?:收费站)?(?:入口|出口)$/, '收费站'))
    const splitRows = [...compactText.matchAll(/(?:^|\s)(\d{1,2})\s+至\s+(\d+(?:,\d{3})*\.\d{2})\s+\2(?=\s|$)/g)]
    const journeyDates = [...compactText.matchAll(/(?:^|\s)(20\d{6})(?=\s|$)/g)]
      .map(match => match[1])
      .filter((value, index, values) => value !== values[index - 1])
    if (splitRows.length > 1 && stations.length >= splitRows.length * 2 && journeyDates.length >= splitRows.length) {
      return splitRows.map((matched, index) => normalizeEtcRecord({
        编号: `${invoiceNo || `PDF-${file.name.replace(/\W+/g, '').slice(0, 16)}`}-${matched[1]}`,
        通行时间: `${journeyDates[index].slice(0, 4)}-${journeyDates[index].slice(4, 6)}-${journeyDates[index].slice(6, 8)}`,
        入口信息: stations[index * 2],
        出口信息: stations[index * 2 + 1],
        车牌号: plateNo,
        发票号码: invoiceNo,
        ETC卡号: cardNo,
        金额: normalizePdfAmount(matched[2]),
        状态: '已导入',
      }, index))
    }
  }

  const passDate = matchPdfText(compactText, [
    /(?:开票申请日期|申请日期|开票日期|填开日期|票据日期|交易日期|通行日期|日期)\s*(?:[:：]\s*)?(\d{4}[年\-/. ]\d{1,2}[月\-/. ]\d{1,2})/,
    /(?:开票申请日期|申请日期|开票日期|填开日期|票据日期|交易日期|通行日期|日期)\s*(?:[:：]\s*)?(\d{8})/,
  ]) || dayjs(file.lastModified).format('YYYY-MM-DD')
  const amount = normalizePdfAmount(matchPdfText(compactText, [
    /(?:价税合计|交易金额|合计金额|金额合计|小写|总金额|金额)\s*(?:[:：]\s*)?(?:¥|￥|CNY|人民币)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ]))
  const routeName = matchPdfText(compactText, [
    /(?:通行路段|路段|路线)\s*(?:[:：]\s*)?(\S+(?:高速|收费站|至|--|—)\S*)/,
  ]) || 'ETC费用'

  const tripPattern = /(?:^|\s)(\d{1,2})\s+(\d{8})\s+\2\s+([\s\S]*?)\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s+\4/g
  const tripRows = [...compactText.matchAll(tripPattern)].filter((matched) => {
    const route = normalizeEtcRouteName(matched[3])
    return route && /入口|出口|收费站|\s至\s|--|—/.test(route)
  })

  const declaredJourneyCount = toNumber(matchPdfText(compactText, [/(?:行程数量|行程数)\s*(?:[:：]\s*)?(\d{1,3})/]))
  // Summary invoices must use the structured station/amount parser below.
  // The legacy matcher can look complete before invalid rows are filtered out.
  if (tripRows.length && !declaredJourneyCount && !compactText.includes('出入口信息')) {
    return tripRows.map((matched, index) => {
      const [, tripNo, rawDate, rawRoute, tripAmount] = matched
      const tripDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      const normalizedRoute = normalizeEtcRouteName(rawRoute) || normalizeEtcRouteName(routeName) || '通行费'
      return normalizeEtcRecord({
        编号: `${invoiceNo || `PDF-${file.name.replace(/\W+/g, '').slice(0, 16)}`}-${tripNo || index + 1}`,
        通行时间: tripDate,
        通行路段: normalizedRoute,
        车牌号: plateNo,
        发票号码: invoiceNo,
        ETC卡号: cardNo,
        金额: normalizePdfAmount(tripAmount),
        状态: '已导入',
      }, index)
    }).filter(row => row.updatedAt && row.amount !== '¥0.00' && (row.invoiceNo || row.plateNo || row.cardNo))
  }

  // Electronic ETC invoices commonly expose table columns instead of rows in PDF text.
  // Rebuild the table from its declared journey count and validate amounts against the total.
  const journeyCount = declaredJourneyCount
  const normalizeStationName = (value: string) => value
    .replace(/^(?:入口站?|出口站?|起点|终点)\s*[:：]?\s*/, '')
    .replace(/(?:收费站)?(?:入口|出口)$/, '收费站')
    .trim()
  const entryStations = [...compactText.matchAll(/(?:入口站?|入站|起点)\s*(?:[:：]\s*)?([\u4E00-\u9FA5A-Z0-9·()（）-]{2,40}?(?:收费站)?)(?=\s+(?:出口站?|出站|终点|20\d{2}|¥|￥|\d+\.\d{1,2})|$)/g)]
    .map(match => normalizeStationName(match[1]))
    .filter(Boolean)
  const exitStations = [...compactText.matchAll(/(?:出口站?|出站|终点)\s*(?:[:：]\s*)?([\u4E00-\u9FA5A-Z0-9·()（）-]{2,40}?(?:收费站)?)(?=\s+(?:入口站?|入站|起点|20\d{2}|¥|￥|\d+\.\d{1,2})|$)/g)]
    .map(match => normalizeStationName(match[1]))
    .filter(Boolean)
  // Station names in ETC summary PDFs are frequently wrapped across PDF text
  // items, e.g. "陕·陕西勉县收 费站". Reassemble them from the province prefix
  // through the 收费站 suffix before pairing entry and exit stations.
  const stationNames = [...compactText.matchAll(/([\u4E00-\u9FA5]·(?:[\u4E00-\u9FA5]+\s*){1,10}收\s*费\s*站(?:入口|出口)?)/g)]
    .map(match => normalizeStationName(match[1].replace(/\s+/g, '')))
  const splitAmountRows = [...compactText.matchAll(/(?:^|\s)(\d{1,2})\s+至\s+(\d+(?:,\d{3})*\.\d{2})\s+\2(?=\s|$)/g)]
  const allPdfDates = [...compactText.matchAll(/(20\d{2})[-/.年]?\s*(\d{1,2})[-/.月]?\s*(\d{1,2})日?(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/g)]
    .map(match => normalizeEtcPdfDate(match))
  const distinctDates = allPdfDates.filter((value, index) => value !== allPdfDates[index - 1])
  const journeyDates = [...compactText.matchAll(/(?:^|\s)(20\d{6})(?=\s|$)/g)]
    .map(match => `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)} 00:00`)
    .filter((value, index, values) => value !== values[index - 1])
  const amountCandidates = [...compactText.matchAll(/(?:¥|￥)?\s*(\d+(?:,\d{3})*\.\d{2})/g)]
    .map(match => normalizePdfAmount(match[1]))
    .filter(value => toNumber(value) > 0 && (!amount || toNumber(value) <= toNumber(amount)))
  const pairedAmounts = journeyCount > 1 && amount
    ? findEtcPairedAmounts(amountCandidates, journeyCount, toNumber(amount))
    : []
  const detailAmounts = pairedAmounts.length
    ? pairedAmounts
    : (journeyCount > 1 && amount ? findEtcAmountWindow(amountCandidates, journeyCount, toNumber(amount)) : [])
  const hasLabeledStationPairs = entryStations.length >= journeyCount && exitStations.length >= journeyCount
  const hasOrderedStationPairs = stationNames.length >= journeyCount * 2
  const structuredJourneyCount = splitAmountRows.length
  const hasStructuredStationPairs = (entryStations.length >= structuredJourneyCount && exitStations.length >= structuredJourneyCount)
    || stationNames.length >= structuredJourneyCount * 2
  if (structuredJourneyCount > 1 && hasStructuredStationPairs && journeyDates.length >= structuredJourneyCount) {
    const detailDates = journeyDates.slice(0, structuredJourneyCount)
    return splitAmountRows.map((matched, index) => normalizeEtcRecord({
      编号: `${invoiceNo || `PDF-${file.name.replace(/\W+/g, '').slice(0, 16)}`}-${matched[1]}`,
      通行时间: detailDates[index],
      通行路段: hasStructuredStationPairs && entryStations.length >= structuredJourneyCount
        ? `${entryStations[index]} 至 ${exitStations[index]}`
        : `${stationNames[index * 2]} 至 ${stationNames[index * 2 + 1]}`,
      车牌号: plateNo,
      发票号码: invoiceNo,
      ETC卡号: cardNo,
      金额: normalizePdfAmount(matched[2]),
      状态: '已导入',
    }, index)).filter(row => row.updatedAt && row.amount !== '¥0.00')
  }
  if (journeyCount > 1 && detailAmounts.length === journeyCount && (hasLabeledStationPairs || hasOrderedStationPairs) && distinctDates.length >= journeyCount) {
    const detailDates = distinctDates.slice(-journeyCount)
    const detailStations = stationNames.slice(-journeyCount * 2)
    return detailAmounts.map((tripAmount, index) => normalizeEtcRecord({
      编号: `${invoiceNo || `PDF-${file.name.replace(/\W+/g, '').slice(0, 16)}`}-${index + 1}`,
      通行时间: detailDates[index],
      通行路段: hasLabeledStationPairs
        ? `${entryStations[index]} 至 ${exitStations[index]}`
        : `${detailStations[index * 2]} 至 ${detailStations[index * 2 + 1]}`,
      车牌号: plateNo,
      发票号码: invoiceNo,
      ETC卡号: cardNo,
      金额: tripAmount,
      状态: '已导入',
    }, index)).filter(row => row.updatedAt && row.amount !== '¥0.00')
  }
  // ETC invoice detail tables are often extracted as one continuous text block.
  // Split on each transaction date, then take the last decimal amount before the next date.
  const datePattern = /(20\d{2})[-/.年]?\s*(\d{1,2})[-/.月]?\s*(\d{1,2})日?(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/g
  const dateMatches = [...compactText.matchAll(datePattern)]
  if (dateMatches.length > 1) {
    const compactRows = dateMatches.flatMap((dateMatch, index) => {
      const start = dateMatch.index ?? 0
      const end = dateMatches[index + 1]?.index ?? Math.min(compactText.length, start + 400)
      const segment = compactText.slice(start, end)
      const decimalAmounts = [...segment.matchAll(/(?:¥|￥)?\s*(\d+(?:,\d{3})*\.\d{1,2})/g)]
        .map(match => normalizePdfAmount(match[1]))
        .filter(value => toNumber(value) > 0)
      if (!decimalAmounts.length)
        return []
      const rowAmount = decimalAmounts[decimalAmounts.length - 1]
      const linePlate = segment.match(/([一-龥][A-Z][A-Z0-9]{4,6})/)?.[1] || plateNo
      const rowDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')} ${dateMatch[4] || '00:00'}`
      const route = extractEtcRoutePair(segment) || ''
      return [normalizeEtcRecord({
        编号: `${invoiceNo || `PDF-${file.name.replace(/\W+/g, '').slice(0, 16)}`}-${index + 1}`,
        通行时间: rowDate,
        通行路段: route,
        车牌号: linePlate,
        发票号码: invoiceNo,
        ETC卡号: cardNo,
        金额: rowAmount,
        状态: '已导入',
      }, index)]
    }).filter(row => row.updatedAt && row.amount !== '¥0.00')
    const uniqueRows = [...new Map(compactRows.map(row => [`${row.updatedAt}|${row.amount}|${row.name}`, row])).values()]
    if (uniqueRows.length > 1)
      return uniqueRows
  }

  const detailRows = boundedText.split('\n').flatMap((line, index) => {
    const normalizedLine = line.replace(/\s+/g, ' ').trim()
    const dateMatch = normalizedLine.match(/(20\d{2})[-/.年]?\s*(\d{1,2})[-/.月]?\s*(\d{1,2})日?(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/)
    const amounts = [...normalizedLine.matchAll(/(?:¥|￥)?\s*(\d+(?:,\d{3})*\.\d{1,2})/g)].map(match => match[1])
    if (!dateMatch || !amounts.length)
      return []
    const rowAmount = normalizePdfAmount(amounts[amounts.length - 1])
    if (!rowAmount || toNumber(rowAmount) <= 0)
      return []
    const linePlate = normalizedLine.match(/([\u4E00-\u9FA5][A-Z][A-Z0-9]{4,6})/)?.[1] || plateNo
    const rowDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')} ${dateMatch[4] || '00:00'}`
    return [normalizeEtcRecord({
      编号: `${invoiceNo || `PDF-${file.name.replace(/\W+/g, '').slice(0, 16)}`}-${index + 1}`,
      通行时间: rowDate,
      通行路段: extractEtcRoutePair(normalizedLine),
      车牌号: linePlate,
      发票号码: invoiceNo,
      ETC卡号: cardNo,
      金额: rowAmount,
      状态: '已导入',
    }, index)]
  }).filter(row => row.updatedAt && row.amount !== '¥0.00')
  if (detailRows.length > 1)
    return detailRows

  const row = normalizeEtcRecord({
    编号: invoiceNo || `PDF-${file.name.replace(/\W+/g, '').slice(0, 16)}`,
    通行时间: passDate,
    通行路段: routeName,
    车牌号: plateNo,
    发票号码: invoiceNo,
    ETC卡号: cardNo,
    金额: amount,
    状态: '已导入',
  }, 0)

  return row.updatedAt && row.amount !== '¥0.00' && (row.invoiceNo || row.plateNo || row.cardNo)
    ? [row]
    : []
}

void _parseEtcRowsFromPdfText

function parseFuelRowsFromPdfText(text: string, file: File): FuelRecord[] {
  const boundedText = text.slice(0, 250_000)
  const compactText = boundedText.replace(/\s+/g, ' ')
  const date = matchPdfText(compactText, [
    /(?:订单时间|交易时间|加油时间|消费时间|日期)\s*(?:[:：]\s*)?(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:\s+\d{1,2}:\d{2})?)/,
  ]) || dayjs(file.lastModified).format('YYYY-MM-DD HH:mm')
  const plateNo = matchPdfText(compactText, [
    /(?:车牌号码|车牌号|车牌|车辆)\s*(?:[:：]\s*)?([\u4E00-\u9FA5][A-Z][A-Z0-9·\-.]{4,8})/i,
  ]).replace(/\s+/g, '')
  const location = matchPdfText(compactText, [
    /(?:油站名称|加油站|加油地点|站点|地点)\s*(?:[:：]\s*)?([^:：]{2,40}?)(?=\s+(?:油品|油量|金额|车牌|日期|$))/,
  ])
  const product = matchPdfText(compactText, [
    /(?:油品品号|商品品类|油品)\s*(?:[:：]\s*)?([^\s,，;；]{2,20})/,
  ])
  const quantity = normalizePdfAmount(matchPdfText(compactText, [
    /(?:油量（升）|油量|升数|加油量)\s*(?:[:：]\s*)?([\d,.]+)/,
  ]))
  const amount = normalizePdfAmount(matchPdfText(compactText, [
    /(?:实付金额（元）|实付金额|油品实收金额|支付金额|合计金额|金额)\s*(?:[:：]\s*)?(?:¥|￥)?\s*([\d,.]+)/,
  ]))
  const code = matchPdfText(compactText, [
    /(?:订单号|交易流水号|流水号|交易单号)\s*(?:[:：]\s*)?([A-Z0-9\-]{5,})/i,
  ]) || `FUEL-PDF-${file.name.replace(/\W+/g, '').slice(0, 16)}-${file.lastModified}`
  const driver = matchPdfText(compactText, [
    /(?:会员名称|司机姓名|司机|驾驶员)\s*(?:[:：]\s*)?([\u4E00-\u9FA5·]{2,10})/,
  ])

  const detailRows = boundedText.split('\n').flatMap((line, index) => {
    const normalizedLine = line.replace(/\s+/g, ' ').trim()
    const dateMatch = normalizedLine.match(/(20\d{2})[-/.年]?\s*(\d{1,2})[-/.月]?\s*(\d{1,2})日?(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/)
    const linePlate = normalizedLine.match(/([\u4E00-\u9FA5][A-Z][A-Z0-9]{4,6})/)?.[1] || plateNo
    const numbers = [...normalizedLine.matchAll(/(?:¥|￥)?\s*(\d+(?:,\d{3})*\.\d{1,2})/g)].map(match => match[1])
    if (!dateMatch || !linePlate || numbers.length < 1)
      return []
    const rowDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')} ${dateMatch[4] || '00:00'}`
    const rowAmount = numbers[numbers.length - 1]
    const rowQuantity = numbers.length > 1 ? numbers[numbers.length - 2] : quantity
    return normalizeFuelRows([{
      订单号: `${code}-${index + 1}`,
      加油时间: rowDate,
      车牌号: linePlate,
      油站名称: location || 'PDF加油明细',
      油品: product,
      油量: rowQuantity,
      实付金额: rowAmount,
      司机姓名: driver,
    }])
  })
  if (detailRows.length > 1)
    return detailRows

  return normalizeFuelRows([{
    订单号: code,
    加油时间: date,
    车牌号: plateNo,
    油站名称: location,
    油品: product,
    油量: quantity,
    实付金额: amount,
    司机姓名: driver,
  }])
}

function buildEtcSummary(rows: EtcRecord[]): EtcSummary {
  const normalizedRows = rows.map((row, index) => {
    const normalizedRow = normalizeEtcRecord(row, index)
    return {
      ...normalizedRow,
      month: normalizeFinanceMonth(normalizedRow.month, normalizedRow.updatedAt),
    }
  })
  const months = [...new Set(normalizedRows.map(row => row.month).filter(Boolean))].sort()
  const dates = normalizedRows.map(row => row.updatedAt).filter(Boolean).sort()
  const invoiceNos = [...new Set(normalizedRows.map(row => row.invoiceNo).filter(Boolean))]
  const plateNos = [...new Set(normalizedRows.map(row => row.plateNo).filter(Boolean))]
  const totalAmountInCents = normalizedRows.reduce((sum, row) => sum + (parseEtcAmountInCents(row.amount) ?? 0), 0)

  return {
    summaryNo: normalizedRows[0]?.summaryNo || '',
    applyDate: dayjs().format('YYYY-MM-DD'),
    plateNo: plateNos.length === 1 ? plateNos[0] : (plateNos.length ? `${plateNos.length} 辆` : ''),
    buyerName: '',
    taxNo: '',
    invoiceNo: invoiceNos.length === 1 ? invoiceNos[0] : (invoiceNos.length ? `${invoiceNos.length} 张发票` : ''),
    invoiceCount: invoiceNos.length,
    tripCount: normalizedRows.length,
    totalAmount: formatEtcAmountFromCents(totalAmountInCents),
    monthRange: formatFiscalMonthSummary(months),
    dateRange: dates.length > 1 ? `${dates[0]} 至 ${dates[dates.length - 1]}` : (dates[0] || '-'),
    rows: normalizedRows,
  }
}

function applyEtcInvoice(summary: EtcSummary) {
  const normalizedSummary = buildEtcSummary(summary.rows)
  etcRows.value = [...normalizedSummary.rows, ...etcRows.value]
  etcImportSummary.value = buildEtcSummary(etcRows.value as EtcRecord[])
}

async function readEtcRowsFromFile(file: File) {
  if (/\.pdf$/i.test(file.name)) {
    const rows = parseEtcSummaryInvoiceStrict(await extractTransportPdfText(file))
    if (!rows.length)
      throw new Error('PDF中未识别到票据号码、日期、金额等ETC费用字段')
    return rows
  }

  const sheetRows = (await parseTransportWorkbook(file)).flatMap(sheet => sheet.rows)
  return normalizeEtcRows(sheetRows)
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results: R[] = []
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

async function importEtcInvoicesFromFiles(files: File[]) {
  const fileList = files.filter(Boolean)
  const fileName = fileList.length > 1 ? `${fileList.length} 个ETC费用发票明细文件` : fileList[0]?.name
  const fileSize = fileList.reduce((sum, file) => sum + file.size, 0)

  setImportParsingState(importPreview, {
    title: 'ETC费用导入确认',
    fileName: fileName ?? '导入文件',
    fileSize,
    columns: getImportPreviewColumns('etc'),
  })

  const existingFileHashes = new Set(etcRows.value.map(row => row.sourceFileHash).filter(Boolean))
  const existingSummaryNos = new Set(etcRows.value.map(row => row.summaryNo || row.code).filter(Boolean))
  const batchFileHashes = new Set<string>()
  const batchSummaryNos = new Set<string>()
  const duplicateFiles: string[] = []
  const parsed = await mapWithConcurrency(fileList, 4, async (file) => {
    try {
      const sourceFileHash = await getTransportFileContentHash(file)
      if (existingFileHashes.has(sourceFileHash) || batchFileHashes.has(sourceFileHash)) {
        duplicateFiles.push(`${file.name} 已上传过，禁止重复上传`)
        return { file, rows: [] as EtcRecord[], error: '', duplicate: true }
      }
      batchFileHashes.add(sourceFileHash)
      const fileRows = await readEtcRowsFromFile(file)
      const summaryNo = fileRows[0]?.summaryNo
      if (!summaryNo)
        throw new Error('未识别到汇总单号')
      if (existingSummaryNos.has(summaryNo) || batchSummaryNos.has(summaryNo)) {
        duplicateFiles.push(`${file.name}：汇总单号 ${summaryNo} 已存在，禁止重复导入`)
        return { file, rows: [] as EtcRecord[], error: '', duplicate: true }
      }
      batchSummaryNos.add(summaryNo)
      return {
        file,
        rows: fileRows.map((row, index) => ({
          ...row,
          sourceFileHash,
          sourceFileName: file.name,
          sourceFileRow: String(index + 1),
        })),
        error: '',
        duplicate: false,
      }
    }
    catch (error: any) {
      return {
        file,
        rows: [] as EtcRecord[],
        error: `${file.name}：${error?.message ?? '解析失败'}`,
        duplicate: false,
      }
    }
  })
  const rows = parsed.flatMap(item => item.rows)
  const errors = parsed
    .filter(item => !item.duplicate && (!item.rows.length || item.error))
    .map(item => item.error || `${item.file.name}：未识别到发票号、车牌、通行时间、路段、金额等ETC费用明细字段`)

  if (!rows.length) {
    openImportPreview({
      kind: 'etc',
      title: 'ETC费用导入确认',
      fileName: fileName ?? '导入文件',
      fileSize,
      rows: [],
      errorDetails: errors,
      duplicateDetails: duplicateFiles,
      deduplicateRows: false,
    })
    return
  }

  const summary = buildEtcSummary(rows)
  openImportPreview({
    kind: 'etc',
    title: 'ETC费用导入确认',
    fileName: fileName ?? '导入文件',
    fileSize,
    rows: summary.rows,
    summaryNo: [...new Set(summary.rows.map(row => row.summaryNo).filter(Boolean))].join('、'),
    errorDetails: errors,
    duplicateDetails: duplicateFiles,
    deduplicateRows: false,
    apply: selectedRows => applyEtcInvoice(buildEtcSummary(selectedRows as EtcRecord[])),
  })
}

function getFileQueueKey(file: File) {
  return `${file.webkitRelativePath || file.name}_${file.size}_${file.lastModified}`
}

async function persistFuelRecords(rows: FuelRecord[]) {
  await importTransportFuelApi(rows)
  await loadTransportOperationData({ force: true })
  fuelImportSummary.value = buildFuelSummary(fuelRows.value)
  refreshModuleList()
}

async function readFuelRowsFromFile(file: File) {
  if (/\.pdf$/i.test(file.name)) {
    const rows = parseFuelRowsFromPdfText(await extractTransportPdfText(file), file)
    if (!rows.length)
      throw new Error('PDF中未识别到日期、车牌、油站、金额等油卡字段')
    return rows
  }
  const rawRows = (await parseTransportWorkbook(file)).flatMap(sheet => sheet.rows)
  return normalizeFuelRows(rawRows)
}

async function importFuelRecordsFromFiles(files: File[]) {
  const fileList = files.filter(Boolean)
  const fileName = fileList.length > 1 ? `${fileList.length} 个油卡记录文件` : (fileList[0]?.name || '导入文件')
  const fileSize = fileList.reduce((sum, file) => sum + file.size, 0)
  setImportParsingState(importPreview, { title: '油卡记录导入确认', fileName, fileSize, columns: getImportPreviewColumns('fuel') })
  const parsed = await Promise.all(fileList.map(async (file) => {
    try {
      return { file, rows: await readFuelRowsFromFile(file), error: '' }
    }
    catch (error: any) {
      return { file, rows: [] as FuelRecord[], error: `${file.name}：${error?.message || '解析失败'}` }
    }
  }))
  const rows = parsed.flatMap(item => item.rows)
  const errors = parsed.filter(item => !item.rows.length || item.error).map(item => item.error || `${item.file.name}：未识别到油卡明细字段`)
  const summary = buildFuelSummary(rows)
  openImportPreview({
    kind: 'fuel',
    title: '油卡记录导入确认',
    fileName,
    fileSize,
    rows: summary.rows,
    errorDetails: errors,
    apply: rows.length ? selectedRows => persistFuelRecords(selectedRows as FuelRecord[]) : undefined,
    persist: false,
  })
}

async function saveManualRecord(payload: Record<string, string | number>) {
  if (route.name !== 'TransportFuel')
    return
  manualRecordSaving.value = true
  try {
    await createTransportFuelRecordApi(payload as unknown as TransportFuelCreatePayload)
    await loadTransportOperationData({ force: true })
    fuelImportSummary.value = buildFuelSummary(fuelRows.value)
    manualRecordOpen.value = false
    refreshModuleList()
    message.success('加油明细新增成功')
  }
  catch (error: any) {
    message.error(error?.message || '加油明细新增失败')
  }
  finally {
    manualRecordSaving.value = false
  }
}

watch(
  () => [route.name, sourceTableRows.value.length],
  () => loadModuleSummary(),
  { immediate: true },
)

watch(
  () => route.name,
  () => {
    // Each transport submodule has its own status vocabulary; never carry a
    // stale filter value such as "待处理" into the four-stage order view.
    queryModel.status = undefined
    if (route.name !== 'TransportBaseData') {
      const currentMonth = getCurrentFinancialMonthRange()
      resetFinancialPeriodFilter({
        financialYear: Number(currentMonth.key.slice(0, 4)),
        financialMonth: Number(currentMonth.key.slice(4, 6)),
      })
    }
    loadModuleApprovalStatus()
    void loadOrderGpsLocations()
  },
  { immediate: true },
)

async function loadModuleApprovalStatus() {
  const businessType = getRouteApprovalBusinessType()
  if (!businessType)
    return

  const res = await getApprovalInstancesApi({ businessType })
  const instances = res.data ?? []
  const instanceMap = new Map(instances.map(item => [String(item.businessId), item]))

  sourceTableRows.value.forEach((row: Record<string, any>) => {
    const businessId = getRowApprovalBusinessId(row)
    const instance = instanceMap.get(businessId)
    if (!instance)
      return
    row.approvalStatus = formatApprovalInstanceStatus(instance.status)
    row.approvalInstanceId = instance.id
  })
}

function getRouteApprovalBusinessType() {
  if (route.name === 'TransportOrders')
    return 'transport_order'
  if (route.name === 'TransportFuel')
    return 'transport_fuel'
  if (route.name === 'TransportEtc')
    return 'transport_etc'
  if (route.name === 'TransportDriverPayroll')
    return 'salary'
  return ''
}

function getRowApprovalBusinessId(row: Record<string, any>) {
  if (route.name === 'TransportDriverPayroll')
    return String(row.code || '')
  return String(row.code || '')
}

function formatApprovalInstanceStatus(status?: string) {
  if (status === 'PENDING' || status === 'APPROVING')
    return '审批中'
  if (status === 'APPROVED')
    return '审批通过'
  if (status === 'REJECTED')
    return '审批驳回'
  if (status === 'REVOKED')
    return '已撤回'
  return status || ''
}

function getDisplayedStatus(record: Record<string, any>) {
  if (route.name === 'TransportOrders')
    return getTransportStageTag(record).label
  return record.approvalStatus || record.status || '-'
}

function getDisplayedStatusColor(record: Record<string, any>) {
  if (route.name === 'TransportOrders')
    return getTransportStageTag(record).color
  if (String(record.approvalStatus || record.status || '').includes('驳回'))
    return 'red'
  if (String(record.approvalStatus || record.status || '').includes('通过') || String(record.status || '').includes('完成'))
    return 'green'
  return 'blue'
}

function getColumnRecordValue(record: Record<string, any>, dataIndex: unknown) {
  return record[String(dataIndex ?? '')]
}

function displayVehicleValue(value?: string) {
  return value || '-'
}
</script>

<template>
  <page-container>
    <section class="transport-overview-panel">
      <SummaryCards :cards="moduleSummaryCards" :loading="summaryLoading" :data-state="moduleSummaryCards.some(card => card.dataState === 'empty') ? 'empty' : 'ready'" compact />
    </section>

    <a-card class="transport-query-card" :bordered="false">
      <a-form class="transport-module-query" :model="queryModel" @finish="handleQuery">
        <a-row :gutter="[10, 8]" align="middle">
          <template v-if="route.name === 'TransportBaseData'">
            <a-col
              v-for="column in activeBaseDataFilterColumns"
              :key="String(column.dataIndex)"
              :xs="24"
              :md="8"
              :xl="3"
            >
              <a-form-item :label="column.title">
                <a-auto-complete
                  v-model:value="baseDataQueryModel[String(column.dataIndex)]"
                  allow-clear
                  :options="getBaseDataFilterOptions(column.dataIndex)"
                  :filter-option="(input: string, option: any) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())"
                  :popup-match-select-width="false"
                  :placeholder="`请输入或选择${column.title}`"
                />
              </a-form-item>
            </a-col>
          </template>
          <a-col v-if="route.name !== 'TransportBaseData'" :xs="24" :md="8" :xl="route.name === 'TransportOrders' ? 2 : 3">
            <a-form-item :label="activeProfile.keywordLabel">
              <a-input v-model:value="queryModel.keyword" allow-clear :placeholder="`请输入${activeProfile.keywordLabel}`" />
            </a-form-item>
          </a-col>
          <a-col v-if="route.name !== 'TransportBaseData'" :xs="24" :md="8" :xl="route.name === 'TransportOrders' ? 2 : 3">
            <a-form-item label="状态">
              <a-select v-model:value="queryModel.status" allow-clear :popup-match-select-width="false" :dropdown-style="{ minWidth: '120px' }" placeholder="请选择状态">
                <template v-if="route.name === 'TransportOrders'">
                  <a-select-option value="loading">
                    装车
                  </a-select-option>
                  <a-select-option value="unloading">
                    卸车
                  </a-select-option>
                  <a-select-option value="transit">
                    运输中
                  </a-select-option>
                  <a-select-option value="returning">
                    空返
                  </a-select-option>
                </template>
                <template v-else>
                  <a-select-option value="pending">
                    待处理
                  </a-select-option>
                  <a-select-option value="running">
                    处理中
                  </a-select-option>
                  <a-select-option value="done">
                    已完成
                  </a-select-option>
                </template>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col v-if="route.name === 'TransportOrders'" :xs="24" :md="8" :xl="3">
            <a-form-item label="车辆">
              <a-select
                v-model:value="queryModel.vehicle"
                allow-clear
                show-search
                :filter-option="(input: string, option: any) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())"
                :options="orderVehicleFilterOptions"
                :popup-match-select-width="false"
                :dropdown-style="{ minWidth: '180px' }"
                placeholder="请选择车辆"
              />
            </a-form-item>
          </a-col>
          <a-col v-if="route.name === 'TransportOrders'" :xs="24" :md="8" :xl="3">
            <a-form-item label="客户">
              <a-select
                v-model:value="queryModel.customer"
                allow-clear
                show-search
                :filter-option="(input: string, option: any) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())"
                :options="orderCustomerFilterOptions"
                :popup-match-select-width="false"
                :dropdown-style="{ minWidth: '220px' }"
                placeholder="请选择客户"
              />
            </a-form-item>
          </a-col>
          <FinancialPeriodFilter
            v-if="route.name !== 'TransportBaseData'"
            v-model="financialPeriodFilter"
            :available-month-keys="availableFinancialMonthKeys"
            :year-col="{ xs: 24, md: 8, xl: route.name === 'TransportOrders' ? 3 : 4 }"
            :month-col="{ xs: 24, md: 8, xl: route.name === 'TransportOrders' ? 3 : 4 }"
            :date-col="{ xs: 24, md: 8, xl: route.name === 'TransportOrders' ? 5 : 6 }"
          />
          <a-col :xs="24" :md="8" :xl="3">
            <a-form-item class="query-actions">
              <a-space class="query-action-space">
                <a-button type="primary" html-type="submit">
                  查询
                </a-button>
                <a-button @click="resetQuery">
                  重置
                </a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <TransportOrderAnalytics v-if="route.name === 'TransportOrders'" :rows="tableRows" />
    <TransportSubmoduleAnalytics v-else :module-name="String(route.name || '')" :rows="tableRows" />

    <BaseDataTable
      v-if="route.name === 'TransportBaseData'"
      v-model:active-key="activeBaseDataTab"
      :tabs="baseDataTabs"
      :active-rows="tableRows"
      :pagination="tablePagination"
      :loading="transportOperationLoading"
      :before-upload="beforeUploadBaseData"
      :get-columns="getBaseDataColumns"
      :get-scroll-x="getTableScrollX"
      :get-status="getDisplayedStatus"
      :display-value="displayVehicleValue"
      :get-vehicle-age-type="getVehicleAgeType"
      :get-vehicle-age-type-label="getVehicleAgeTypeLabel"
      :normalize-date="normalizeTransportDate"
      :is-vehicle-scrap-warning="isVehicleScrapWarning"
      :get-vehicle-scrap-date="getVehicleScrapDate"
      :get-customer-balance="getCustomerBidBalance"
      :get-actions="getBusinessActions"
      @export="exportCurrentRows"
      @create="openBaseDataCreate"
    />

    <DriverPayrollTable
      v-else-if="route.name === 'TransportDriverPayroll'"
      v-model:active-tab="driverPayrollActiveTab"
      v-model:attendance-date="todayAttendanceDate"
      :title="driverPayrollTableTitle"
      :salary-mode-cards="driverSalaryModeCards"
      :attendance-period-label="driverAttendancePeriodLabel"
      :calendar-days="driverAttendanceCalendarDays"
      :attendance-groups="driverAttendanceGroups"
      :attendance-grid-style="driverAttendanceGridStyle"
      :columns="driverPayrollCurrentColumns"
      :rows="driverPayrollVisibleRows"
      :pagination="tablePagination"
      :loading="transportOperationLoading"
      :scroll-x="driverPayrollCurrentScrollX"
      :get-salary-mode-class="getSalaryModeClass"
      :get-salary-mode-color="getSalaryModeColor"
      :to-number="toNumber"
      :is-attendance-date-colored="isAttendanceDateColored"
      :get-salary-mode-for-date="getSalaryModeForDate"
      :get-status-color="getDisplayedStatusColor"
      :get-status="getDisplayedStatus"
      :get-attendance-status-color="getAttendanceStatusColor"
      :get-financial-month-start="getDriverFinancialMonthStart"
      :is-money-column="isDriverPayrollMoneyColumn"
      :is-stat-column="isDriverPayrollStatColumn"
      :get-column-value="getColumnRecordValue"
      :get-salary-composition="getDriverSalaryComposition"
      :get-actions="getBusinessActions"
      @export="exportCurrentRows"
      @configure-mode="openDriverModeConfig"
      @save-global-mode="saveGlobalSalaryMode"
      @toggle-attendance="toggleAttendanceDate"
      @mark-attendance="markTodayAttendance"
    />

    <TransportRecordsTable
      v-else-if="route.name !== 'TransportBaseData'"
      :module-name="String(route.name)"
      :page-title="pageTitle"
      :columns="activeTableColumns"
      :rows="tableRows"
      :pagination="tablePagination"
      :scroll-x="activeTableScrollX"
      :before-upload-order-records="beforeUploadOrderRecords"
      :get-row-class-name="getTransportRowClassName"
      :get-stage-tag="getTransportStageTag"
      :get-status-color="getDisplayedStatusColor"
      :get-status="getDisplayedStatus"
      :get-column-value="getColumnRecordValue"
      :display-vehicle-value="displayVehicleValue"
      :is-latest-vehicle-order="isLatestVehicleOrder"
      :get-gps-location-label="getOrderGpsLocationLabel"
      :get-gps-location="getOrderGpsLocation"
      :get-actions="getBusinessActions"
      :display-table-value="displayTableValue"
      @import-batch="openBatchFilePicker"
      @export="exportCurrentRows"
      @add="openAddRecord"
      @open-gps="openGpsMonitor"
    />

    <DriverModeModal
      v-if="driverModeModalOpen"
      v-model:open="driverModeModalOpen"
      :form="driverModeForm"
      :vehicle-options="driverPayrollVehicleOptions"
      :plate-nos="displayDriverPlateNos(driverModeForm)"
      :mode-amounts="driverSalaryModeAmountMap"
      :get-mode-class="getSalaryModeClass"
      :submitting="driverModeSaving"
      @save="saveDriverModeConfig"
      @add-plate="addDriverPlateNo"
      @remove-plate="removeDriverPlateNo"
    />

    <a-modal
      v-model:open="businessEditOpen"
      :title="`编辑${pageTitle}`"
      width="720px"
      :confirm-loading="businessEditSaving"
      :mask-closable="false"
      :closable="!businessEditSaving"
      :keyboard="!businessEditSaving"
      :cancel-button-props="{ disabled: businessEditSaving }"
      ok-text="保存"
      @ok="saveBusinessEdit"
    >
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col v-for="field in businessEditFields" :key="field.key" :xs="24" :md="12">
            <a-form-item :label="field.label" required>
              <a-date-picker
                v-if="field.type === 'date'"
                v-model:value="businessEditForm[field.key]"
                value-format="YYYY-MM-DD"
                format="YYYY-MM-DD"
                class="full-width"
              />
              <a-input v-else v-model:value="businessEditForm[field.key]" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <BaseDataModal
      v-if="baseDataModalOpen"
      v-model:open="baseDataModalOpen"
      v-model:route-validity-range="baseRouteValidityRange"
      :title="`${baseDataEditingCode ? '编辑' : '新增'}${activeBaseDataTabConfig.title}`"
      :submitting="baseDataSubmitting"
      :tab-key="activeBaseDataTab"
      :columns="baseDataFormColumns"
      :form="baseDataForm"
      :required-data-index="getBaseDataRequiredField(activeBaseDataTabConfig)?.dataIndex"
      :vehicle-options="baseVehicleOptions"
      :customer-options="baseCustomerOptions"
      @save="saveBaseDataRecord"
      @fill-crew-vehicle="fillBaseCrewVehicle"
      @fill-route-customer="fillBaseRouteCustomer"
      @change-validity-type="handleRouteValidityTypeChange"
      @sync-geofence="syncBaseRouteGeofenceDraft"
      @resolve-coordinates="autoResolveRouteCoordinates"
    />

    <a-modal
      v-model:open="orderModalOpen"
      :width="980"
      :style="{ top: '24px', maxWidth: 'calc(100vw - 48px)', paddingBottom: '18px' }"
      :body-style="{ maxHeight: 'calc(100vh - 146px)', overflowY: 'auto', padding: '0 18px 8px' }"
      wrap-class-name="order-entry-modal"
      :mask-closable="false"
      :confirm-loading="orderSaving"
      :closable="!orderSaving"
      :keyboard="!orderSaving"
      :cancel-button-props="{ disabled: orderSaving }"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitOrderForm"
    >
      <template #title>
        <div class="order-modal-title">
          <span>{{ editingOrderCode ? '编辑订单' : '新增订单' }}</span>
          <a-button @click="message.info('可通过列表右上角「导入运单」进行批量录入')">
            切换批量录入
          </a-button>
        </div>
      </template>
      <a-form :model="orderForm" layout="vertical" class="order-entry-form">
        <div class="order-form-hero">
          <div>
            <div class="order-form-kicker">
              订单录入
            </div>
            <div class="order-form-heading">
              全量订单信息集中录入，按业务分区清晰展示
            </div>
          </div>
          <div class="order-total-preview">
            <span>运输总价</span>
            <strong>{{ orderForm.freightTotal || '0.00' }}</strong>
          </div>
        </div>

        <section class="order-form-section">
          <div class="section-heading">
            基础信息
          </div>
          <a-row :gutter="[16, 8]">
            <a-col :xs="24" :md="8">
              <a-form-item label="订单编号" required>
                <a-input v-model:value="orderForm.code" placeholder="请输入订单编号" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="出车时间" required>
                <a-date-picker
                  v-model:value="orderForm.shipDate"
                  format="YYYY/MM/DD"
                  value-format="YYYY/MM/DD"
                  placeholder="请选择出车时间"
                  class="full-width"
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="客户" required>
                <a-select
                  v-model:value="orderForm.customer"
                  show-search
                  allow-clear
                  :filter-option="(input: string, option: any) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())"
                  placeholder="请选择客户"
                  @change="fillOrderCustomer"
                >
                  <a-select-option v-for="item in customerOptions" :key="item.value" :value="item.value" :label="item.label">
                    {{ item.label }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="车辆" required>
                <a-select
                  v-model:value="orderForm.plateNo"
                  show-search
                  :filter-option="(input: string, option: any) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())"
                  placeholder="输入车牌、挂车号、燃料类型"
                  @change="fillOrderVehicle"
                >
                  <a-select-option v-for="item in vehicleOptions" :key="item.value" :value="item.value" :label="item.label">
                    {{ item.label }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="司机" required>
                <a-input v-model:value="orderForm.driver" disabled placeholder="选择车辆后自动带出" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="押运员" required>
                <a-input v-model:value="orderForm.escort" disabled placeholder="选择车辆后自动带出" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="路线" required>
                <a-select
                  v-model:value="orderForm.routeLine"
                  show-search
                  :filter-option="(input: string, option: any) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())"
                  placeholder="输入路线名称、起点或终点"
                  @change="fillOrderRoute"
                >
                  <a-select-option v-for="item in routeOptions" :key="item.value" :value="item.value" :label="item.label">
                    {{ item.label }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
        </section>

        <section class="order-form-section">
          <div class="section-heading">
            货运信息
          </div>
          <a-row :gutter="[16, 8]">
            <a-col :xs="24" :md="8">
              <a-form-item label="货物实发重量(吨)" required>
                <business-input-number v-model:value="orderForm.sentWeight" class="w-full" string-mode :min="0" :precision="2" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="货物实收重量(吨)" required>
                <business-input-number v-model:value="orderForm.receivedWeight" class="w-full" string-mode :min="0" :precision="2" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="运距(km)" required>
                <business-input-number v-model:value="orderForm.mileage" class="w-full" string-mode :min="0" :precision="2" placeholder="请输入运输距离" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="计价公式">
                <a-select v-model:value="orderForm.priceFormula" @change="syncOrderDerivedAmounts">
                  <a-select-option value="吨位×单价">
                    吨位×单价
                  </a-select-option>
                  <a-select-option value="吨位×运距×单价">
                    吨位×运距×单价
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item required>
                <template #label>
                  {{ orderForm.priceFormula === '吨位×运距×单价' ? '运输单价(元/吨公里)' : '运输单价(元/吨)' }}
                </template>
                <business-input-number v-model:value="orderForm.freightPrice" class="w-full" string-mode :min="0" :precision="4" placeholder="请输入单价或选择路线带入" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="运输总价(元)">
                <a-input v-model:value="orderForm.freightTotal" disabled />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="税后运费(元)">
                <a-input v-model:value="orderForm.taxedFreight" disabled />
              </a-form-item>
            </a-col>
          </a-row>
        </section>

        <section class="order-form-section">
          <div class="section-heading">
            车辆人员与路线
          </div>
          <a-row :gutter="[16, 8]">
            <a-col :xs="24" :md="8">
              <a-form-item label="路线类型" required>
                <a-select v-model:value="orderForm.routeType" @change="syncOrderPlannedFuelConsumption">
                  <a-select-option value="往返双程">
                    往返双程
                  </a-select-option>
                  <a-select-option value="单程">
                    单程
                  </a-select-option>
                  <a-select-option value="调挂">
                    调挂
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="财务年份" required>
                <a-input v-model:value="orderForm.financeYear" disabled />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="财务月" required>
                <a-input v-model:value="orderForm.financeMonth" disabled />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="装车地址" required>
                <a-input v-model:value="orderForm.loadingAddress" placeholder="请输入装货地址" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="卸车地址" required>
                <a-input v-model:value="orderForm.unloadingAddress" placeholder="请输入卸货地址" />
              </a-form-item>
            </a-col>
          </a-row>
        </section>

        <section class="order-form-section">
          <div class="section-heading">
            费用结算
          </div>
          <a-row :gutter="[16, 8]">
            <a-col :xs="24" :md="8">
              <a-form-item label="差费(元)">
                <business-input-number v-model:value="orderForm.extraFee" class="w-full" string-mode :min="0" :precision="2" placeholder="请先选择路线" @change="syncOrderDerivedAmounts" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="ETC费用(元)">
                <a-input v-model:value="orderForm.etcFee" disabled />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="货损单价(元/吨)">
                <business-input-number v-model:value="orderForm.lossUnitPrice" class="w-full" string-mode :min="0" :precision="2" @change="syncOrderDerivedAmounts" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="货损比例(‰)">
                <business-input-number v-model:value="orderForm.lossRate" class="w-full" string-mode :min="0" :precision="4" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="货损重量(吨)">
                <business-input-number v-model:value="orderForm.lossWeight" class="w-full" string-mode :min="0" :precision="3" @change="syncOrderDerivedAmounts" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item label="货损金额(元)">
                <a-input v-model:value="orderForm.lossAmount" disabled class="danger-amount" />
              </a-form-item>
            </a-col>
          </a-row>
        </section>

        <section class="order-form-section">
          <div class="section-heading">
            油耗与备注
          </div>
          <a-row :gutter="[16, 8]">
            <a-col :xs="24" :md="8">
              <a-form-item label="路线设定总油耗(L)">
                <a-input v-model:value="orderForm.plannedFuelConsumption" disabled />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item>
                <template #label>
                  实际加油量(L)<span class="auto-summary">（自动汇总）</span>
                </template>
                <business-input-number v-model:value="orderForm.actualFuelVolume" class="w-full" string-mode :min="0" :precision="2" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-form-item>
                <template #label>
                  加油总价(元)<span class="auto-summary">（自动汇总）</span>
                </template>
                <business-input-number v-model:value="orderForm.actualFuelAmount" class="w-full" string-mode :min="0" :precision="2" />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="备注">
                <a-input v-model:value="orderForm.remark" placeholder="请输入备注信息" />
              </a-form-item>
            </a-col>
          </a-row>
        </section>
      </a-form>
    </a-modal>

    <TransportRecordDetailDrawer
      v-if="detailOpen"
      v-model:open="detailOpen"
      :title="`${pageTitle}详情`"
      :subtitle="detailRecord ? String(detailRecord.code || detailRecord.name || detailRecord.plateNo || '') : ''"
      :status="detailRecord ? getDisplayedStatus(detailRecord) : ''"
      :entries="detailEntries"
      :get-label="getDetailLabel"
    />

    <a-modal
      v-model:open="batchFilePickerOpen"
      :title="batchFilePickerTitle"
      width="720px"
      ok-text="解析所选文件"
      :ok-button-props="{ disabled: !batchSelectedFiles.length }"
      @ok="parseBatchSelectedFiles"
    >
      <a-upload-dragger
        multiple
        :show-upload-list="false"
        accept=".xlsx,.xls,.csv,.pdf"
        :before-upload="addBatchSelectedFiles"
      >
        <p class="ant-upload-text">
          点击或拖入单个、多个文件
        </p>
        <p class="ant-upload-hint">
          可重复添加 Excel、CSV、PDF，文件将合并解析
        </p>
      </a-upload-dragger>
      <div class="batch-folder-picker">
        <a-button @click="selectBatchFolder">
          <template #icon>
            <FolderOpenOutlined />
          </template>
          选择文件夹
        </a-button>
        <span>将导入文件夹及其子文件夹中的 Excel、CSV、PDF 文件</span>
        <input
          ref="batchFolderInput"
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          multiple
          webkitdirectory
          class="batch-folder-input"
          @change="addBatchSelectedFolder"
        >
      </div>
      <a-list mt-4 bordered :data-source="batchSelectedFiles">
        <template #renderItem="{ item }">
          <a-list-item>
            <template #actions>
              <a-button type="link" danger @click="removeBatchSelectedFile(item)">
                删除
              </a-button>
            </template>
            <a-list-item-meta :title="item.name" :description="`${(item.size / 1024).toFixed(1)} KB`" />
          </a-list-item>
        </template>
      </a-list>
    </a-modal>

    <TransportOperationCreateModal
      v-if="manualRecordOpen"
      v-model:open="manualRecordOpen"
      kind="fuel"
      :saving="manualRecordSaving"
      :vehicle-options="transportBaseVehicleRows.map(row => ({ label: row.plateNo || row.code, value: row.plateNo || row.code })).filter(item => item.value)"
      @submit="saveManualRecord"
    />

    <a-modal v-model:open="salaryModeSaveResultOpen" width="440px" :footer="null" :closable="false" centered>
      <a-result :status="salaryModeSaveResult.success ? 'success' : 'error'" :title="salaryModeSaveResult.title" :sub-title="salaryModeSaveResult.detail">
        <template #extra>
          <a-button type="primary" @click="salaryModeSaveResultOpen = false">
            确定
          </a-button>
        </template>
      </a-result>
    </a-modal>

    <ImportConfirmDialog
      v-if="importPreview.open"
      :state="importPreview"
      @cancel="closeImportPreview"
      @reselect="closeImportPreview"
      @download-errors="downloadImportErrors"
      @confirm="confirmImport"
    />
  </page-container>
</template>

<style lang="less" scoped>
.batch-folder-picker {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.batch-folder-input {
  display: none;
}

.order-location-link {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 0;
  overflow: hidden;
  color: #1677ff;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;

  span,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--admin-muted);
    font-size: 11px;
  }
}

.order-location-empty {
  color: var(--admin-muted);
}

.transport-module-query {
  :deep(.ant-row) {
    row-gap: 8px !important;
  }

  :deep(.ant-form-item) {
    margin-bottom: 0;
  }

  :deep(.ant-form-item-label) {
    flex: 0 0 auto;
    padding-right: 8px;
    line-height: 32px;

    > label {
      height: 32px;
      color: var(--admin-text);
      font-size: 13px;
      font-weight: 600;
    }
  }

  :deep(.ant-form-item-control-input) {
    min-height: 32px;
  }

  :deep(.ant-picker),
  :deep(.ant-input),
  :deep(.ant-select) {
    width: 100%;
  }

  :deep(.ant-input),
  :deep(.ant-picker),
  :deep(.ant-select-selector),
  :deep(.ant-btn) {
    min-height: 32px;
  }

  .query-actions {
    :deep(.ant-form-item-control-input-content) {
      display: flex;
      justify-content: flex-start;
    }
  }

  .query-action-space {
    width: 100%;
    gap: 8px !important;
  }
}

.transport-query-card {
  margin-bottom: 12px;

  :deep(.ant-card-body) {
    padding: 16px 18px;
  }
}

.transport-overview-panel {
  margin-bottom: 12px;

  :deep(.summary-cards) {
    margin-bottom: 0;
  }

  :deep(.summary-cards .ant-col) {
    padding-bottom: 0;
  }
}

.base-data-form {
  :deep(.ant-form-item) {
    margin-bottom: 10px;
  }

  :deep(.ant-form-item-label) {
    padding-bottom: 4px;

    > label {
      color: var(--admin-text);
      font-weight: 600;
    }
  }
}

:deep(.order-entry-modal .ant-modal) {
  top: 20px;
  max-width: min(980px, calc(100vw - 48px));
  padding-bottom: 18px;
}

:deep(.order-entry-modal .ant-modal-body) {
  max-height: calc(100vh - 146px);
  overflow-y: auto;
  padding: 8px 18px 4px;
}

:deep(.order-entry-modal .ant-modal-header) {
  margin-bottom: 0;
  padding: 14px 22px 12px;
  border-bottom: 1px solid #eef2f7;
}

:deep(.order-entry-modal .ant-modal-footer) {
  margin-top: 0;
  padding: 12px 22px 14px;
  border-top: 1px solid #eef2f7;
  box-shadow: 0 -8px 24px rgb(15 23 42 / 4%);
}

.order-entry-form {
  .full-width {
    width: 100%;
  }

  :deep(.ant-divider) {
    margin: 8px 0 10px;
    font-size: 14px;
    font-weight: 600;
  }

  :deep(.ant-form-item) {
    margin-bottom: 8px;
  }

  :deep(.ant-form-item-label) {
    padding-bottom: 2px;
  }

  :deep(.ant-form-item-label > label) {
    height: 18px;
    color: #1f2937;
    font-size: 13px;
    font-weight: 600;
  }

  :deep(.ant-input),
  :deep(.ant-select-selector) {
    min-height: 34px;
    border-radius: 4px;
  }

  :deep(.ant-picker) {
    min-height: 34px;
    border-radius: 4px;
  }

  :deep(textarea.ant-input) {
    min-height: 60px;
  }
}

.order-modal-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  span {
    color: #111827;
    font-size: 17px;
    font-weight: 700;
  }
}

.order-form-hero {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  margin: 10px 0 10px;
  background: var(--admin-surface-muted);
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
}

.order-form-kicker {
  color: var(--admin-muted);
  font-size: 13px;
  font-weight: 600;
}

.order-form-heading {
  margin-top: 2px;
  color: var(--admin-text);
  font-size: 15px;
  font-weight: 700;
}

.order-total-preview {
  min-width: 132px;
  padding: 8px 12px;
  text-align: right;
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);

  span {
    display: block;
    color: var(--admin-muted);
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 2px;
    color: var(--admin-text);
    font-size: 18px;
    line-height: 1.1;
  }
}

.order-form-section {
  padding: 12px 14px 4px;
  margin-bottom: 8px;
  background: var(--admin-surface);
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
}

.section-heading {
  margin-bottom: 8px;
  color: var(--admin-text);
  font-size: 14px;
  font-weight: 700;
}

.order-fuel-panel {
  margin-top: 4px;
  padding: 20px 22px 10px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  background: var(--admin-surface);
}

.order-fuel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

  strong {
    color: var(--admin-text);
    font-size: 16px;
  }

  span {
    color: var(--admin-muted);
  }
}

.auto-summary {
  color: var(--admin-primary);
  font-size: 12px;
}

:deep(.danger-amount .ant-input),
:deep(.danger-amount.ant-input) {
  color: #ff4d4f;
}

.transport-order-table {
  :deep(.ant-table-cell) {
    overflow-wrap: anywhere;
    white-space: normal;
  }

  :deep(.ant-table-thead > tr > th) {
    white-space: normal;
  }

  :deep(.ant-table-tbody > tr > td) {
    overflow: visible;
    text-overflow: clip;
  }

  :deep(.order-fuel-overrun-row > td) {
    background: #fff1f0 !important;
    color: #a8071a;
  }

  :deep(.order-fuel-overrun-row:hover > td) {
    background: #ffd8d4 !important;
  }
}

.transport-etc-table {
  :deep(.ant-table) {
    table-layout: auto;
  }

  :deep(.ant-table-cell) {
    overflow-wrap: anywhere;
    white-space: normal;
  }

  :deep(.ant-table-thead > tr > th),
  :deep(.ant-table-tbody > tr > td) {
    padding-inline: 14px;
  }

  :deep(.ant-table-tbody > tr > td) {
    overflow: visible;
    text-overflow: clip;
  }

  :deep(.table-cell-money) {
    font-variant-numeric: tabular-nums;
  }
}

.vehicle-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
}

.vehicle-main {
  color: var(--admin-text);
  font-weight: 600;
}

.vehicle-sub {
  color: var(--admin-muted);
  font-size: 12px;
}

.salary-stat-value {
  display: inline-flex;
  min-width: 46px;
  justify-content: flex-end;
  color: var(--admin-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.salary-net-amount {
  color: var(--admin-success);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.salary-date-value {
  color: var(--admin-text-secondary);
  font-variant-numeric: tabular-nums;
}

:deep(.transport-driver-payroll-table .ant-table-thead > tr > th) {
  white-space: nowrap;
  color: var(--admin-text-secondary);
  font-size: 13px;
  font-weight: 650;
}

:deep(.transport-driver-payroll-table .ant-table-tbody > tr > td) {
  color: var(--admin-text);
  font-size: 14px;
  line-height: 1.45;
}

:deep(.transport-driver-payroll-table .ant-table-tbody > tr > td:nth-child(2)) {
  font-weight: 650;
}

.driver-payroll-card {
  :deep(.ant-card-head) {
    min-height: 54px;
  }
}

.driver-payroll-tabs {
  margin-bottom: 12px;

  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
  }
}

.salary-mode-card-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  gap: 12px;
  padding: 4px 0 8px;
  overflow-x: auto;
}

.salary-mode-card {
  min-width: 220px;
  padding: 18px;
  border: 1px solid #dce3ec;
  border-radius: 8px;
  background: #fff;
}

.salary-mode-card-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.salary-mode-card h3 {
  margin: 0;
  color: currentColor;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
}

.salary-mode-card p {
  min-height: 40px;
  margin: 6px 0 0;
  color: var(--admin-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.salary-mode-card.mode-fixed {
  color: #1677ff;
  background: #f7faff;
}

.salary-mode-card.mode-base-diff {
  color: #389e0d;
  background: #f8fff4;
}

.salary-mode-card.mode-base-mileage {
  color: #d46b08;
  background: #fffaf2;
}

.salary-mode-card.mode-mileage {
  color: #722ed1;
  background: #fbf8ff;
}

.salary-mode-driver-count {
  flex: none;
  padding: 3px 8px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.salary-mode-card-period {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding: 10px 0;
  border-top: 1px solid rgb(15 23 42 / 9%);
  border-bottom: 1px solid rgb(15 23 42 / 9%);
  color: var(--admin-text-secondary);
  font-size: 13px;
}

.salary-mode-card-period strong {
  color: var(--admin-text);
  font-variant-numeric: tabular-nums;
}

.salary-mode-driver-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 30px;
  margin-top: 12px;
}

.salary-mode-driver-list button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #d5dce6;
  border-radius: 6px;
  color: var(--admin-text);
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.salary-mode-driver-list button:hover,
.salary-mode-driver-list button:focus-visible {
  border-color: currentColor;
  color: currentColor;
}

.salary-mode-empty {
  color: var(--admin-muted);
  font-size: 13px;
  line-height: 28px;
}

@media (max-width: 1100px) {
  .salary-mode-card-grid {
    grid-template-columns: repeat(2, minmax(240px, 1fr));
  }
}

.linked-field-tip {
  margin-top: 6px;
  color: rgb(89 89 89);
  font-size: 12px;
  line-height: 1.5;
}

.driver-attendance-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 14px;
  overflow-x: auto;
}

.attendance-legend {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: max-content;
  color: var(--admin-text-secondary);
  font-size: 13px;
}

.attendance-legend-title {
  color: var(--admin-text);
  font-weight: 650;
}

.legend-check {
  position: relative;
  display: inline-flex;
  gap: 5px;
  align-items: center;
  color: var(--admin-text-secondary);
}

.legend-check::before {
  width: 16px;
  height: 16px;
  border: 1px solid var(--admin-border);
  border-radius: 4px;
  content: '';
  background: #fff;
}

.legend-check.is-active::before {
  border-color: #5ed6a4;
  background: #c8f7df;
  box-shadow: inset 0 0 0 4px #effff7;
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 12px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-weight: 650;
  line-height: 1;
}

.mode-fixed {
  color: #1677ff;
  background: #eaf2ff;
}

.mode-base-diff {
  color: #389e0d;
  background: #edf9e8;
}

.mode-base-mileage {
  color: #d46b08;
  background: #fff4e6;
}

.mode-mileage {
  color: #722ed1;
  background: #f4ecff;
}

.attendance-tip {
  color: var(--admin-muted);
}

.driver-attendance-board {
  overflow: auto hidden;
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  background: var(--admin-surface);
}

.attendance-grid {
  display: grid;
  min-width: max-content;
}

.attendance-header-row {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f7f9fc;
  color: var(--admin-text-secondary);
  font-size: 13px;
  font-weight: 650;
}

.attendance-body-row {
  min-height: 68px;
  border-top: 1px solid var(--admin-border-subtle);
}

.attendance-fixed-col,
.attendance-total-col,
.attendance-day-head {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 12px 10px;
}

.attendance-day-head {
  flex-direction: column;
  gap: 2px;
  justify-content: center;
  border: 0;
  border-left: 1px solid #d9e1ec;
  color: var(--admin-text-secondary);
  background: transparent;
  cursor: pointer;
  font-weight: 600;
  line-height: 1.1;
}

.attendance-day-head small {
  color: var(--admin-muted);
  font-size: 12px;
  font-weight: 500;
}

.attendance-day-head.is-weekend,
.attendance-day-head.is-weekend small {
  color: #ff4d4f;
}

.driver-name-cell {
  gap: 8px;
  color: var(--admin-text);
  font-weight: 700;
}

.attendance-stack {
  display: grid;
  grid-auto-rows: minmax(32px, 1fr);
  gap: 4px;
  align-content: center;
}

.attendance-person-line {
  display: flex;
  gap: 7px;
  align-items: center;
  min-width: 0;
}

.attendance-person-line strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.crew-role-badge {
  flex: none;
  min-width: 42px;
  color: var(--admin-muted);
  font-size: 12px;
  font-weight: 500;
}

.attendance-person-line:first-child .crew-role-badge {
  color: #1677ff;
  font-weight: 650;
}

.attendance-person-line:not(:first-child) strong {
  color: var(--admin-text-secondary);
  font-weight: 500;
}

.plate-list-cell {
  display: flex;
  gap: 6px;
  align-items: center;
  overflow: hidden;
  flex-wrap: wrap;
}

.plate-list-cell :deep(.ant-tag) {
  max-width: none;
  height: 28px;
  padding: 0 12px;
  border-color: #d5e0ef;
  border-radius: 999px;
  color: #18263b;
  background: #fff;
  font-size: 14px;
  font-weight: 650;
  line-height: 26px;
  margin-inline-end: 0;
  white-space: nowrap;
}

.plate-add-button,
.plate-edit-button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  color: var(--admin-text);
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  font-weight: 650;
  line-height: 1;
}

.plate-edit-button:focus-visible,
.inline-config-button:focus-visible,
.attendance-day-cell:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 2px;
}

.inline-config-button {
  width: fit-content;
  max-width: 100%;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.mode-config-control {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.mode-config-action {
  color: #1677ff;
  font-size: 13px;
  font-weight: 600;
}

.mode-config-control:hover .mode-config-action {
  text-decoration: underline;
}

.date-config-button {
  color: #1677ff;
  font-variant-numeric: tabular-nums;
}

.attendance-day-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 68px;
  border-left: 1px solid #e2e8f0;
  background: #fbfcfe;
}

.attendance-day-empty,
.attendance-empty {
  color: var(--admin-muted);
}

.attendance-day-cell {
  width: 32px;
  height: 32px;
  align-self: center;
  justify-self: center;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  color: #16324f;
  font-size: 13px;
  line-height: 1;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.plate-editor-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 30px;
  margin-bottom: 8px;
}

.plate-add-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px auto;
  gap: 8px;
}

.full-width-input {
  width: 100%;
}

@media (max-width: 575px) {
  .plate-add-row {
    grid-template-columns: 1fr;
  }
}

.salary-mode-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.salary-mode-option {
  min-height: 48px;
  padding: 10px 14px;
  border: 1px solid #d7dee8;
  border-radius: 8px;
  color: var(--admin-text);
  background: #fff;
  cursor: pointer;
  font-size: 15px;
  font-weight: 650;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.salary-mode-option:hover {
  border-color: currentColor;
}

.salary-mode-option.is-selected {
  border-color: currentColor;
  box-shadow: inset 0 0 0 1px currentColor;
}

.salary-mode-option.mode-fixed {
  color: #1677ff;
  background: #f5f9ff;
}

.salary-mode-option.mode-base-diff {
  color: #389e0d;
  background: #f6ffed;
}

.salary-mode-option.mode-base-mileage {
  color: #d46b08;
  background: #fff7e6;
}

.salary-mode-option.mode-mileage {
  color: #722ed1;
  background: #f9f0ff;
}

.salary-mode-option:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 2px;
}

.attendance-day-cell.is-marked.mode-fixed {
  border-color: #91caff;
  background: #9cc4ff;
}

.attendance-day-cell.is-marked.mode-base-diff {
  border-color: #95de64;
  background: #8bdc73;
}

.attendance-day-cell.is-marked.mode-base-mileage {
  border-color: #ffc069;
  background: #ffba63;
}

.attendance-day-cell.is-marked.mode-mileage {
  border-color: #d3adf7;
  background: #bf8df2;
}

.attendance-day-cell.is-selected-day {
  box-shadow: 0 0 0 2px #4f7df3;
}

.attendance-day-cell:hover {
  border-color: #4f7df3;
  background: #f5f8ff;
}

@media (prefers-reduced-motion: reduce) {
  .attendance-day-cell {
    transition: none;
  }
}

.attendance-total-value {
  justify-content: flex-end;
  color: #00a66a;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  .transport-overview-panel {
    margin-bottom: 12px;
  }

  .transport-module-query {
    .query-action-space {
      :deep(.ant-space-item),
      :deep(.ant-btn) {
        width: 100%;
      }
    }
  }

  :deep(.order-entry-modal .ant-modal) {
    top: 12px;
    max-width: calc(100vw - 16px);
  }

  :deep(.order-entry-modal .ant-modal-body) {
    max-height: calc(100vh - 148px);
    padding: 8px 16px 0;
  }
}
</style>

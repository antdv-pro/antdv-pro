<script setup lang="ts">
/* eslint-disable ts/no-use-before-define -- option computeds are evaluated after query state initialization */
import type { FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import type { Dayjs } from 'dayjs'
import type {
  RegulatoryFeeModel,
  RegulatoryFeeOverviewRow,
  RegulatoryFeeOverviewSummary,
  RegulatoryFeePayload,
  RegulatoryFeeStatus,
} from '~@/api/transport/fees'
import type { RecordActionItem } from '~@/components/record-actions/index.vue'
import { DownloadOutlined, FileOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { cloneDeep } from 'lodash-es'
import * as XLSX from 'xlsx'
import {
  changeRegulatoryFeeStatusApi,
  createRegulatoryFeeApi,
  deleteRegulatoryFeeApi,
  exportRegulatoryFeeApi,
  getRegulatoryFeeListApi,
  getRegulatoryFeeOverviewApi,
  getRegulatoryFeeSummaryApi,
  importRegulatoryFeesApi,
  submitRegulatoryFeeApprovalApi,
  updateRegulatoryFeeApi,
} from '~@/api/transport/fees'
import BusinessDetailDrawer from '~@/components/business-detail-drawer/index.vue'
import RecordActions from '~@/components/record-actions/index.vue'
import SummaryCards from '~@/components/summary-cards/index.vue'
import { useBusinessDictionaries } from '~@/composables/business-dictionaries'
import { createFinancialMonthOptions, createFinancialYearOptions } from '~@/composables/financial-period-filter'
import { useRecordPermission } from '~@/composables/record-permission'
import { transportVehicleOptions } from '~@/data/transport-vehicles'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { createFinancialComparison } from '~@/utils/financial-comparison'
import { getCurrentFinancialMonthRange } from '~@/utils/financialPeriod'
import { downloadWorkbook } from '~@/utils/xlsx-export'
import RegulatoryFeeInsights from '../components/regulatory-fee-insights.vue'
import { parseRegulatoryFeeWorkbook } from './import-utils'

interface QueryModel {
  plateNo?: string
  trailerNo?: string
  financialYear?: number
  financialMonth?: number
  upcomingOnly?: boolean
  feeType?: string
  status?: RegulatoryFeeStatus
}

type FeeFormModel = Omit<RegulatoryFeePayload, 'validStartDate' | 'validEndDate'> & {
  id?: number
  dateRange?: [Dayjs, Dayjs]
}

const message = useMessage()
const businessDictionaries = useBusinessDictionaries()
const route = useRoute()
const { canViewRecord, canEditRecord, canDeleteRecord } = useRecordPermission()

const regulatoryFeeTypeOptions = computed(() => businessDictionaries.options('regulatory_fee_type'))
const vehicleSelectOptions = transportVehicleOptions.map(item => ({
  label: `${item.plateNo} / ${item.trailerNo || '无挂车'}`,
  value: item.plateNo,
}))
const overviewDateFieldKeys = [
  'trafficInsurance',
  'ownerCommercialInsurance',
  'trailerCommercialInsurance',
  'vehicleAccidentInsurance',
  'carrierLiabilityInsurance',
  'gpsFee',
  'ownerDrivingPermit',
  'trailerDrivingPermit',
  'cylinderYearCheck',
  'tankCheck',
  'safetyValveYearCheck',
  'pressureGaugeCalibration',
] as const
const qinghaiVehiclePlateSet = new Set([
  '青H53424',
  '青H76461',
  '青H75176',
  '青H76720',
  '青HA4780',
  '青H95941',
  '青H75141',
  '青H53948',
  '青H75104',
  '青H75194',
  '青HA2493',
  '青HA4752',
  '青H75106',
  '青H51384',
  '青H55343',
  '青HA3920',
  '青HA3479',
])
const statusOptions: RegulatoryFeeStatus[] = ['未开始', '生效中', '已截止', '停用']
const financialYearOptions = createFinancialYearOptions()
const financialMonthOptions = computed(() => createFinancialMonthOptions(queryModel.financialYear))

const activeTab = ref('overview')
const queryModel = reactive<QueryModel>({})
const overviewLoading = ref(false)
const overviewRows = ref<RegulatoryFeeOverviewRow[]>([])
const overviewSummary = ref<RegulatoryFeeOverviewSummary>({
  totalCount: 0,
  totalAmount: 0,
})
const recordSummary = ref({
  activeCount: 0,
  currentMonthCount: 0,
  financialYearAmount: 0,
  financialMonthAmount: 0,
  monthlyAmortizedAmount: 0,
  approvalTotalAmount: 0,
  usedAmount: 0,
  previousMonthCount: 0,
  previousMonthAmount: 0,
  previousApprovalTotalAmount: 0,
  previousUsedAmount: 0,
  typeAmounts: [] as Array<{ feeType: string, amount: number, count: number }>,
})

const summaryCards = computed(() => [
  {
    label: '本月生效规费',
    value: recordSummary.value.currentMonthCount,
    comparison: createFinancialComparison(recordSummary.value.currentMonthCount, recordSummary.value.previousMonthCount, `${recordSummary.value.previousMonthCount} 笔`),
    tone: 'primary' as const,
  },
  {
    label: '财务月费用',
    value: formatAmount(recordSummary.value.financialMonthAmount),
    comparison: createFinancialComparison(recordSummary.value.financialMonthAmount, recordSummary.value.previousMonthAmount, formatAmount(recordSummary.value.previousMonthAmount)),
    tone: 'success' as const,
  },
  {
    label: '审批金额',
    value: formatAmount(recordSummary.value.approvalTotalAmount),
    comparison: createFinancialComparison(recordSummary.value.approvalTotalAmount, recordSummary.value.previousApprovalTotalAmount, formatAmount(recordSummary.value.previousApprovalTotalAmount)),
    tone: 'warning' as const,
  },
  {
    label: '已使用金额',
    value: formatAmount(recordSummary.value.usedAmount),
    comparison: createFinancialComparison(recordSummary.value.usedAmount, recordSummary.value.previousUsedAmount, formatAmount(recordSummary.value.previousUsedAmount)),
    tone: 'default' as const,
  },
])

const modalOpen = ref(false)
const detailOpen = ref(false)
const detailRecord = ref<RegulatoryFeeModel>()
const feeTypeDetailOpen = ref(false)
const feeTypeDetailLoading = ref(false)
const feeTypeDetailName = ref('')
const feeTypeDetailRows = ref<RegulatoryFeeModel[]>([])
const submitting = ref(false)
const isUpdate = ref(false)
const formRef = ref<FormInstance>()
const formData = ref<FeeFormModel>(createEmptyForm())
const importModalOpen = ref(false)
const importSubmitting = ref(false)
const importFileName = ref('')
const importRecords = ref<Array<RegulatoryFeePayload & { rowNumber: number }>>([])
const importErrors = ref<string[]>([])
const attachmentUploading = ref(false)
const attachmentsLoading = ref(false)
const allAttachmentRecords = ref<RegulatoryFeeModel[]>([])

const overviewColumns = [
  { title: '序号', dataIndex: 'id', width: '4%' },
  { title: '车号 / 挂号', dataIndex: 'plateNo', width: '11%' },
  { title: '区域', dataIndex: 'area', width: '6%' },
  { title: '交强险', dataIndex: 'trafficInsurance', width: '6.58%' },
  { title: '主车商业险', dataIndex: 'ownerCommercialInsurance', width: '6.58%' },
  { title: '挂车商业险', dataIndex: 'trailerCommercialInsurance', width: '6.58%' },
  { title: '车辆意外险', dataIndex: 'vehicleAccidentInsurance', width: '6.58%' },
  { title: '承运人责任险', dataIndex: 'carrierLiabilityInsurance', width: '6.58%' },
  { title: 'GPS年费', dataIndex: 'gpsFee', width: '6.58%' },
  { title: '主车行驶证', dataIndex: 'ownerDrivingPermit', width: '6.58%' },
  { title: '挂车行驶证', dataIndex: 'trailerDrivingPermit', width: '6.58%' },
  { title: '气瓶年审', dataIndex: 'cylinderYearCheck', width: '6.58%' },
  { title: '罐体检测', dataIndex: 'tankCheck', width: '6.58%' },
  { title: '安全阀年检', dataIndex: 'safetyValveYearCheck', width: '6.58%' },
  { title: '压力表校验', dataIndex: 'pressureGaugeCalibration', width: '6.58%' },
]
const overviewTableColumns = computed(() => enhanceBusinessTableColumns(overviewColumns, { dateFields: ['Insurance', 'Permit', 'Check', 'Fee'] }))
const linkedOverviewRows = computed(() => {
  const feeRowsByPlateNo = new Map(overviewRows.value.map(row => [normalizePlateKey(normalizePlateNo(row.plateNo)), row]))
  const keyword = normalizePlateKey(queryModel.plateNo)

  return transportVehicleOptions
    .filter(vehicle => !keyword || normalizePlateKey(`${vehicle.plateNo}${vehicle.trailerNo}`).includes(keyword))
    .map((vehicle) => {
      const feeRow = feeRowsByPlateNo.get(normalizePlateKey(vehicle.plateNo))
      return {
        ...feeRow,
        plateNo: [vehicle.plateNo, vehicle.trailerNo].filter(Boolean).join('\n'),
        area: getBaseVehicleArea(vehicle.plateNo) || feeRow?.area || '-',
      }
    })
    .filter(row => !queryModel.upcomingOnly || overviewDateFieldKeys.some(key => isUpcomingOverviewDate(row[key])))
    .map((row) => {
      if (!queryModel.upcomingOnly)
        return row

      return overviewDateFieldKeys.reduce((filteredRow, key) => {
        filteredRow[key] = filterUpcomingOverviewDates(row[key])
        return filteredRow
      }, { ...row })
    })
    .map((row, index) => ({ ...row, id: index + 1 }))
})

const recordColumns = shallowRef([
  { title: '规费类型', dataIndex: 'feeType', width: 140 },
  { title: '车号 / 挂号', dataIndex: 'vehicleNo', width: 150 },
  { title: '所在区域', dataIndex: 'area', width: 120 },
  { title: '有效期开始日期', dataIndex: 'validStartDate', width: 140 },
  { title: '有效期截止日期', dataIndex: 'validEndDate', width: 140 },
  { title: '有效时长（月）', dataIndex: 'validMonths', width: 120 },
  { title: '月均摊费用', dataIndex: 'monthlyAmortizedAmount', width: 120 },
  { title: '总金额', dataIndex: 'totalAmount', width: 120 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 110 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
  { title: '创建时间', dataIndex: 'createdAt', width: 170 },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 220 },
])
const recordTableColumns = computed(() => enhanceBusinessTableColumns(recordColumns.value))
const recordTableScrollX = computed(() => createBusinessTableScrollX(recordTableColumns.value, 1580))
const feeTypeDetailColumns = enhanceBusinessTableColumns([
  { title: '车号 / 挂号', dataIndex: 'vehicleNo', width: 150 },
  { title: '所在区域', dataIndex: 'area', width: 110 },
  { title: '有效期开始日期', dataIndex: 'validStartDate', width: 135 },
  { title: '有效期截止日期', dataIndex: 'validEndDate', width: 135 },
  { title: '有效时长（月）', dataIndex: 'validMonths', width: 115 },
  { title: '月均摊费用', dataIndex: 'monthlyAmortizedAmount', width: 120 },
  { title: '总金额', dataIndex: 'totalAmount', width: 120 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
])

const { state, initQuery, query } = useTableQuery({
  queryApi: getRegulatoryFeeListApi,
  queryParams: queryModel,
  queryOnMounted: false,
  beforeQuery() {
    state.queryParams = buildRecordQueryParams()
  },
})
const attachmentRows = computed(() => allAttachmentRecords.value.filter((row) => {
  if (!row.attachmentName)
    return false
  if (queryModel.feeType && row.feeType !== queryModel.feeType)
    return false
  return !queryModel.plateNo || normalizePlateKey(row.plateNo).includes(normalizePlateKey(queryModel.plateNo))
}))
const linkedRecordRows = computed(() => state.dataSource.map(row => ({
  ...row,
  area: getBaseVehicleArea(row.plateNo) || row.area,
})))

const calculatedValidMonths = computed(() => {
  const [start, end] = formData.value.dateRange || []
  return calculateValidMonths(start, end)
})
const calculatedMonthlyAmount = computed(() => {
  if (!calculatedValidMonths.value)
    return '0.00'
  return (Number(formData.value.totalAmount || 0) / calculatedValidMonths.value).toFixed(2)
})

const formRules: Record<string, Rule[]> = {
  feeType: [{ required: true, message: '请选择规费类型', trigger: 'change' }],
  plateNo: [{ required: true, message: '请选择车号', trigger: 'change' }],
  totalAmount: [
    { required: true, message: '请输入单项总费用', trigger: 'change' },
    { validator: validateTotalAmount, trigger: 'change' },
  ],
  dateRange: [
    { required: true, message: '请选择有效期', trigger: 'change' },
    { validator: validateDateRange, trigger: 'change' },
  ],
}

function createEmptyForm(): FeeFormModel {
  return {
    feeType: undefined as any,
    plateNo: '',
    trailerNo: '',
    area: '',
    totalAmount: 0,
    dateRange: undefined,
    remark: '',
    attachmentName: undefined,
    attachmentUrl: undefined,
  }
}

function calculateValidMonths(start?: Dayjs, end?: Dayjs) {
  if (!start || !end || end.isBefore(start, 'day'))
    return 0

  // The end date is inclusive. Count complete or partial term months instead
  // of counting every calendar-month bucket touched by the date range.
  const exclusiveEnd = end.add(1, 'day')
  const calendarMonths = (exclusiveEnd.year() - start.year()) * 12 + exclusiveEnd.month() - start.month()
  const anniversary = start.add(calendarMonths, 'month')
  return Math.max(1, calendarMonths + (exclusiveEnd.isAfter(anniversary, 'day') ? 1 : 0))
}

function buildPayload(): RegulatoryFeePayload {
  const [start, end] = formData.value.dateRange!
  return {
    feeName: formData.value.feeType,
    feeType: formData.value.feeType,
    plateNo: formData.value.plateNo?.trim(),
    trailerNo: formData.value.trailerNo?.trim(),
    area: formData.value.area?.trim(),
    totalAmount: Number(formData.value.totalAmount),
    validStartDate: start.format('YYYY-MM-DD'),
    validEndDate: end.format('YYYY-MM-DD'),
    remark: formData.value.remark,
    attachmentName: formData.value.attachmentName,
    attachmentUrl: formData.value.attachmentUrl,
  }
}

function buildRecordQueryParams(): QueryModel {
  return {
    plateNo: queryModel.plateNo,
    trailerNo: queryModel.trailerNo,
    financialYear: queryModel.financialYear,
    financialMonth: queryModel.financialMonth,
    feeType: queryModel.feeType,
    status: queryModel.status,
  }
}

watch(() => queryModel.financialYear, () => {
  if (!queryModel.financialYear)
    queryModel.financialMonth = undefined
})

function handleQuery() {
  initQuery()
  loadOverview()
  loadRecordSummary()
}

function handleReset() {
  Object.keys(queryModel).forEach((key) => {
    delete queryModel[key as keyof QueryModel]
  })
  state.queryParams = buildRecordQueryParams()
  state.pagination.current = 1
  query()
  loadOverview()
  loadRecordSummary()
}

async function loadOverview() {
  overviewLoading.value = true
  try {
    const res = await getRegulatoryFeeOverviewApi({
      plateNo: queryModel.plateNo,
      upcomingOnly: queryModel.upcomingOnly,
    })
    overviewRows.value = res.data?.records ?? []
    overviewSummary.value = res.data?.summary ?? { totalCount: 0, totalAmount: 0 }
  }
  finally {
    overviewLoading.value = false
  }
}

async function loadRecordSummary() {
  const { financialYear, financialMonth } = getSelectedFinancialPeriod()
  const previousPeriod = dayjs(`${financialYear}-${String(financialMonth).padStart(2, '0')}-01`).subtract(1, 'month')
  const baseQuery = {
    plateNo: queryModel.plateNo,
    trailerNo: queryModel.trailerNo,
    feeType: queryModel.feeType,
    status: '生效中' as RegulatoryFeeStatus,
  }
  const [activeRes, yearRes, monthRes, previousMonthRes] = await Promise.all([
    getRegulatoryFeeSummaryApi(baseQuery),
    getRegulatoryFeeSummaryApi({ ...baseQuery, financialYear }),
    getRegulatoryFeeSummaryApi({ ...baseQuery, financialYear, financialMonth }),
    getRegulatoryFeeSummaryApi({ ...baseQuery, financialYear: previousPeriod.year(), financialMonth: previousPeriod.month() + 1 }),
  ])
  recordSummary.value = {
    activeCount: Number(activeRes.data?.activeCount || 0),
    currentMonthCount: Number(monthRes.data?.activeCount || 0),
    financialYearAmount: Number(yearRes.data?.totalAmount || 0),
    financialMonthAmount: Number(monthRes.data?.totalAmount || 0),
    monthlyAmortizedAmount: Number(activeRes.data?.monthlyAmortizedAmount || 0),
    approvalTotalAmount: Number(monthRes.data?.approvalTotalAmount || 0),
    usedAmount: Number(monthRes.data?.usedAmount || 0),
    previousMonthCount: Number(previousMonthRes.data?.activeCount || 0),
    previousMonthAmount: Number(previousMonthRes.data?.totalAmount || 0),
    previousApprovalTotalAmount: Number(previousMonthRes.data?.approvalTotalAmount || 0),
    previousUsedAmount: Number(previousMonthRes.data?.usedAmount || 0),
    typeAmounts: monthRes.data?.typeAmounts ?? [],
  }
}

async function loadAttachments() {
  attachmentsLoading.value = true
  try {
    const res = await getRegulatoryFeeListApi({ current: 1, pageSize: 10000 })
    allAttachmentRecords.value = res.data?.records ?? []
  }
  finally { attachmentsLoading.value = false }
}

function getSelectedFinancialPeriod() {
  const currentPeriod = getCurrentFinancialMonthRange()
  return {
    financialYear: queryModel.financialYear || Number(currentPeriod.key.slice(0, 4)),
    financialMonth: queryModel.financialMonth || Number(currentPeriod.key.slice(4, 6)),
  }
}

async function openFeeTypeDetail(feeType: string) {
  feeTypeDetailName.value = feeType
  feeTypeDetailRows.value = []
  feeTypeDetailOpen.value = true
  feeTypeDetailLoading.value = true
  try {
    const { financialYear, financialMonth } = getSelectedFinancialPeriod()
    const res = await getRegulatoryFeeListApi({
      current: 1,
      pageSize: 10000,
      plateNo: queryModel.plateNo,
      trailerNo: queryModel.trailerNo,
      financialYear,
      financialMonth,
      feeType,
      status: '生效中',
    })
    feeTypeDetailRows.value = (res.data?.records ?? []).map(row => ({
      ...row,
      area: getBaseVehicleArea(row.plateNo) || row.area,
    }))
  }
  finally {
    feeTypeDetailLoading.value = false
  }
}

function handleTemplate() {
  const rows = [{
    规费类型: '交强险',
    车号: '青H53424',
    挂号: '',
    所在区域: '青海',
    单项总费用: 1200,
    有效期开始日期: dayjs().format('YYYY-MM-DD'),
    有效期截止日期: dayjs().add(1, 'year').subtract(1, 'day').format('YYYY-MM-DD'),
    备注: '',
  }]
  downloadWorkbook('规费记录导入模板.xlsx', [{ name: '规费记录导入', rows }])
  message.success('模板下载成功')
}

async function handleImport(file: File) {
  importFileName.value = file.name
  importRecords.value = []
  importErrors.value = []
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true })
    const result = parseRegulatoryFeeWorkbook(workbook, regulatoryFeeTypeOptions.value.map(item => item.value))
    importRecords.value = result.records
    importErrors.value = result.errors
    importModalOpen.value = true
  }
  catch (error: any) {
    message.error(error?.message || '文件解析失败')
  }
  return false
}

async function confirmImport() {
  if (importSubmitting.value)
    return
  if (importErrors.value.length)
    return message.warning('请修正错误后重新选择文件')
  if (!importRecords.value.length)
    return message.warning('没有可导入的规费记录')
  importSubmitting.value = true
  try {
    const records = importRecords.value.map(({ rowNumber: _rowNumber, ...record }) => record)
    const res = await importRegulatoryFeesApi(records)
    if (res.code !== 200)
      return message.error(res.msg || '导入失败')
    message.success(`成功导入 ${res.data?.importedCount || records.length} 条规费记录`)
    importModalOpen.value = false
    activeTab.value = 'records'
    await Promise.all([query(), loadOverview(), loadRecordSummary()])
  }
  finally {
    importSubmitting.value = false
  }
}

function handleOverviewExport() {
  downloadWorkbook(`规费一览表_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`, [{ name: '规费一览表', rows: linkedOverviewRows.value.map(row => ({ ...row })) }])
  message.success('导出成功')
}

function handleAdd() {
  isUpdate.value = false
  formData.value = createEmptyForm()
  modalOpen.value = true
}

function handleView(record: RegulatoryFeeModel) {
  const permission = canViewRecord(record)
  if (!permission.allowed) {
    message.warning(permission.reason || '无查看权限')
    return
  }
  detailRecord.value = record
  detailOpen.value = true
}

function editDetailRecord() {
  if (!detailRecord.value)
    return
  const record = detailRecord.value
  detailOpen.value = false
  handleEdit(record)
}

function handleEdit(record: RegulatoryFeeModel) {
  const permission = canEditRecord(record)
  if (!permission.allowed)
    return message.warning(permission.reason || '无编辑权限')
  isUpdate.value = true
  formData.value = {
    id: record.id,
    feeType: record.feeType,
    plateNo: record.plateNo,
    trailerNo: record.trailerNo,
    area: getBaseVehicleArea(record.plateNo) || record.area,
    totalAmount: record.totalAmount,
    dateRange: [dayjs(record.validStartDate), dayjs(record.validEndDate)],
    remark: record.remark,
    attachmentName: record.attachmentName,
    attachmentUrl: record.attachmentUrl,
  }
  modalOpen.value = true
}

async function uploadFeeAttachment(file: File) {
  attachmentUploading.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const response = await fetch('/api/uploads', { method: 'POST', body })
    const result = await response.json()
    if (!response.ok || result.code !== 200)
      throw new Error(result.msg || '附件上传失败')
    formData.value.attachmentName = result.data.originalName
    formData.value.attachmentUrl = result.data.url
    message.success('附件上传成功')
  }
  catch (error: any) {
    message.error(error?.message || '附件上传失败')
  }
  finally { attachmentUploading.value = false }
  return false
}

function openAttachments(record?: RegulatoryFeeModel) {
  activeTab.value = 'attachments'
  if (record?.feeType)
    queryModel.feeType = record.feeType
}

async function handleSubmit() {
  if (submitting.value)
    return
  try {
    await formRef.value?.validate()
    submitting.value = true
    const payload = buildPayload()
    const res = isUpdate.value && formData.value.id
      ? await updateRegulatoryFeeApi(formData.value.id, payload)
      : await createRegulatoryFeeApi(payload)
    if (res.code !== 200)
      return message.error(res.msg)
    modalOpen.value = false
    message.success(isUpdate.value ? '规费编辑成功' : '规费录入成功')
    await Promise.all([query(), loadOverview(), loadAttachments(), loadRecordSummary()])
  }
  finally {
    submitting.value = false
  }
}

async function handleDelete(record: RegulatoryFeeModel) {
  const permission = canDeleteRecord(record)
  if (!permission.allowed)
    return message.warning(permission.reason || '无删除权限')
  if (!record.id)
    return
  const res = await deleteRegulatoryFeeApi(record.id)
  if (res.code !== 200)
    return message.error(res.msg)
  message.success('删除成功')
  await query()
  await loadOverview()
  await loadAttachments()
}

async function handleStatusChange(record: RegulatoryFeeModel) {
  const permission = canEditRecord(record)
  if (!permission.allowed)
    return message.warning(permission.reason || '无修改权限')
  if (!record.id)
    return
  const manualStatus = record.manualStatus === 'disabled' ? 'enabled' : 'disabled'
  const res = await changeRegulatoryFeeStatusApi(record.id, manualStatus)
  if (res.code !== 200)
    return message.error(res.msg)
  message.success(manualStatus === 'disabled' ? '已停用' : '已启用')
  await query()
  await loadOverview()
  await loadAttachments()
}

function handleEditRecord(record: Record<string, any>) {
  handleEdit(record as RegulatoryFeeModel)
}

function handleStatusChangeRecord(record: Record<string, any>) {
  handleStatusChange(record as RegulatoryFeeModel)
}

function handleDeleteRecord(record: Record<string, any>) {
  handleDelete(record as RegulatoryFeeModel)
}

async function handleSubmitApproval(record: RegulatoryFeeModel) {
  if (!record.id)
    return
  const res = await submitRegulatoryFeeApprovalApi(record.id)
  if (res.code !== 200)
    return message.error(res.msg || '提交审批失败')
  message.success('已提交审批')
  await query()
  await loadOverview()
}

function getRecordActions(record: Record<string, any>): RecordActionItem[] {
  const canView = canViewRecord(record)
  const canEdit = canEditRecord(record)
  const canDelete = canDeleteRecord(record)
  return [
    {
      key: 'view',
      label: '查看',
      disabled: !canView.allowed,
      onClick: () => handleView(record as RegulatoryFeeModel),
    },
    {
      key: 'edit',
      label: '编辑',
      hidden: !canEdit.allowed,
      disabled: !canEdit.allowed,
      onClick: () => handleEditRecord(record),
    },
    {
      key: 'attachment',
      label: '查找附件',
      hidden: !record.attachmentName,
      onClick: () => openAttachments(record as RegulatoryFeeModel),
    },
    {
      key: 'status',
      label: record.manualStatus === 'disabled' ? '启用' : '停用',
      hidden: !canEdit.allowed,
      disabled: !canEdit.allowed,
      onClick: () => handleStatusChangeRecord(record),
    },
    {
      key: 'approval',
      label: '提交审批',
      hidden: true,
      onClick: () => handleSubmitApproval(record as RegulatoryFeeModel),
    },
    {
      key: 'delete',
      label: '删除',
      danger: true,
      confirm: true,
      confirmTitle: '确定删除该规费？',
      hidden: !canDelete.allowed,
      disabled: !canDelete.allowed,
      onClick: () => handleDeleteRecord(record),
    },
  ]
}

async function handleExport() {
  const res = await exportRegulatoryFeeApi(cloneDeep(buildRecordQueryParams()))
  if (res.code !== 200 || !res.data)
    return message.error(res.msg || '导出失败')
  const rows = res.data.map(item => ({
    规费类型: item.feeType,
    '车号 / 挂号': formatVehicleNo(item.plateNo, item.trailerNo, ' / '),
    所在区域: item.area,
    有效期开始日期: item.validStartDate,
    有效期截止日期: item.validEndDate,
    '有效时长（月）': item.validMonths,
    月均摊费用: item.monthlyAmortizedAmount,
    总金额: item.totalAmount,
    状态: item.status,
    备注: item.remark,
  }))
  downloadWorkbook(`规费记录列表_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`, [{ name: '规费记录列表', rows }])
  message.success('导出成功')
}

function formatAmount(value?: number) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}

function formatMonthlyAmount(value?: number | string) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatVehicleNo(plateNo?: string, trailerNo?: string, separator = '\n') {
  return [plateNo, trailerNo].map(item => String(item || '').trim()).filter(Boolean).join(separator) || '-'
}

function statusColor(status: RegulatoryFeeStatus) {
  const colorMap: Record<RegulatoryFeeStatus, string> = {
    未开始: 'blue',
    生效中: 'green',
    已截止: 'default',
    停用: 'red',
  }
  return colorMap[status]
}

function approvalStatusColor(status?: string) {
  const colorMap: Record<string, string> = {
    草稿: 'default',
    审批中: 'processing',
    已确认: 'success',
    已驳回: 'error',
    已撤回: 'warning',
  }
  return colorMap[status || '草稿'] || 'default'
}

function splitOverviewDates(value?: string) {
  return String(value || '').split('\n').map(item => item.trim()).filter(Boolean)
}

function formatOverviewDate(value: string) {
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD') : value
}

function overviewDateClass(value?: string) {
  const diff = dayjs(value).startOf('day').diff(dayjs().startOf('day'), 'day')
  return diff >= 0 && diff <= 30 ? 'fee-date fee-date-danger' : 'fee-date'
}

function isUpcomingOverviewDate(value?: string) {
  return filterUpcomingOverviewDates(value) !== undefined
}

function filterUpcomingOverviewDates(value?: string) {
  const upcomingDates = splitOverviewDates(value).filter((item) => {
    const diff = dayjs(item).startOf('day').diff(dayjs().startOf('day'), 'day')
    return diff >= 0 && diff <= 30
  })
  return upcomingDates.length ? upcomingDates.join('\n') : undefined
}

function disabledEndDate(current: Dayjs) {
  const start = formData.value.dateRange?.[0]
  return !!start && current.isBefore(start, 'day')
}

function normalizePlateNo(value?: string) {
  return String(value || '').split('\n')[0]?.trim() || ''
}

function normalizePlateKey(value?: string) {
  return String(value || '').replace(/[.．。·\s]/g, '').toUpperCase()
}

function getBaseVehicleArea(plateNo?: string) {
  const value = normalizePlateNo(plateNo)
  if (!value)
    return ''
  return qinghaiVehiclePlateSet.has(value) ? '青海' : '陕西'
}

function handleVehicleChange(plateNo: unknown) {
  const value = Array.isArray(plateNo) ? plateNo[0] : plateNo
  const vehicle = transportVehicleOptions.find(item => item.plateNo === String(value || ''))
  formData.value.trailerNo = vehicle?.trailerNo || ''
  formData.value.area = getBaseVehicleArea(String(value || ''))
}

function validateTotalAmount() {
  if (Number(formData.value.totalAmount) < 0)
    return Promise.reject(new Error('单项总费用必须大于等于 0'))
  return Promise.resolve()
}

function validateDateRange() {
  const [start, end] = formData.value.dateRange || []
  if (!start || !end)
    return Promise.reject(new Error('请选择有效期'))
  if (end.isBefore(start, 'day'))
    return Promise.reject(new Error('截止日期不能早于开始日期'))
  if (calculateValidMonths(start, end) <= 0)
    return Promise.reject(new Error('有效时长不能为 0'))
  return Promise.resolve()
}

onMounted(async () => {
  await businessDictionaries.load()
  queryModel.plateNo = typeof route.query.plateNo === 'string' ? route.query.plateNo : undefined
  queryModel.feeType = typeof route.query.feeType === 'string' ? route.query.feeType : undefined
  activeTab.value = ['records', 'attachments'].includes(String(route.query.tab)) ? String(route.query.tab) : 'overview'
  await query()
  loadOverview()
  loadRecordSummary()
  loadAttachments()

  const recordId = typeof route.query.recordId === 'string' ? route.query.recordId : ''
  const record = state.dataSource.find(item => String(item.id) === recordId)
  if (record)
    handleView(record)

  if (route.query.action === 'create') {
    handleAdd()
  }
})
</script>

<template>
  <page-container class="regulatory-fee-page">
    <SummaryCards :cards="summaryCards" :loading="overviewLoading || state.loading" compact />
    <RegulatoryFeeInsights :rows="linkedRecordRows" />

    <div class="fee-type-grid">
      <div v-for="item in recordSummary.typeAmounts" :key="item.feeType" class="fee-type-col">
        <a-card
          class="fee-type-card fee-type-card-action"
          :bordered="false"
          :loading="state.loading"
          role="button"
          tabindex="0"
          :aria-label="`查看${item.feeType}具体明细`"
          @click="openFeeTypeDetail(item.feeType)"
          @keydown.enter.prevent="openFeeTypeDetail(item.feeType)"
          @keydown.space.prevent="openFeeTypeDetail(item.feeType)"
        >
          <div class="fee-type-name">
            {{ item.feeType }}
          </div>
          <div class="fee-type-label">
            月均摊费用
          </div>
          <div class="fee-type-amount">
            {{ formatMonthlyAmount(item.amount) }}
          </div>
          <div class="fee-type-count">
            {{ item.count }} 条生效
          </div>
        </a-card>
      </div>
    </div>

    <a-card class="fee-tabs-card" :bordered="false">
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="overview" tab="规费一览表">
          <div class="tab-panel">
            <div class="toolbar-panel">
              <div class="toolbar-fields">
                <span class="toolbar-label">搜索车牌号</span>
                <a-input
                  v-model:value="queryModel.plateNo"
                  allow-clear
                  class="toolbar-search"
                  placeholder="输入车牌号搜索..."
                  @press-enter="handleQuery"
                />
                <a-checkbox v-model:checked="queryModel.upcomingOnly" @change="loadOverview">
                  只看临近到期
                </a-checkbox>
              </div>
              <a-space class="toolbar-actions" wrap>
                <a-button @click="handleTemplate">
                  模板
                </a-button>
                <a-upload :show-upload-list="false" accept=".xlsx,.xls" :before-upload="handleImport">
                  <a-button>导入</a-button>
                </a-upload>
                <a-button @click="handleOverviewExport">
                  导出
                </a-button>
              </a-space>
            </div>

            <div class="table-panel">
              <a-table
                class="overview-table"
                row-key="id"
                :loading="overviewLoading"
                :columns="overviewTableColumns"
                :data-source="linkedOverviewRows"
                :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
                table-layout="fixed"
              >
                <template #bodyCell="{ column, record, text }">
                  <template v-if="column.dataIndex === 'plateNo'">
                    <div class="plate-cell">
                      <div class="plate-main">
                        {{ String(text || '').split('\n')[0] || '-' }}
                      </div>
                      <div v-if="String(text || '').split('\n')[1]" class="plate-trailer">
                        {{ String(text || '').split('\n')[1] }}
                      </div>
                    </div>
                  </template>
                  <template v-else-if="!['id', 'area', 'plateNo'].includes(String(column.dataIndex))">
                    <a-tooltip v-if="text" :title="splitOverviewDates(String(text)).join(' / ')">
                      <div class="fee-date-stack">
                        <span v-for="date in splitOverviewDates(String(text))" :key="date" :class="overviewDateClass(date)">
                          {{ formatOverviewDate(date) }}
                        </span>
                      </div>
                    </a-tooltip>
                    <span v-else c="var(--text-color-secondary)">-</span>
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
          </div>
        </a-tab-pane>

        <a-tab-pane key="records" tab="规费记录列表">
          <div class="tab-panel">
            <div class="filter-panel">
              <a-form class="regulatory-fee-query" :model="queryModel" layout="vertical">
                <a-row :gutter="[16, 16]" align="bottom">
                  <a-col :xs="24" :sm="12" :lg="8" :xl="4">
                    <a-form-item label="车号">
                      <a-input v-model:value="queryModel.plateNo" allow-clear placeholder="请输入车号" />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :sm="12" :lg="8" :xl="4">
                    <a-form-item label="挂号">
                      <a-input v-model:value="queryModel.trailerNo" allow-clear placeholder="请输入挂号" />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :sm="12" :lg="8" :xl="3">
                    <a-form-item label="财务年">
                      <a-select v-model:value="queryModel.financialYear" allow-clear placeholder="请选择财务年" :options="financialYearOptions" />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :sm="12" :lg="8" :xl="3">
                    <a-form-item label="财务月">
                      <a-select v-model:value="queryModel.financialMonth" allow-clear :disabled="!queryModel.financialYear" placeholder="请选择财务月" :options="financialMonthOptions" />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :sm="12" :lg="8" :xl="4">
                    <a-form-item label="规费类型">
                      <a-select v-model:value="queryModel.feeType" allow-clear placeholder="请选择规费类型" :options="regulatoryFeeTypeOptions" />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :sm="12" :lg="8" :xl="3">
                    <a-form-item label="状态">
                      <a-select v-model:value="queryModel.status" allow-clear placeholder="请选择状态">
                        <a-select-option v-for="item in statusOptions" :key="item" :value="item">
                          {{ item }}
                        </a-select-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :sm="12" :lg="8" :xl="3">
                    <a-form-item class="query-actions">
                      <a-space>
                        <a-button :loading="state.loading" type="primary" @click="handleQuery">
                          查询
                        </a-button>
                        <a-button :loading="state.loading" @click="handleReset">
                          重置
                        </a-button>
                      </a-space>
                    </a-form-item>
                  </a-col>
                </a-row>
              </a-form>
            </div>

            <div class="table-panel">
              <div class="table-panel-header">
                <div>
                  <div class="table-title">
                    规费记录列表
                  </div>
                  <div class="table-subtitle">
                    维护规费有效期、摊销金额和审批状态
                  </div>
                </div>
                <a-space>
                  <a-button @click="handleTemplate">
                    模板
                  </a-button>
                  <a-upload :show-upload-list="false" accept=".xlsx,.xls" :before-upload="handleImport">
                    <a-button>
                      <template #icon>
                        <UploadOutlined />
                      </template>
                      导入
                    </a-button>
                  </a-upload>
                  <a-button @click="handleExport">
                    <template #icon>
                      <DownloadOutlined />
                    </template>
                    导出
                  </a-button>
                  <a-button type="primary" @click="handleAdd">
                    <template #icon>
                      <PlusOutlined />
                    </template>
                    新增
                  </a-button>
                </a-space>
              </div>
              <a-table
                row-key="id"
                :loading="state.loading"
                :columns="recordTableColumns"
                :data-source="linkedRecordRows"
                :pagination="state.pagination"
                :scroll="{ x: recordTableScrollX }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'vehicleNo'">
                    <div class="vehicle-number-cell">
                      <span class="vehicle-number-main">{{ record.plateNo || '-' }}</span>
                      <span v-if="record.trailerNo" class="vehicle-number-trailer">{{ record.trailerNo }}</span>
                    </div>
                  </template>
                  <template v-else-if="column.dataIndex === 'totalAmount'">
                    {{ formatAmount(record.totalAmount) }}
                  </template>
                  <template v-else-if="column.dataIndex === 'monthlyAmortizedAmount'">
                    {{ formatMonthlyAmount(record.monthlyAmortizedAmount) }}
                  </template>
                  <template v-else-if="column.dataIndex === 'status'">
                    <a-tag :color="statusColor(record.status)">
                      {{ record.status }}
                    </a-tag>
                  </template>
                  <template v-else-if="column.dataIndex === 'approvalStatus'">
                    <a-tag :color="approvalStatusColor(record.approvalStatus)">
                      {{ record.approvalStatus || '草稿' }}
                    </a-tag>
                  </template>
                  <template v-else-if="column.dataIndex === 'action'">
                    <RecordActions :actions="getRecordActions(record)" />
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
          </div>
        </a-tab-pane>

        <a-tab-pane key="attachments" tab="规费附件管理">
          <div class="tab-panel">
            <div class="table-panel">
              <div class="table-panel-header">
                <div>
                  <div class="table-title">
                    规费附件管理
                  </div>
                  <div class="table-subtitle">
                    附件按规费类型归类，可通过车号快速定位原始凭证
                  </div>
                </div>
              </div>
              <a-table
                row-key="id"
                :loading="attachmentsLoading"
                :data-source="attachmentRows"
                :pagination="false"
                :columns="[
                  { title: '规费分类', dataIndex: 'feeType', width: 140 },
                  { title: '车号 / 挂号', dataIndex: 'vehicleNo', width: 170 },
                  { title: '有效期', dataIndex: 'validity', width: 220 },
                  { title: '附件', dataIndex: 'attachmentName' },
                ]"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'vehicleNo'">
                    {{ formatVehicleNo(record.plateNo, record.trailerNo, ' / ') }}
                  </template>
                  <template v-else-if="column.dataIndex === 'validity'">
                    {{ record.validStartDate }} 至 {{ record.validEndDate }}
                  </template>
                  <template v-else-if="column.dataIndex === 'attachmentName'">
                    <a :href="record.attachmentUrl" target="_blank" rel="noopener" class="attachment-link">
                      <FileOutlined />{{ record.attachmentName }}
                    </a>
                  </template>
                </template>
                <template #emptyText>
                  <a-empty description="暂无规费附件" />
                </template>
              </a-table>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <a-modal
      v-model:open="modalOpen"
      :title="isUpdate ? '编辑规费' : '新增规费'"
      :confirm-loading="submitting"
      width="680px"
      :mask-closable="false"
      :closable="!submitting"
      :keyboard="!submitting"
      :cancel-button-props="{ disabled: submitting }"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="formData" :rules="formRules" :label-col="{ style: { width: '130px' } }">
        <div class="fee-form-group-title">
          规费与车辆
        </div>
        <a-form-item name="feeType" label="规费类型">
          <a-select v-model:value="formData.feeType" placeholder="请选择规费类型" :options="regulatoryFeeTypeOptions" />
        </a-form-item>
        <a-form-item name="plateNo" label="车号">
          <a-select
            v-model:value="formData.plateNo"
            show-search
            allow-clear
            placeholder="请选择基础资料车辆"
            :options="vehicleSelectOptions"
            :filter-option="(input: string, option: any) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())"
            @change="handleVehicleChange"
          />
        </a-form-item>
        <a-form-item name="trailerNo" label="挂号">
          <a-input v-model:value="formData.trailerNo" :maxlength="50" placeholder="选择车号后自动带出挂号" />
        </a-form-item>
        <a-form-item name="area" label="所在区域">
          <a-input v-model:value="formData.area" :maxlength="50" placeholder="选择车号后自动带出" readonly />
        </a-form-item>
        <div class="fee-form-group-title">
          有效期与金额
        </div>
        <a-form-item name="totalAmount" label="单项总费用">
          <business-input-number v-model:value="formData.totalAmount" class="w-full" :min="0" :precision="2" placeholder="请输入金额" />
        </a-form-item>
        <a-form-item name="dateRange" label="有效期">
          <a-range-picker v-model:value="formData.dateRange" class="w-full" :disabled-date="disabledEndDate" />
        </a-form-item>
        <a-form-item label="自动计算">
          <div class="calculation-grid">
            <div class="calculation-item">
              <a-statistic title="有效时长" :value="calculatedValidMonths" suffix="个月" />
            </div>
            <div class="calculation-item">
              <a-statistic title="月均摊费用" :value="calculatedMonthlyAmount" prefix="¥" />
            </div>
          </div>
        </a-form-item>
        <a-form-item name="remark" label="备注">
          <a-textarea v-model:value="formData.remark" show-count :maxlength="500" placeholder="请输入备注" />
        </a-form-item>
        <div class="fee-form-group-title">
          附件凭证
        </div>
        <a-form-item label="附件">
          <div class="attachment-field">
            <a-upload
              :show-upload-list="false"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              :before-upload="uploadFeeAttachment"
            >
              <a-button :loading="attachmentUploading">
                <template #icon>
                  <UploadOutlined />
                </template>
                {{ formData.attachmentName ? '重新上传' : '上传附件' }}
              </a-button>
            </a-upload>
            <a v-if="formData.attachmentUrl" :href="formData.attachmentUrl" target="_blank" rel="noopener" class="attachment-link">
              <FileOutlined />{{ formData.attachmentName }}
            </a>
            <span v-else class="attachment-hint">支持图片、PDF、Office 文件，保存后自动归入规费附件管理</span>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
    <a-modal
      v-model:open="importModalOpen"
      title="规费记录导入确认"
      width="920px"
      :confirm-loading="importSubmitting"
      :mask-closable="!importSubmitting"
      :closable="!importSubmitting"
      :keyboard="!importSubmitting"
      :cancel-button-props="{ disabled: importSubmitting }"
      :ok-button-props="{ disabled: importErrors.length > 0 || importRecords.length === 0 }"
      ok-text="确认导入"
      @ok="confirmImport"
    >
      <a-alert
        v-if="importErrors.length"
        type="error"
        show-icon
        :message="`发现 ${importErrors.length} 行错误，请修正后重新导入`"
        class="mb-4"
      >
        <template #description>
          <div v-for="error in importErrors.slice(0, 10)" :key="error">
            {{ error }}
          </div>
          <div v-if="importErrors.length > 10">
            其余 {{ importErrors.length - 10 }} 条错误未展开
          </div>
        </template>
      </a-alert>
      <a-descriptions size="small" :column="2" class="mb-4">
        <a-descriptions-item label="文件">
          {{ importFileName }}
        </a-descriptions-item>
        <a-descriptions-item label="有效记录">
          {{ importRecords.length }} 条
        </a-descriptions-item>
      </a-descriptions>
      <a-table
        size="small"
        row-key="rowNumber"
        :data-source="importRecords"
        :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true }"
        :scroll="{ x: 850 }"
        :columns="[
          { title: 'Excel 行', dataIndex: 'rowNumber', width: 85 },
          { title: '规费类型', dataIndex: 'feeType', width: 130 },
          { title: '车号 / 挂号', dataIndex: 'vehicleNo', width: 150, customRender: ({ record }: any) => formatVehicleNo(record.plateNo, record.trailerNo, ' / ') },
          { title: '所在区域', dataIndex: 'area', width: 100 },
          { title: '单项总费用', dataIndex: 'totalAmount', width: 120 },
          { title: '开始日期', dataIndex: 'validStartDate', width: 120 },
          { title: '截止日期', dataIndex: 'validEndDate', width: 120 },
        ]"
      />
    </a-modal>
    <BusinessDetailDrawer
      v-model:open="detailOpen"
      :title="detailRecord?.feeName || '规费详情'"
      :subtitle="detailRecord ? formatVehicleNo(detailRecord.plateNo, detailRecord.trailerNo, ' / ') : ''"
      :status="detailRecord?.status"
      :status-color="detailRecord ? statusColor(detailRecord.status) : 'default'"
      :width="680"
    >
      <a-descriptions v-if="detailRecord" title="规费信息" bordered :column="2" size="small">
        <a-descriptions-item label="规费类型">
          {{ detailRecord.feeType }}
        </a-descriptions-item>
        <a-descriptions-item label="车号 / 挂号">
          <div class="vehicle-number-cell">
            <span class="vehicle-number-main">{{ detailRecord.plateNo || '-' }}</span>
            <span v-if="detailRecord.trailerNo" class="vehicle-number-trailer">{{ detailRecord.trailerNo }}</span>
          </div>
        </a-descriptions-item>
        <a-descriptions-item label="所在区域">
          {{ getBaseVehicleArea(detailRecord.plateNo) || detailRecord.area || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="月均摊费用">
          {{ formatMonthlyAmount(detailRecord.monthlyAmortizedAmount) }}
        </a-descriptions-item>
        <a-descriptions-item label="总金额">
          {{ formatAmount(detailRecord.totalAmount) }}
        </a-descriptions-item>
        <a-descriptions-item label="有效期">
          {{ detailRecord.validStartDate }} 至 {{ detailRecord.validEndDate }}
        </a-descriptions-item>
        <a-descriptions-item label="有效时长">
          {{ detailRecord.validMonths }} 个月
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="statusColor(detailRecord.status)">
            {{ detailRecord.status }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="审批状态">
          <a-tag :color="approvalStatusColor(detailRecord.approvalStatus)">
            {{ detailRecord.approvalStatus || '草稿' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="备注" :span="2">
          {{ detailRecord.remark || '-' }}
        </a-descriptions-item>
      </a-descriptions>
      <template v-if="detailRecord" #footer>
        <a-button @click="detailOpen = false">
          关闭
        </a-button>
        <a-button v-if="canEditRecord(detailRecord).allowed" type="primary" @click="editDetailRecord">
          编辑规费
        </a-button>
      </template>
    </BusinessDetailDrawer>
    <a-modal
      v-model:open="feeTypeDetailOpen"
      :title="`${feeTypeDetailName}明细`"
      :footer="null"
      width="1000px"
    >
      <a-table
        size="small"
        row-key="id"
        :loading="feeTypeDetailLoading"
        :columns="feeTypeDetailColumns"
        :data-source="feeTypeDetailRows"
        :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
        :scroll="{ x: 1100 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'vehicleNo'">
            <div class="vehicle-number-cell">
              <span class="vehicle-number-main">{{ record.plateNo || '-' }}</span>
              <span v-if="record.trailerNo" class="vehicle-number-trailer">{{ record.trailerNo }}</span>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'totalAmount'">
            {{ formatMonthlyAmount(record.totalAmount) }}
          </template>
          <template v-else-if="column.dataIndex === 'monthlyAmortizedAmount'">
            {{ formatMonthlyAmount(record.monthlyAmortizedAmount) }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor(record.status)">
              {{ record.status }}
            </a-tag>
          </template>
        </template>
      </a-table>
    </a-modal>
  </page-container>
</template>

<style lang="less" scoped>
.fee-form-group-title {
  margin: 4px 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--admin-border-subtle);
  color: var(--admin-text);
  font-size: 14px;
  font-weight: 650;
}
.regulatory-fee-page {
  :deep(.ant-page-header-heading-title) {
    color: #172033;
  }
}

.vehicle-number-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  line-height: 1.35;
}

.vehicle-number-main {
  color: #172033;
  font-weight: 600;
}

.vehicle-number-trailer {
  color: #64748b;
  font-size: 12px;
}

.summary-grid {
  margin-bottom: 16px;
}

.fee-type-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.fee-type-col {
  min-width: 0;
}

.fee-type-card-action {
  cursor: pointer;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;

  &:hover {
    border-color: rgb(22 119 255 / 35%);
    box-shadow: 0 4px 8px rgb(15 23 42 / 8%);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid #1677ff;
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fee-type-card-action {
    transition: none;
  }
}

.regulatory-fee-query {
  :deep(.ant-form-item) {
    margin-bottom: 0;
  }

  :deep(.ant-picker),
  :deep(.ant-input),
  :deep(.ant-select) {
    width: 100%;
  }
}

.overview-card {
  height: 100%;
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 8px;
  background: #fff;

  :deep(.ant-card-body) {
    min-height: 132px;
    padding: 20px 24px;
  }
}

.overview-card-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.overview-label {
  color: #475569;
  font-size: 14px;
  font-weight: 600;
}

.overview-value {
  margin-top: 12px;
  color: #172033;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.overview-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 8px;
  background: #eef5ff;
  color: #1677ff;
  font-size: 16px;
  font-weight: 700;

  &.amount {
    background: #f0fbf7;
    color: #16a36f;
  }

  &.approval {
    background: #fff7e6;
    color: #b76e00;
  }

  &.used {
    background: #f4f0ff;
    color: #6250c4;
  }
}

.overview-hint {
  margin-top: 10px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.45;
}

.fee-type-card {
  height: 100%;
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 8px;
  background: #fff;

  :deep(.ant-card-body) {
    min-height: 82px;
    padding: 10px 6px;
    text-align: center;
  }
}

.fee-type-name {
  overflow: hidden;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fee-type-amount {
  margin-top: 4px;
  color: #172033;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.fee-type-label {
  margin-top: 5px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.2;
}

.fee-type-count {
  margin-top: 5px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
}

.fee-tabs-card {
  overflow: hidden;
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 8px;

  :deep(.ant-card-body) {
    padding: 0;
  }

  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
    padding: 0 16px;
    border-bottom: 1px solid rgb(15 23 42 / 8%);
    background: #fbfcfe;
  }

  :deep(.ant-tabs-content-holder) {
    background: #fff;
  }
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.toolbar-panel,
.filter-panel,
.table-panel,
.empty-panel {
  border-color: rgb(15 23 42 / 8%);
  border-radius: 8px;
  background: #fff;
}

.attachment-field {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.attachment-link {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  color: #1677ff;
  overflow-wrap: anywhere;
}

.attachment-hint {
  color: #64748b;
  font-size: 13px;
}

.toolbar-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid rgb(15 23 42 / 8%);
}

.toolbar-fields {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-search {
  width: min(280px, 100%);
}

.toolbar-actions {
  flex: 0 0 auto;
}

.toolbar-label {
  color: #475569;
  font-weight: 600;
}

.filter-panel {
  padding: 16px;
  border: 1px solid rgb(15 23 42 / 8%);
}

.table-panel {
  overflow: hidden;
  border: 1px solid rgb(15 23 42 / 8%);

  :deep(.ant-table-wrapper) {
    overflow: hidden;
  }

  :deep(.ant-table-thead > tr > th) {
    background: #f8fafc;
    color: #334155;
    font-weight: 600;
    text-align: center;
  }

  :deep(.ant-table-tbody > tr > td) {
    vertical-align: middle;
    text-align: center;
  }

  :deep(.ant-pagination) {
    margin: 16px;
  }
}

.overview-table {
  :deep(.ant-table) {
    width: 100%;
    font-size: 12px;
  }

  :deep(.ant-table-container),
  :deep(.ant-table-content),
  :deep(table) {
    width: 100% !important;
  }

  :deep(.ant-table-thead > tr > th),
  :deep(.ant-table-tbody > tr > td) {
    overflow: hidden;
    padding: 10px 4px;
  }

  :deep(.ant-table-thead > tr > th) {
    line-height: 1.25;
    white-space: normal;
    word-break: break-all;
  }
}

.table-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid rgb(15 23 42 / 8%);
  background: #fff;
}

.table-title {
  color: #172033;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
}

.table-subtitle {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.4;
}

.fee-date {
  color: #138a5c;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
  white-space: nowrap;
}

.fee-date-stack {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.35;
}

.fee-date-danger {
  color: #cf1322;
  font-weight: 700;
}

.plate-cell {
  min-width: 0;
  line-height: 1.35;
}

.plate-main {
  color: #172033;
  font-weight: 700;
}

.plate-trailer {
  margin-top: 2px;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.calculation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.calculation-item {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 8px;
  background: #f8fafc;
}

.empty-panel {
  display: flex;
  min-height: 220px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(15 23 42 / 8%);
}

.action-disabled {
  color: rgb(0 0 0 / 35%);
}

@media (max-width: 768px) {
  .fee-type-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-table {
    :deep(.ant-table) {
      font-size: 10px;
    }

    :deep(.ant-table-thead > tr > th),
    :deep(.ant-table-tbody > tr > td) {
      padding: 8px 2px;
    }

    .fee-date {
      font-size: 8px;
    }
  }

  .overview-card {
    :deep(.ant-card-body) {
      min-height: auto;
      padding: 18px;
    }
  }

  .toolbar-panel,
  .table-panel-header {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar-actions {
    width: 100%;
  }

  .calculation-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 769px) and (max-width: 1200px) {
  .fee-type-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>

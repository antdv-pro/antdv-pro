<script setup lang="ts">
import type { OfficeVehicle, OfficeVehicleDetail, OfficeVehicleExpense, OfficeVehicleInsurance, OfficeVehicleLicense, OfficeVehicleQuery, OfficeVehicleSummary } from '~@/api/office-vehicle'
import type { RecordActionItem } from '~@/components/record-actions/index.vue'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import {
  changeOfficeVehicleExpenseStatusApi,
  deleteOfficeVehicleApi,
  deleteOfficeVehicleExpenseApi,
  deleteOfficeVehicleLicenseApi,
  exportOfficeVehicleExpensesApi,
  getOfficeVehicleDetailApi,
  getOfficeVehicleExpenseListApi,
  getOfficeVehicleInsuranceListApi,
  getOfficeVehicleLicenseListApi,
  getOfficeVehicleListApi,
  getOfficeVehicleSummaryApi,
  saveOfficeVehicleApi,
  saveOfficeVehicleExpenseApi,
  saveOfficeVehicleInsuranceApi,
  saveOfficeVehicleLicenseApi,
  submitOfficeVehicleExpenseApprovalApi,
} from '~@/api/office-vehicle'
import FinancialPeriodFilter from '~@/components/financial-period-filter/index.vue'
import RecordActions from '~@/components/record-actions/index.vue'
import { useBusinessDictionaries } from '~@/composables/business-dictionaries'
import { useFinancialPeriodFilter } from '~@/composables/financial-period-filter'
import { useRecordPermission } from '~@/composables/record-permission'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { downloadWorkbook } from '~@/utils/xlsx-export'
import OfficeVehicleBatchModal from './components/office-vehicle-batch-modal.vue'

type SectionKey = 'vehicles' | 'expenses' | 'licenses' | 'insurances'
type ModalType = 'vehicle' | 'expense' | 'license' | 'insurance'
type ContentTab = 'vehicles' | 'expenses'

const message = useMessage()
const businessDictionaries = useBusinessDictionaries()
const route = useRoute()
const { canEditRecord, canDeleteRecord, canAuditRecord } = useRecordPermission()
const loading = ref(false)
const errorMessage = ref('')
const { model: financialPeriodFilter, queryParams, resetFinancialPeriodFilter } = useFinancialPeriodFilter()

const vehicleRows = ref<OfficeVehicle[]>([])
const expenseRows = ref<OfficeVehicleExpense[]>([])
const licenseRows = ref<OfficeVehicleLicense[]>([])
const insuranceRows = ref<OfficeVehicleInsurance[]>([])
const summary = ref<OfficeVehicleSummary>()
const detail = ref<OfficeVehicleDetail>()
const detailOpen = ref(false)
const editOpen = ref(false)
const editSaving = ref(false)
const batchOpen = ref(false)
const batchVehicle = ref<OfficeVehicle>()
const modalType = ref<ModalType>('vehicle')
const activeContentTab = ref<ContentTab>('vehicles')
const editing = ref<Record<string, any>>({})

const pagination = reactive({ current: 1, pageSize: 10, total: 0 })
const queryModel = reactive({
  plateNo: '',
  vehicleId: undefined as string | undefined,
  expenseType: undefined as string | undefined,
  licenseType: undefined as string | undefined,
  insuranceType: undefined as string | undefined,
  departmentName: undefined as string | undefined,
  status: undefined as string | undefined,
})

const expenseTypeOptions = computed(() => businessDictionaries.options('office_vehicle_expense_type'))
const licenseTypeOptions = computed(() => businessDictionaries.options('office_vehicle_license_type'))
const paymentMethodOptions = computed(() => businessDictionaries.options('office_vehicle_payment_method'))
const vehicleStatuses = ['正常', '停用', '维修中', '已出售']
const expenseStatuses = ['草稿', '待审批', '审批中', '已确认', '已驳回', '已撤回']
const dueStatuses = ['有效', '即将到期', '已过期']
const attachmentAccept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv'
const vehicleOptions = computed(() => vehicleRows.value.map(item => ({ label: `${item.plateNo} / ${item.brandModel}`, value: item.id! })))
const availableMonthKeys = computed(() => [...new Set(expenseRows.value.map(item => dayjs(item.occurredDate).format('YYYYMM')))])

const summaryCards = computed(() => [
  { label: '车辆数量', value: summary.value?.vehicleCount ?? 0, hint: '当前权限范围', tone: 'primary' },
  { label: '本月费用', value: money(summary.value?.monthExpense), hint: '费用台账合计', tone: 'danger' },
  { label: '审批总金额', value: money(summary.value?.approvalTotalAmount), hint: '待审批/审批中/已确认', tone: 'primary' },
  { label: '使用金额', value: money(summary.value?.usedAmount), hint: '已确认计入运营数据', tone: 'success' },
  { label: '即将到期', value: summary.value?.upcomingReminderCount ?? 0, hint: '证照与保险', tag: '30天内', tone: 'warning' },
  { label: '已过期', value: summary.value?.expiredReminderCount ?? 0, hint: '证照与保险', tone: 'danger' },
  { label: '已确认费用', value: money(summary.value?.confirmedExpense), hint: '财务可追溯', tone: 'success' },
  { label: '待审批费用', value: summary.value?.pendingExpenseCount ?? 0, hint: '已接入 OA 审批', tone: 'warning' },
])

const expenseColumns = [
  { title: '车辆', dataIndex: 'plateNo', width: 120 },
  { title: '费用类型', dataIndex: 'expenseType', width: 110 },
  { title: '费用金额', dataIndex: 'amount', width: 120 },
  { title: '发生日期', dataIndex: 'occurredDate', width: 120 },
  { title: '经办人', dataIndex: 'handlerName', width: 100 },
  { title: '所属部门', dataIndex: 'departmentName', width: 120 },
  { title: '支付方式', dataIndex: 'paymentMethod', width: 110 },
  { title: '发票号', dataIndex: 'invoiceNo', width: 140 },
  { title: '票据附件', dataIndex: 'attachmentName', width: 160 },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 110 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 200 },
]
const licenseColumns = [
  { title: '车辆', dataIndex: 'plateNo', width: 120 },
  { title: '证照类型', dataIndex: 'licenseType', width: 120 },
  { title: '证照编号', dataIndex: 'licenseNo', width: 150 },
  { title: '发证日期', dataIndex: 'issueDate', width: 120 },
  { title: '到期日期', dataIndex: 'expiryDate', width: 120 },
  { title: '发证机关', dataIndex: 'issuingAuthority', width: 180 },
  { title: '附件', dataIndex: 'attachmentName', width: 160 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 170 },
]
const insuranceColumns = [
  { title: '车辆', dataIndex: 'plateNo', width: 120 },
  { title: '保险类型', dataIndex: 'insuranceType', width: 120 },
  { title: '保单号', dataIndex: 'policyNo', width: 150 },
  { title: '保险公司', dataIndex: 'insurer', width: 140 },
  { title: '保费', dataIndex: 'amount', width: 120 },
  { title: '开始日期', dataIndex: 'startDate', width: 120 },
  { title: '到期日期', dataIndex: 'endDate', width: 120 },
  { title: '附件', dataIndex: 'attachmentName', width: 160 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 150 },
]
const vehicleSummaryColumns = [
  { title: '车辆', dataIndex: 'vehicleInfo', width: 190, fixed: 'left' as const },
  { title: '归属信息', dataIndex: 'ownership', width: 170 },
  { title: '证照', dataIndex: 'licenseOverview', width: 190 },
  { title: '保险', dataIndex: 'insuranceOverview', width: 190 },
  { title: '车辆状态', dataIndex: 'status', width: 100 },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 190 },
]
const vehicleSummaryScrollX = computed(() => createBusinessTableScrollX(vehicleSummaryColumns, 1180))

const vehicleSummaryRows = computed(() => vehicleRows.value.map((vehicle) => {
  const expenses = expenseRows.value.filter(item => item.vehicleId === vehicle.id)
  const licenses = licenseRows.value.filter(item => item.vehicleId === vehicle.id)
  const insurances = insuranceRows.value.filter(item => item.vehicleId === vehicle.id)
  return {
    ...vehicle,
    expenses,
    licenses,
    insurances,
    nearestLicense: [...licenses].filter(item => item.expiryDate).sort((a, b) => dayjs(a.expiryDate).valueOf() - dayjs(b.expiryDate).valueOf())[0],
    nearestInsurance: [...insurances].filter(item => item.endDate).sort((a, b) => dayjs(a.endDate).valueOf() - dayjs(b.endDate).valueOf())[0],
  }
}))

const filteredVehicleSummaryRows = computed(() => vehicleSummaryRows.value.filter((row) => {
  if (queryModel.expenseType && !row.expenses.some(item => item.expenseType === queryModel.expenseType))
    return false
  if (queryModel.licenseType && !row.licenses.some(item => item.licenseType === queryModel.licenseType))
    return false
  if (queryModel.insuranceType && !row.insurances.some(item => item.insuranceType === queryModel.insuranceType))
    return false
  if (queryModel.status) {
    const matchesStatus = row.status === queryModel.status
      || row.expenses.some(item => item.approvalStatus === queryModel.status)
      || row.licenses.some(item => item.status === queryModel.status)
      || row.insurances.some(item => item.status === queryModel.status)
    if (!matchesStatus)
      return false
  }
  return true
}))

const filteredExpenseRows = computed(() => expenseRows.value.filter((row) => {
  if (queryModel.expenseType && row.expenseType !== queryModel.expenseType)
    return false
  if (queryModel.status && expenseStatuses.includes(queryModel.status) && row.approvalStatus !== queryModel.status)
    return false
  return true
}))
const filteredExpenseAmount = computed(() => filteredExpenseRows.value.reduce((total, row) => total + Number(row.amount || 0), 0))

const detailExpenseColumns = computed(() => enhanceBusinessTableColumns(expenseColumns))
const detailLicenseColumns = computed(() => enhanceBusinessTableColumns(licenseColumns))
const detailInsuranceColumns = computed(() => enhanceBusinessTableColumns(insuranceColumns))
const detailExpenseScrollX = computed(() => createBusinessTableScrollX(detailExpenseColumns.value, 1200))
const detailLicenseScrollX = computed(() => createBusinessTableScrollX(detailLicenseColumns.value, 1100))
const detailInsuranceScrollX = computed(() => createBusinessTableScrollX(detailInsuranceColumns.value, 1100))

onMounted(async () => {
  await businessDictionaries.load()
  queryModel.plateNo = typeof route.query.plateNo === 'string' ? route.query.plateNo : ''
  queryModel.licenseType = typeof route.query.licenseType === 'string' ? route.query.licenseType : undefined
  queryModel.insuranceType = typeof route.query.insuranceType === 'string' ? route.query.insuranceType : undefined
  loadAll()
})

function money(value?: number) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildQuery(): OfficeVehicleQuery {
  return {
    current: pagination.current,
    pageSize: pagination.pageSize,
    plateNo: queryModel.plateNo || undefined,
    vehicleId: queryModel.vehicleId,
    departmentName: queryModel.departmentName,
    ...queryParams.value,
  }
}

function buildExpenseQuery(): OfficeVehicleQuery {
  return {
    ...buildQuery(),
    expenseType: queryModel.expenseType,
    status: expenseStatuses.includes(queryModel.status || '') ? queryModel.status : undefined,
  }
}

async function loadAll() {
  await loadList()
}

async function loadVehiclesForOptions() {
  try {
    const { data } = await getOfficeVehicleListApi({ current: 1, pageSize: 1000 })
    vehicleRows.value = data?.records || []
  }
  catch (error: any) {
    errorMessage.value = error?.message || '车辆数据加载失败'
    throw error
  }
}

async function loadList() {
  loading.value = true
  errorMessage.value = ''
  try {
    const query = { ...buildQuery(), current: 1, pageSize: 1000 }
    const [summaryResult, vehicleResult, expenseResult, licenseResult, insuranceResult] = await Promise.all([
      getOfficeVehicleSummaryApi(buildQuery()),
      getOfficeVehicleListApi(query),
      getOfficeVehicleExpenseListApi({ ...buildExpenseQuery(), current: 1, pageSize: 1000 }),
      getOfficeVehicleLicenseListApi({ ...query, licenseType: queryModel.licenseType }),
      getOfficeVehicleInsuranceListApi({ ...query, insuranceType: queryModel.insuranceType }),
    ])
    summary.value = summaryResult.data
    vehicleRows.value = vehicleResult.data?.records || []
    expenseRows.value = expenseResult.data?.records || []
    licenseRows.value = licenseResult.data?.records || []
    insuranceRows.value = insuranceResult.data?.records || []
    pagination.total = Math.max(
      vehicleResult.data?.total || 0,
      expenseResult.data?.total || 0,
      licenseResult.data?.total || 0,
      insuranceResult.data?.total || 0,
    )
  }
  catch (error: any) {
    errorMessage.value = error?.message || '数据加载失败'
    message.error(errorMessage.value)
  }
  finally {
    loading.value = false
  }
}

function resetQuery() {
  queryModel.plateNo = ''
  queryModel.vehicleId = undefined
  queryModel.expenseType = undefined
  queryModel.licenseType = undefined
  queryModel.insuranceType = undefined
  queryModel.departmentName = undefined
  queryModel.status = undefined
  resetFinancialPeriodFilter()
  pagination.current = 1
  loadList()
}

function openBatchCreate() {
  batchVehicle.value = undefined
  batchOpen.value = true
}

function openBatchForVehicle(vehicle: Record<string, any>) {
  batchVehicle.value = vehicle as OfficeVehicle
  batchOpen.value = true
}

function openEdit(type: ModalType, record: Record<string, any>) {
  modalType.value = type
  editing.value = {
    ...record,
    ...(type === 'insurance' && record.startDate && record.endDate ? { insuranceRange: [record.startDate, record.endDate] } : {}),
  }
  editOpen.value = true
}

function modalTypeLabel(type: ModalType) {
  return {
    vehicle: '车辆',
    expense: '费用',
    license: '证照',
    insurance: '保险',
  }[type]
}

async function saveEdit() {
  errorMessage.value = ''
  const apiMap = {
    vehicle: saveOfficeVehicleApi,
    expense: saveOfficeVehicleExpenseApi,
    license: saveOfficeVehicleLicenseApi,
    insurance: saveOfficeVehicleInsuranceApi,
  }
  const record = editing.value
  if (modalType.value === 'vehicle') {
    if (!String(record.plateNo || '').trim() || !String(record.brandModel || '').trim())
      return message.warning('请填写车牌号和品牌型号')
    if (vehicleRows.value.some(item => item.plateNo === String(record.plateNo).trim() && item.id !== record.id))
      return message.warning('车牌号已存在，请检查后再保存')
  }
  if (modalType.value === 'expense' && (!record.vehicleId || !record.expenseType || Number(record.amount || 0) <= 0 || !record.occurredDate))
    return message.warning('请选择车辆、费用类型、发生日期并填写大于 0 的金额')
  if (modalType.value === 'license') {
    if (!record.vehicleId || !record.licenseType || !String(record.licenseNo || '').trim() || !record.expiryDate)
      return message.warning('请选择车辆、证照类型并填写证照编号和到期日期')
    if (record.issueDate && dayjs(record.expiryDate).isBefore(dayjs(record.issueDate), 'day'))
      return message.warning('证照到期日期不能早于发证日期')
  }
  if (modalType.value === 'insurance') {
    if (!record.vehicleId || !String(record.insuranceType || '').trim() || !String(record.policyNo || '').trim() || Number(record.amount || 0) <= 0 || !record.startDate || !record.endDate)
      return message.warning('请完整填写车辆、保险类型、保单号、保费和起止日期')
    if (dayjs(record.endDate).isBefore(dayjs(record.startDate), 'day'))
      return message.warning('保险到期日期不能早于开始日期')
  }

  editSaving.value = true
  try {
    const { code, msg } = await apiMap[modalType.value](editing.value as any)
    if (code !== 200)
      return message.warning(msg)
    editOpen.value = false
    message.success('保存成功')
    await Promise.all([loadVehiclesForOptions(), loadList()])
    if (detailOpen.value && detail.value?.vehicle.id)
      await refreshDetail(detail.value.vehicle.id)
  }
  catch (error: any) {
    errorMessage.value = error?.message || '保存失败'
    message.error(errorMessage.value)
  }
  finally {
    editSaving.value = false
  }
}

async function openDetail(record: Record<string, any>) {
  if (!record.id)
    return
  try {
    const { data, code, msg } = await getOfficeVehicleDetailApi(record.id)
    if (code !== 200 || !data)
      return message.warning(msg)
    detail.value = data
    detailOpen.value = true
  }
  catch (error: any) {
    errorMessage.value = error?.message || '详情加载失败'
    message.error(errorMessage.value)
  }
}

async function refreshDetail(vehicleId: string) {
  const { data, code } = await getOfficeVehicleDetailApi(vehicleId)
  if (code === 200 && data)
    detail.value = data
}

async function exportExpenses() {
  try {
    const { data } = await exportOfficeVehicleExpensesApi(buildExpenseQuery())
    downloadWorkbook(`办公用车费用台账_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`, [{ name: '费用台账', rows: data || [] }])
  }
  catch (error: any) {
    errorMessage.value = error?.message || '导出失败'
    message.error(errorMessage.value)
  }
}

function statusColor(status: string) {
  if (/正常|有效|已确认|已处理/.test(status))
    return 'green'
  if (/即将|待审批|审批中|草稿|维修/.test(status))
    return 'orange'
  if (/过期|驳回|停用|出售/.test(status))
    return 'red'
  return 'blue'
}

function openAttachment(record: { attachmentName?: string, attachmentUrl?: string }) {
  const attachmentUrl = String(record.attachmentUrl || '').trim()
  if (!attachmentUrl) {
    message.warning(record.attachmentName ? '该历史附件缺少访问地址，请编辑记录后重新上传' : '暂无附件')
    return
  }

  try {
    const url = new URL(attachmentUrl, window.location.origin)
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('unsupported protocol')
    window.open(url.href, '_blank', 'noopener,noreferrer')
  }
  catch {
    message.error('附件地址无效，请重新上传')
  }
}

async function runDelete(action: () => Promise<unknown>) {
  try {
    await action()
    await loadList()
    message.success('删除成功')
  }
  catch (error: any) {
    const reason = error?.message || '删除失败'
    errorMessage.value = reason
    message.error(reason)
  }
}

function canEditVehicle(record: Record<string, any>) {
  return canEditRecord(record).allowed
}

function canDeleteVehicle(record: Record<string, any>) {
  return canDeleteRecord(record).allowed
}

function buildActions(section: SectionKey, record: any): RecordActionItem[] {
  const canEdit = canEditRecord(record)
  const canDelete = canDeleteRecord(record)
  const canAudit = canAuditRecord(record)
  if (section === 'vehicles') {
    return [
      { key: 'view', label: '查看', onClick: () => openDetail(record) },
      { key: 'supplement', label: '补充资料', onClick: () => openBatchForVehicle(record) },
      { key: 'edit', label: '编辑', hidden: !canEdit.allowed, disabled: !canEdit.allowed, onClick: () => openEdit('vehicle', record) },
      {
        key: 'delete',
        label: '删除',
        danger: true,
        confirm: true,
        hidden: !canDelete.allowed,
        disabled: !canDelete.allowed,
        confirmTitle: '确定删除该车辆档案？',
        onClick: () => runDelete(() => deleteOfficeVehicleApi(record.id)),
      },
    ]
  }
  if (section === 'expenses') {
    return [
      { key: 'view', label: '查看', onClick: () => { message.info(record.remark || '暂无更多信息') } },
      {
        key: 'submit',
        label: '提交审批',
        hidden: true,
        onClick: async () => {
          await submitOfficeVehicleExpenseApprovalApi(record.id)
          await loadList()
        },
      },
      {
        key: 'approve',
        label: '确认',
        hidden: record.needApproval || record.approvalStatus === '已确认' || !canAudit.allowed,
        onClick: async () => {
          await changeOfficeVehicleExpenseStatusApi(record.id, '已确认')
          await loadList()
        },
      },
      {
        key: 'reject',
        label: '驳回',
        danger: true,
        confirm: true,
        hidden: record.needApproval || !['待审批', '审批中'].includes(record.approvalStatus) || !canAudit.allowed,
        onClick: async () => {
          await changeOfficeVehicleExpenseStatusApi(record.id, '已驳回')
          await loadList()
        },
      },
      { key: 'edit', label: '编辑', hidden: !canEdit.allowed, disabled: !canEdit.allowed, onClick: () => openEdit('expense', record) },
      { key: 'preview', label: '预览票据', hidden: !record.attachmentName, onClick: () => openAttachment(record) },
      {
        key: 'delete',
        label: '删除',
        danger: true,
        confirm: true,
        hidden: !canDelete.allowed,
        disabled: !canDelete.allowed,
        confirmTitle: '确定删除该费用记录？',
        onClick: () => runDelete(() => deleteOfficeVehicleExpenseApi(record.id)),
      },
    ]
  }
  if (section === 'licenses') {
    return [
      { key: 'view', label: '查看', onClick: () => openAttachment(record) },
      { key: 'edit', label: '编辑', hidden: !canEdit.allowed, onClick: () => openEdit('license', record) },
      {
        key: 'delete',
        label: '删除',
        danger: true,
        confirm: true,
        hidden: !canDelete.allowed,
        confirmTitle: '确定删除该证照？',
        onClick: () => runDelete(() => deleteOfficeVehicleLicenseApi(record.id)),
      },
    ]
  }
  if (section === 'insurances') {
    return [
      { key: 'view', label: '查看', onClick: () => openAttachment(record) },
      { key: 'edit', label: '编辑', hidden: !canEdit.allowed, onClick: () => openEdit('insurance', record) },
    ]
  }
  return []
}

function selectAttachment(file: File, field: 'photoUrl' | 'attachmentName') {
  uploadAttachment(file, field)
  return false
}

async function uploadAttachment(file: File, field: 'photoUrl' | 'attachmentName') {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers: {
        Authorization: String(useAuthorization().value || ''),
      },
      body: formData,
    })
    const result = await res.json()
    if (!res.ok || result.code !== 200)
      throw new Error(result.msg || '上传失败')

    if (field === 'photoUrl') {
      editing.value.photoUrl = result.data.url
    }
    else {
      editing.value.attachmentName = result.data.originalName
      editing.value.attachmentUrl = result.data.url
    }
    message.success(`已上传 ${file.name}`)
  }
  catch (error: any) {
    message.error(error?.message || '上传失败')
  }
}
</script>

<template>
  <page-container>
    <a-card :bordered="false" mb-4>
      <a-row :gutter="[16, 16]" align="middle">
        <a-col :xs="24" :lg="14">
          <div text-20px font-600>
            办公用车
          </div>
          <div mt-2 c="var(--text-color-secondary)">
            聚焦车辆费用台账、证照资料、保险/年检/证照到期提醒，不做复杂派车和车队调度。
          </div>
        </a-col>
        <a-col :xs="24" :lg="10" style="text-align: right;">
          <a-space wrap>
            <a-button type="primary" @click="openBatchCreate">
              <PlusOutlined />
              新增整车资料
            </a-button>
            <a-button @click="exportExpenses">
              导出费用台账
            </a-button>
          </a-space>
        </a-col>
      </a-row>
      <a-form mt-4 class="office-query" :label-col="{ span: 7 }">
        <a-row :gutter="[16, 0]">
          <FinancialPeriodFilter v-model="financialPeriodFilter" :available-month-keys="availableMonthKeys" />
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="车辆">
              <a-select v-model:value="queryModel.vehicleId" allow-clear show-search :options="vehicleOptions" placeholder="请选择车辆" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="车牌">
              <a-input v-model:value="queryModel.plateNo" allow-clear placeholder="请输入车牌" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="费用类型">
              <a-select v-model:value="queryModel.expenseType" allow-clear :options="expenseTypeOptions" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="证照类型">
              <a-select v-model:value="queryModel.licenseType" allow-clear :options="licenseTypeOptions" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="保险类型">
              <a-input v-model:value="queryModel.insuranceType" allow-clear placeholder="例如 交强险" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="状态">
              <a-select v-model:value="queryModel.status" allow-clear :options="[...vehicleStatuses, ...expenseStatuses, ...dueStatuses].map(item => ({ label: item, value: item }))" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="loadList">
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

    <a-alert v-if="errorMessage" mb-4 type="error" show-icon :message="errorMessage" closable @close="errorMessage = ''" />

    <section class="office-summary-grid">
      <div v-for="item in summaryCards" :key="item.label" class="office-summary-card" :class="`tone-${item.tone}`">
        <div class="summary-label">
          {{ item.label }}
        </div>
        <strong>{{ item.value }}</strong>
        <span>{{ item.hint }}</span>
        <a-tag v-if="item.tag" size="small">
          {{ item.tag }}
        </a-tag>
      </div>
    </section>

    <a-card :bordered="false" class="office-section-card">
      <a-tabs v-model:active-key="activeContentTab" class="office-content-tabs">
        <a-tab-pane key="vehicles" tab="车辆汇总">
          <div class="tab-toolbar">
            <div>
              <strong>办公用车汇总表</strong>
              <span>按车辆查看费用、证照、保险和到期风险</span>
            </div>
            <a-space wrap>
              <a-tag color="blue">
                当前 {{ filteredVehicleSummaryRows.length }} / 共 {{ vehicleSummaryRows.length }} 辆
              </a-tag>
              <a-button type="primary" @click="openBatchCreate">
                <PlusOutlined />
                新增整车资料
              </a-button>
            </a-space>
          </div>
          <a-table row-key="id" :loading="loading" :columns="vehicleSummaryColumns" :data-source="filteredVehicleSummaryRows" :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 辆` }" :scroll="{ x: vehicleSummaryScrollX }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'vehicleInfo'">
                <button type="button" class="vehicle-link" @click="openDetail(record)">
                  <strong>{{ record.plateNo }}</strong>
                </button>
              </template>
              <template v-else-if="column.dataIndex === 'ownership'">
                <div class="table-stack">
                  <strong>{{ record.departmentName || '-' }}</strong>
                </div>
              </template>
              <template v-else-if="column.dataIndex === 'licenseOverview'">
                <div v-if="record.nearestLicense" class="table-stack">
                  <span><a-tag :color="statusColor(record.nearestLicense.status)">{{ record.nearestLicense.status }}</a-tag>{{ record.nearestLicense.licenseType }}</span><small>到期日期：{{ record.nearestLicense.expiryDate }} · 共 {{ record.licenses.length }} 项</small>
                </div>
                <span v-else class="empty-cell">未录入证照</span>
              </template>
              <template v-else-if="column.dataIndex === 'insuranceOverview'">
                <div v-if="record.nearestInsurance" class="table-stack">
                  <span><a-tag :color="statusColor(record.nearestInsurance.status)">{{ record.nearestInsurance.status }}</a-tag>{{ record.nearestInsurance.insuranceType }}</span><small>到期日期：{{ record.nearestInsurance.endDate }} · 共 {{ record.insurances.length }} 项</small>
                </div>
                <span v-else class="empty-cell">未录入保险</span>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="statusColor(record.status)">
                  {{ record.status }}
                </a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'action'">
                <a-space :size="4" class="vehicle-actions">
                  <a-button type="link" size="small" @click="openDetail(record)">
                    查看
                  </a-button>
                  <a-button type="link" size="small" @click="openBatchForVehicle(record)">
                    补充资料
                  </a-button>
                  <a-dropdown>
                    <a-button type="link" size="small">
                      更多
                    </a-button>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item v-if="canEditVehicle(record)" @click="openEdit('vehicle', record)">
                          编辑车辆
                        </a-menu-item>
                        <a-menu-item v-if="canDeleteVehicle(record)">
                          <a-popconfirm title="确定删除该车辆档案？" ok-text="确定" cancel-text="取消" @confirm="runDelete(() => deleteOfficeVehicleApi(record.id))">
                            <span class="danger-action">删除车辆</span>
                          </a-popconfirm>
                        </a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="expenses" tab="本月费用">
          <div class="tab-toolbar">
            <div>
              <strong>本月费用明细</strong>
              <span>按当前财务期间和查询条件展示费用记录</span>
            </div>
            <a-space wrap>
              <a-tag color="red">
                {{ filteredExpenseRows.length }} 笔 · {{ money(filteredExpenseAmount) }}
              </a-tag>
              <a-button @click="exportExpenses">
                导出费用台账
              </a-button>
            </a-space>
          </div>
          <a-table row-key="id" :loading="loading" :columns="detailExpenseColumns" :data-source="filteredExpenseRows" :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 笔` }" :scroll="{ x: detailExpenseScrollX }">
            <template #bodyCell="{ column, record }">
              <RecordActions v-if="column.dataIndex === 'action'" :actions="buildActions('expenses', record)" />
              <a-tag v-else-if="column.dataIndex === 'approvalStatus'" :color="statusColor(record.approvalStatus)">
                {{ record.approvalStatus }}
              </a-tag>
              <span v-else-if="column.dataIndex === 'amount'" class="expense-amount">{{ money(record.amount) }}</span>
              <a-tooltip v-else :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                <span class="cell-ellipsis">
                  {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                </span>
              </a-tooltip>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <OfficeVehicleBatchModal v-model:open="batchOpen" :initial-vehicle="batchVehicle" @saved="loadList" />

    <a-modal v-model:open="editOpen" :title="editing.id ? `编辑${modalTypeLabel(modalType)}` : '新增办公用车明细'" width="760px" :mask-closable="false" :closable="!editSaving" :keyboard="!editSaving" :confirm-loading="editSaving" :cancel-button-props="{ disabled: editSaving }" ok-text="保存" @ok="saveEdit">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <template v-if="modalType === 'vehicle'">
            <a-col :xs="24" :md="12">
              <a-form-item label="车牌号" required>
                <a-input v-model:value="editing.plateNo" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="品牌型号" required>
                <a-input v-model:value="editing.brandModel" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="车辆类型">
                <a-input v-model:value="editing.vehicleType" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="所属部门">
                <a-input v-model:value="editing.departmentName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="负责人">
                <a-input v-model:value="editing.ownerName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="默认司机">
                <a-input v-model:value="editing.defaultDriverName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="车辆状态">
                <a-select v-model:value="editing.status" :options="vehicleStatuses.map(item => ({ label: item, value: item }))" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="购置日期">
                <a-date-picker v-model:value="editing.purchaseDate" value-format="YYYY-MM-DD" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24">
              <a-form-item label="车辆照片">
                <a-upload :show-upload-list="false" accept="image/*" :before-upload="(file: File) => selectAttachment(file, 'photoUrl')">
                  <a-button>
                    <template #icon>
                      <UploadOutlined />
                    </template>
                    选择图片
                  </a-button>
                </a-upload>
                <div v-if="editing.photoUrl" class="attachment-name">
                  {{ editing.photoUrl }}
                </div>
              </a-form-item>
            </a-col>
          </template>
          <template v-if="modalType === 'expense'">
            <a-col :xs="24" :md="12">
              <a-form-item label="车辆" required>
                <a-select v-model:value="editing.vehicleId" :options="vehicleOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="费用类型" required>
                <a-select v-model:value="editing.expenseType" :options="expenseTypeOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="费用金额" required>
                <business-input-number v-model:value="editing.amount" :min="0" :precision="2" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="发生日期" required>
                <a-date-picker v-model:value="editing.occurredDate" value-format="YYYY-MM-DD" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="经办人">
                <a-input v-model:value="editing.handlerName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="所属部门">
                <a-input v-model:value="editing.departmentName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="支付方式">
                <a-select v-model:value="editing.paymentMethod" :options="paymentMethodOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="发票号">
                <a-input v-model:value="editing.invoiceNo" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="票据附件">
                <a-upload :show-upload-list="false" :accept="attachmentAccept" :before-upload="(file: File) => selectAttachment(file, 'attachmentName')">
                  <a-button>
                    <template #icon>
                      <UploadOutlined />
                    </template>
                    选择图片/文件
                  </a-button>
                </a-upload>
                <div v-if="editing.attachmentName" class="attachment-name">
                  {{ editing.attachmentName }}
                </div>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="是否需要审批">
                <a-switch v-model:checked="editing.needApproval" />
              </a-form-item>
            </a-col>
          </template>
          <template v-if="modalType === 'license'">
            <a-col :xs="24" :md="12">
              <a-form-item label="车辆">
                <a-select v-model:value="editing.vehicleId" :options="vehicleOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="证照类型">
                <a-select v-model:value="editing.licenseType" :options="licenseTypeOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="证照编号">
                <a-input v-model:value="editing.licenseNo" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="发证日期">
                <a-date-picker v-model:value="editing.issueDate" value-format="YYYY-MM-DD" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="到期日期">
                <a-date-picker v-model:value="editing.expiryDate" value-format="YYYY-MM-DD" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="发证机关">
                <a-input v-model:value="editing.issuingAuthority" />
              </a-form-item>
            </a-col>
            <a-col :xs="24">
              <a-form-item label="附件图片/扫描件">
                <a-upload :show-upload-list="false" :accept="attachmentAccept" :before-upload="(file: File) => selectAttachment(file, 'attachmentName')">
                  <a-button>
                    <template #icon>
                      <UploadOutlined />
                    </template>
                    选择图片/文件
                  </a-button>
                </a-upload>
                <div v-if="editing.attachmentName" class="attachment-name">
                  {{ editing.attachmentName }}
                </div>
              </a-form-item>
            </a-col>
          </template>
          <template v-if="modalType === 'insurance'">
            <a-col :xs="24" :md="12">
              <a-form-item label="车辆">
                <a-select v-model:value="editing.vehicleId" :options="vehicleOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="保险类型">
                <a-input v-model:value="editing.insuranceType" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="保单号">
                <a-input v-model:value="editing.policyNo" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="保险公司">
                <a-input v-model:value="editing.insurer" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="保费">
                <business-input-number v-model:value="editing.amount" :min="0" :precision="2" style="width: 100%;" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="起止日期">
                <a-range-picker v-model:value="editing.insuranceRange" value-format="YYYY-MM-DD" style="width: 100%;" @change="(value: any) => { editing.startDate = value?.[0]; editing.endDate = value?.[1] }" />
              </a-form-item>
            </a-col>
            <a-col :xs="24">
              <a-form-item label="保单附件">
                <a-upload :show-upload-list="false" :accept="attachmentAccept" :before-upload="(file: File) => selectAttachment(file, 'attachmentName')">
                  <a-button>
                    <template #icon>
                      <UploadOutlined />
                    </template>
                    选择图片/文件
                  </a-button>
                </a-upload>
                <div v-if="editing.attachmentName" class="attachment-name">
                  {{ editing.attachmentName }}
                </div>
              </a-form-item>
            </a-col>
          </template>
          <a-col :xs="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="editing.remark" :rows="3" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-drawer v-model:open="detailOpen" title="车辆详情" width="min(1120px, 94vw)">
      <a-descriptions v-if="detail" bordered size="small" :column="2">
        <a-descriptions-item label="车牌号">
          {{ detail.vehicle.plateNo }}
        </a-descriptions-item>
        <a-descriptions-item label="品牌型号">
          {{ detail.vehicle.brandModel }}
        </a-descriptions-item>
        <a-descriptions-item label="所属部门">
          {{ detail.vehicle.departmentName }}
        </a-descriptions-item>
        <a-descriptions-item label="负责人">
          {{ detail.vehicle.ownerName }}
        </a-descriptions-item>
        <a-descriptions-item label="车辆状态">
          {{ detail.vehicle.status }}
        </a-descriptions-item>
        <a-descriptions-item label="购置日期">
          {{ detail.vehicle.purchaseDate || '-' }}
        </a-descriptions-item>
      </a-descriptions>
      <a-tabs v-if="detail" mt-4>
        <a-tab-pane key="expense" tab="费用记录">
          <a-table size="small" row-key="id" :pagination="false" :columns="detailExpenseColumns" :data-source="detail.expenses" :scroll="{ x: detailExpenseScrollX }">
            <template #bodyCell="{ column, record }">
              <RecordActions v-if="column.dataIndex === 'action'" :actions="buildActions('expenses', record)" />
              <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                <span v-if="column.dataIndex !== 'action'" class="cell-ellipsis">
                  {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                </span>
              </a-tooltip>
            </template>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="license" tab="证照资料">
          <a-table size="small" row-key="id" :pagination="false" :columns="detailLicenseColumns" :data-source="detail.licenses" :scroll="{ x: detailLicenseScrollX }">
            <template #bodyCell="{ column, record }">
              <RecordActions v-if="column.dataIndex === 'action'" :actions="buildActions('licenses', record)" />
              <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                <span v-if="column.dataIndex !== 'action'" class="cell-ellipsis">
                  {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                </span>
              </a-tooltip>
            </template>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="insurance" tab="保险信息">
          <a-table size="small" row-key="id" :pagination="false" :columns="detailInsuranceColumns" :data-source="detail.insurances" :scroll="{ x: detailInsuranceScrollX }">
            <template #bodyCell="{ column, record }">
              <RecordActions v-if="column.dataIndex === 'action'" :actions="buildActions('insurances', record)" />
              <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                <span v-if="column.dataIndex !== 'action'" class="cell-ellipsis">
                  {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                </span>
              </a-tooltip>
            </template>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="log" tab="操作日志">
          <a-timeline>
            <a-timeline-item v-for="log in detail.logs" :key="log.id">
              {{ log.createdAt }} {{ log.operatorName }} {{ log.content }}
            </a-timeline-item>
          </a-timeline>
        </a-tab-pane>
      </a-tabs>
    </a-drawer>
  </page-container>
</template>

<style scoped lang="less">
.office-query {
  :deep(.ant-form-item) {
    margin-bottom: 0;
  }

  :deep(.ant-picker),
  :deep(.ant-input),
  :deep(.ant-select) {
    width: 100%;
  }
}

.office-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.office-summary-card {
  position: relative;
  min-height: 96px;
  padding: 14px 16px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 4px 8px rgb(15 23 42 / 4%);

  &::before {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 3px;
    background: #1677ff;
    content: '';
  }

  .summary-label {
    color: #475569;
    font-size: 13px;
    font-weight: 600;
  }

  strong {
    display: block;
    margin: 8px 0 4px;
    color: #0f172a;
    font-size: 24px;
    line-height: 1.15;
    white-space: nowrap;
  }

  span {
    display: block;
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.ant-tag) {
    margin-top: 8px;
  }

  &.tone-success::before {
    background: #16a34a;
  }

  &.tone-danger::before {
    background: #dc2626;
  }

  &.tone-warning::before {
    background: #d97706;
  }
}

.office-section-card {
  margin-bottom: 16px;
}

.office-content-tabs {
  :deep(.ant-tabs-nav) {
    margin-bottom: 16px;
  }
}

.tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 48px;
  margin-bottom: 12px;

  > div {
    min-width: 0;
  }

  strong,
  span {
    display: block;
  }

  strong {
    color: #1f2937;
    font-size: 15px;
  }

  span {
    margin-top: 3px;
    color: #6b7280;
    font-size: 12px;
  }
}

.expense-amount {
  color: #b42318;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.vehicle-link {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  strong {
    display: block;
    color: #1677ff;
    font-size: 14px;
    font-weight: 600;
  }

  &:focus-visible {
    outline: 2px solid #1677ff;
    outline-offset: 3px;
  }
}

.table-stack {
  min-width: 0;

  strong,
  span,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong,
  span {
    color: #1f2937;
    font-size: 13px;
  }

  small,
  > span + span {
    margin-top: 4px;
    color: #6b7280;
    font-size: 12px;
  }

  :deep(.ant-tag) {
    margin-inline-end: 6px;
  }
}

.empty-cell {
  color: #6b7280;
  font-size: 13px;
}

.vehicle-actions {
  white-space: nowrap;

  :deep(.ant-btn-link) {
    padding-inline: 4px;
  }
}

.danger-action {
  color: #dc2626;
}

.attachment-name {
  margin-top: 8px;
  color: var(--text-color-secondary);
  font-size: 13px;
  word-break: break-all;
}

@media (max-width: 1280px) {
  .office-summary-grid {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }
}

@media (max-width: 720px) {
  .office-summary-grid {
    grid-template-columns: 1fr;
  }

  .tab-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

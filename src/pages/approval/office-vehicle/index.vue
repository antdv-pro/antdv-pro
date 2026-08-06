<script setup lang="ts">
import type { OfficeVehicle, OfficeVehicleDetail, OfficeVehicleExpense, OfficeVehicleLicense, OfficeVehicleQuery, OfficeVehicleSummary } from '~@/api/office-vehicle'
import type { RecordActionItem } from '~@/components/record-actions/index.vue'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import {
  changeOfficeVehicleExpenseStatusApi,
  deleteOfficeVehicleExpenseApi,
  deleteOfficeVehicleLicenseApi,
  exportOfficeVehicleExpensesApi,
  getOfficeVehicleDetailApi,
  getOfficeVehicleExpenseListApi,
  getOfficeVehicleLicenseListApi,
  getOfficeVehicleListApi,
  getOfficeVehicleSummaryApi,
  saveOfficeVehicleExpenseApi,
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

type SectionKey = 'expenses' | 'licenses'
type ModalType = 'expense' | 'license'
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
const summary = ref<OfficeVehicleSummary>()
const detail = ref<OfficeVehicleDetail>()
const detailOpen = ref(false)
const editOpen = ref(false)
const editSaving = ref(false)
const modalType = ref<ModalType>('expense')
const activeContentTab = ref<ContentTab>('vehicles')
const editing = ref<Record<string, any>>({})

const pagination = reactive({ current: 1, pageSize: 10, total: 0 })
const queryModel = reactive({
  plateNo: '',
  vehicleId: undefined as string | undefined,
  expenseType: undefined as string | undefined,
  licenseType: undefined as string | undefined,
  departmentName: undefined as string | undefined,
  status: undefined as string | undefined,
})

const expenseTypeOptions = computed(() => businessDictionaries.options('office_vehicle_expense_type'))
const licenseTypeOptions = computed(() => businessDictionaries.options('office_vehicle_license_type'))
const paymentMethodOptions = computed(() => businessDictionaries.options('office_vehicle_payment_method'))
const expenseStatuses = ['草稿', '待审批', '审批中', '已确认', '已驳回', '已撤回']
const dueStatuses = ['有效', '即将到期', '已过期']
const attachmentAccept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv'
const vehicleOptions = computed(() => vehicleRows.value.map(item => ({ label: `${item.plateNo} / ${item.brandModel}`, value: item.id! })))
const availableMonthKeys = computed(() => [...new Set(expenseRows.value.map(item => dayjs(item.occurredDate).format('YYYYMM')))])

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
const vehicleSummaryColumns = [
  { title: '车辆', dataIndex: 'vehicleInfo', width: 190, fixed: 'left' as const },
  { title: '归属信息', dataIndex: 'ownership', width: 170 },
  { title: '最近到期证照', dataIndex: 'licenseOverview', width: 260 },
  { title: '车辆状态', dataIndex: 'status', width: 100 },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 160 },
]
const vehicleSummaryScrollX = computed(() => createBusinessTableScrollX(vehicleSummaryColumns, 880))

const vehicleSummaryRows = computed(() => vehicleRows.value.map((vehicle) => {
  const expenses = expenseRows.value.filter(item => item.vehicleId === vehicle.id)
  const licenses = licenseRows.value.filter(item => item.vehicleId === vehicle.id)
  return {
    ...vehicle,
    expenses,
    licenses,
    nearestLicense: [...licenses].filter(item => item.expiryDate).sort((a, b) => dayjs(a.expiryDate).valueOf() - dayjs(b.expiryDate).valueOf())[0],
  }
}))

const filteredVehicleSummaryRows = computed(() => vehicleSummaryRows.value.filter((row) => {
  if (queryModel.expenseType && !row.expenses.some(item => item.expenseType === queryModel.expenseType))
    return false
  if (queryModel.licenseType && !row.licenses.some(item => item.licenseType === queryModel.licenseType))
    return false
  if (queryModel.status) {
    const matchesStatus = row.expenses.some(item => item.approvalStatus === queryModel.status)
      || row.licenses.some(item => item.status === queryModel.status)
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
const expiryRows = computed(() => licenseRows.value
  .filter(item => item.expiryDate)
  .map(item => ({ ...item, days: dayjs(item.expiryDate).startOf('day').diff(dayjs().startOf('day'), 'day') }))
  .sort((a, b) => a.days - b.days))
const urgentExpiryRows = computed(() => expiryRows.value.filter(item => item.days <= 30).slice(0, 8))
const expiryCount = computed(() => expiryRows.value.filter(item => item.days <= 30).length)
const expiredCount = computed(() => expiryRows.value.filter(item => item.days < 0).length)

const detailExpenseColumns = computed(() => enhanceBusinessTableColumns(expenseColumns))
const detailLicenseColumns = computed(() => enhanceBusinessTableColumns(licenseColumns))
const detailExpenseScrollX = computed(() => createBusinessTableScrollX(detailExpenseColumns.value, 1200))
const detailLicenseScrollX = computed(() => createBusinessTableScrollX(detailLicenseColumns.value, 1100))

onMounted(async () => {
  await businessDictionaries.load()
  queryModel.plateNo = typeof route.query.plateNo === 'string' ? route.query.plateNo : ''
  queryModel.licenseType = typeof route.query.licenseType === 'string' ? route.query.licenseType : undefined
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
    const [summaryResult, vehicleResult, expenseResult, licenseResult] = await Promise.all([
      getOfficeVehicleSummaryApi(buildQuery()),
      getOfficeVehicleListApi(query),
      getOfficeVehicleExpenseListApi({ ...buildExpenseQuery(), current: 1, pageSize: 1000 }),
      getOfficeVehicleLicenseListApi({ ...query, licenseType: queryModel.licenseType }),
    ])
    summary.value = summaryResult.data
    vehicleRows.value = vehicleResult.data?.records || []
    expenseRows.value = expenseResult.data?.records || []
    licenseRows.value = licenseResult.data?.records || []
    pagination.total = Math.max(
      vehicleResult.data?.total || 0,
      expenseResult.data?.total || 0,
      licenseResult.data?.total || 0,
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
  queryModel.departmentName = undefined
  queryModel.status = undefined
  resetFinancialPeriodFilter()
  pagination.current = 1
  loadList()
}

function openEdit(type: ModalType, record: Record<string, any>) {
  modalType.value = type
  editing.value = {
    vehicleId: queryModel.vehicleId,
    ...record,
  }
  editOpen.value = true
}

function modalTypeLabel(type: ModalType) {
  return {
    expense: '费用',
    license: '证照',
  }[type]
}

async function saveEdit() {
  errorMessage.value = ''
  const apiMap = {
    expense: saveOfficeVehicleExpenseApi,
    license: saveOfficeVehicleLicenseApi,
  }
  const record = editing.value
  if (modalType.value === 'expense' && (!record.vehicleId || !record.expenseType || Number(record.amount || 0) <= 0 || !record.occurredDate))
    return message.warning('请选择车辆、费用类型、发生日期并填写大于 0 的金额')
  if (modalType.value === 'license') {
    if (!record.vehicleId || !record.licenseType || !String(record.licenseNo || '').trim() || !record.expiryDate)
      return message.warning('请选择车辆、证照类型并填写证照编号和到期日期')
    if (record.issueDate && dayjs(record.expiryDate).isBefore(dayjs(record.issueDate), 'day'))
      return message.warning('证照到期日期不能早于发证日期')
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

function buildActions(section: SectionKey, record: any): RecordActionItem[] {
  const canEdit = canEditRecord(record)
  const canDelete = canDeleteRecord(record)
  const canAudit = canAuditRecord(record)
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
  return []
}

function selectAttachment(file: File, field: 'attachmentName') {
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
            只保留两件事：盯住证照到期风险，快速登记车辆费用。
          </div>
        </a-col>
        <a-col :xs="24" :lg="10" style="text-align: right;">
          <a-space wrap>
            <a-button type="primary" @click="openEdit('license', {})">
              <PlusOutlined />
              登记证照
            </a-button>
            <a-button @click="openEdit('expense', {})">
              <PlusOutlined />
              录入费用
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
            <a-form-item label="状态">
              <a-select v-model:value="queryModel.status" allow-clear :options="[...expenseStatuses, ...dueStatuses].map(item => ({ label: item, value: item }))" />
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
      <div class="office-summary-card tone-warning expiry-hero">
        <div class="summary-label">
          证照到期提醒
        </div>
        <strong>{{ expiryCount }}</strong>
        <span>30 天内到期 · {{ expiredCount }} 项已过期</span>
        <a-tag color="orange" size="small">
          优先处理
        </a-tag>
      </div>
      <div class="office-summary-card tone-danger">
        <div class="summary-label">
          本月费用
        </div>
        <strong>{{ money(summary?.monthExpense) }}</strong>
        <span>当前财务期间合计</span>
      </div>
      <div class="office-summary-card tone-primary">
        <div class="summary-label">
          车辆数量
        </div>
        <strong>{{ summary?.vehicleCount ?? 0 }}</strong>
        <span>当前权限范围</span>
      </div>
      <div class="office-summary-card tone-success">
        <div class="summary-label">
          待审批费用
        </div>
        <strong>{{ summary?.pendingExpenseCount ?? 0 }}</strong>
        <span>需要跟进的费用记录</span>
      </div>
    </section>

    <a-card :bordered="false" class="office-section-card">
      <a-tabs v-model:active-key="activeContentTab" class="office-content-tabs">
        <a-tab-pane key="vehicles" tab="证照到期">
          <div class="tab-toolbar">
            <div>
              <strong>证照到期总览</strong>
              <span>优先处理未来 30 天到期和已过期证照</span>
            </div>
            <a-space wrap>
              <a-tag color="blue">
                当前 {{ filteredVehicleSummaryRows.length }} / 共 {{ vehicleSummaryRows.length }} 辆
              </a-tag>
              <a-button type="primary" @click="openEdit('license', {})">
                <PlusOutlined />
                登记证照
              </a-button>
            </a-space>
          </div>
          <div class="expiry-strip">
            <div class="expiry-strip-heading">
              <strong>证照到期清单</strong><span>按到期时间排序，红色表示已过期</span>
            </div>
            <a-empty v-if="!urgentExpiryRows.length" description="未来 30 天暂无到期证照" />
            <div v-else class="expiry-list">
              <div v-for="item in urgentExpiryRows" :key="item.id" class="expiry-item" :class="{ expired: item.days < 0 }">
                <div><strong>{{ item.plateNo }}</strong><span>{{ item.licenseType }} · {{ item.licenseNo }}</span></div>
                <div class="expiry-date">
                  <strong>{{ item.expiryDate }}</strong><span>{{ item.days < 0 ? `已过期 ${Math.abs(item.days)} 天` : item.days === 0 ? '今天到期' : `${item.days} 天后到期` }}</span>
                </div>
              </div>
            </div>
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
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="statusColor(record.status)">
                  {{ record.status }}
                </a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'action'">
                <a-space :size="4" class="vehicle-actions">
                  <a-button type="link" size="small" @click="openEdit('license', { vehicleId: record.id })">
                    登记证照
                  </a-button>
                  <a-button type="link" size="small" @click="openDetail(record)">
                    明细
                  </a-button>
                  <a-button type="link" size="small" @click="openEdit('expense', { vehicleId: record.id })">
                    录入费用
                  </a-button>
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
              <a-button type="primary" @click="openEdit('expense', {})">
                <PlusOutlined />
                录入费用
              </a-button>
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

    <a-modal v-model:open="editOpen" :title="editing.id ? `编辑${modalTypeLabel(modalType)}` : '新增办公用车明细'" width="760px" :mask-closable="false" :closable="!editSaving" :keyboard="!editSaving" :confirm-loading="editSaving" :cancel-button-props="{ disabled: editSaving }" ok-text="保存" @ok="saveEdit">
      <a-form layout="vertical">
        <a-row :gutter="16">
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

  &.expiry-hero {
    border-color: #f5c48a;
    background: #fffaf2;
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

.expiry-strip {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid #f3d6a4;
  border-radius: 8px;
  background: #fffaf2;
}

.expiry-strip-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;

  strong {
    color: #7a3e00;
    font-size: 14px;
  }
  span {
    color: #8b6a45;
    font-size: 12px;
  }
}

.expiry-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.expiry-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #f6dfbd;
  border-radius: 6px;
  background: #fff;

  > div {
    min-width: 0;
  }
  strong,
  span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  strong {
    color: #273449;
    font-size: 13px;
  }
  span {
    margin-top: 3px;
    color: #667085;
    font-size: 12px;
  }
  .expiry-date {
    text-align: right;
  }
  .expiry-date strong {
    color: #ad5c00;
  }

  &.expired {
    border-color: #f3b3b3;
    background: #fff5f5;
    .expiry-date strong {
      color: #c62828;
    }
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

  .expiry-list {
    grid-template-columns: 1fr;
  }
}
</style>

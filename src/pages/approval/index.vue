<script setup lang="ts">
import type { ApprovalDetail, ApprovalInstance, ApprovalTask } from '~@/api/approval'
import type { SystemUser } from '~@/api/common/user'
import type { SummaryCardItem } from '~@/components/summary-cards/index.vue'
import { CloudSyncOutlined, ExportOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue'
import * as XLSX from 'xlsx'
import {
  approveTaskApi,
  archiveApprovalApi,
  createApprovalTemplateApi,
  getApprovalBusinessRecordsApi,
  getApprovalCcApi,
  getApprovalDetailApi,
  getApprovalDoneApi,
  getApprovalInstancesApi,
  getApprovalSubmittedApi,
  getApprovalTemplatesApi,
  getApprovalTodoApi,
  pushWecomApprovalApi,
  rejectTaskApi,
  revokeApprovalApi,
  submitApprovalApi,
  transferTaskApi,
} from '~@/api/approval'
import { getUserListApi } from '~@/api/common/user'
import FinancialPeriodFilter from '~@/components/financial-period-filter/index.vue'
import SummaryCards from '~@/components/summary-cards/index.vue'
import { useBusinessDictionaries } from '~@/composables/business-dictionaries'
import { useFinancialPeriodFilter } from '~@/composables/financial-period-filter'
import { buildApprovalFlowGroups } from '~@/utils/approval-flow'
import { calculatePendingApprovalAmount, summarizePendingApprovalAmountsByDepartment } from '~@/utils/approval-summary'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { APPROVAL_BUSINESS_CATALOG, approvalInitiationSource } from '../../../shared/approval-business-catalog'
import { resolveApprovalFinancialPeriod } from '../../../shared/approval-financial-period'
import ApprovalInsights from './components/approval-insights.vue'

defineOptions({
  name: 'ApprovalCenter',
})

const route = useRoute()
const router = useRouter()
const message = useMessage()
const businessDictionaries = useBusinessDictionaries()
const userStore = useUserStore()
const isAdmin = computed(() => (userStore.userInfo?.roles || []).map(String).some(role => role.toUpperCase() === 'ADMIN'))

const operator = reactive({
  id: 4,
  name: '部门负责人',
})

const loading = ref(false)
const loadError = ref('')
const queryModel = reactive({
  status: undefined as string | undefined,
  keyword: '',
})
const {
  model: financialPeriodFilter,
  queryParams: financialQueryParams,
  resetFinancialPeriodFilter,
} = useFinancialPeriodFilter()
const activeKey = computed(() => {
  const routeName = String(route.name ?? '')
  if (route.meta.approvalView)
    return String(route.meta.approvalView)
  if (routeName.includes('Todo'))
    return 'center'
  if (routeName.includes('Done'))
    return 'done'
  if (routeName.includes('Submitted'))
    return 'submitted'
  if (routeName.includes('Cc'))
    return 'cc'
  if (routeName.includes('Templates'))
    return 'templates'
  if (routeName.includes('Business'))
    return 'business'
  return 'center'
})
const todoList = ref<ApprovalTask[]>([])
const doneList = ref<ApprovalTask[]>([])
const submittedList = ref<ApprovalInstance[]>([])
const ccList = ref<any[]>([])
const instanceList = ref<ApprovalInstance[]>([])
const templateList = ref<any[]>([])
const businessRecords = ref<any[]>([])
const detailOpen = ref(false)
const secondaryActionOpen = ref(false)
const secondaryAction = ref<'reject' | 'transfer'>('reject')
const secondaryComment = ref('')
const transferUserId = ref<number>()
const detail = ref<ApprovalDetail>()
const createOpen = ref(false)
const createSubmitting = ref(false)
const secondarySubmitting = ref(false)
const userLoading = ref(false)
const userOptions = ref<SystemUser[]>([])
const createFormRef = ref()
const createForm = reactive({
  title: '',
  businessType: '',
  businessId: '',
  contentOption: undefined as string | undefined,
  amount: undefined as number | undefined,
  counterparty: '',
  occurredDate: '',
  dueDate: '',
  attachmentName: '',
  attachmentUrl: '',
  description: '',
  approverIds: [] as Array<string | number>,
  remark: '',
})

const approvalTypeConfigs = APPROVAL_BUSINESS_CATALOG

const expenseContentOptions: Record<string, string[]> = {
  transport_fuel: ['柴油', '汽油', '尿素', '加油卡充值', '燃油补差', '其他燃油支出'],
  transport_etc: ['ETC费用', 'ETC充值', 'ETC补扣', 'ETC发票补录', '其他ETC支出'],
  transport_maintenance: ['车辆维修', '车辆保养', '轮胎更换', '配件采购', '事故维修', '外协维修', '其他维保支出'],
  transport_fee: ['车辆保险', '年审费', '营运证费', 'GPS年费', '检测费', '牌照费', '其他规费'],
  vehicle_loan: ['本金还款', '利息支出', '手续费', '提前还款', '逾期费用', '其他车贷支出'],
  transport_exception_fee: ['压车费', '绕路费', '罚款扣款', '事故赔付', '客户补偿', '其他异常支出'],
  purchase: ['办公用品', '车辆物资', '劳保用品', '维修材料', '系统服务', '其他采购支出'],
  payment: ['供应商付款', '服务费付款', '保证金付款', '预付款', '尾款', '其他付款'],
  receivable: ['运输收入', '贸易货款', '酒店应收', '服务收入', '保证金应收', '其他应收'],
  cash_expense: ['备用金支出', '零星采购', '差旅垫付', '现场杂费', '招待支出', '其他现金支出'],
  expense: ['交通费', '住宿费', '餐费', '招待费', '办公费', '通讯费', '其他报销'],
  salary: ['工资发放', '绩效奖金', '补贴津贴', '社保公积金', '个税代缴', '其他薪资支出'],
  asset_purchase: ['车辆资产', '办公设备', '生产工具', '信息设备', '低值易耗品', '其他资产采购'],
  asset_scrap: ['车辆报废', '设备报废', '工具报废', '残值处理', '其他资产报废'],
}

const personnelContentOptions: Record<string, string[]> = {
  salary: ['月度工资', '绩效工资', '奖金发放', '补贴津贴', '社保公积金', '个税代缴', '工资补发', '工资扣减'],
  attendance_adjustment: ['迟到补录', '早退补录', '缺卡补录', '外勤补录', '调休补录', '请假修正', '加班修正', '其他考勤调整'],
  leave: ['事假', '病假', '年假', '调休', '婚假', '产假', '陪产假', '丧假', '其他请假'],
  overtime: ['工作日加班', '周末加班', '节假日加班', '夜间加班', '紧急任务加班', '转调休', '计加班费'],
  travel: ['客户拜访', '项目驻场', '供应商沟通', '培训学习', '会议出差', '证照办理', '其他出差'],
}

const defaultContentOptions = computed(() => businessDictionaries.values('approval_expense_content'))

const operatorOptions = [
  { label: '部门负责人', value: 4, name: '部门负责人' },
  { label: '财务经理', value: 3, name: '财务经理' },
  { label: '总经理', value: 5, name: '总经理' },
  { label: userStore.nickname || '当前用户', value: userStore.userInfo?.id ?? 1, name: userStore.nickname || '当前用户' },
]

const statusColor: Record<string, string> = {
  PENDING: 'processing',
  APPROVING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  REVOKED: 'default',
  CANCELED: 'default',
}

const approvalStatusOptions = [
  { label: '待审批', value: 'PENDING' },
  { label: '审批中', value: 'APPROVING' },
  { label: '已同意', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已撤回', value: 'REVOKED' },
  { label: '已取消', value: 'CANCELED' },
]

const instanceColumns = [
  { title: '审批编号', dataIndex: 'code', width: 150 },
  { title: '提交时间', dataIndex: 'submittedAt', width: 130 },
  { title: '财务年度', dataIndex: 'financialYear', width: 110, customRender: ({ record }: any) => approvalFinancialPeriod(record).financialYear || '-' },
  { title: '财务月份', dataIndex: 'financialMonth', width: 110, customRender: ({ record }: any) => approvalFinancialPeriod(record).financialMonth || '-' },
  { title: '审批事项', dataIndex: 'businessType', width: 150 },
  { title: '业务所属部门', dataIndex: 'deptName', width: 150 },
  { title: '审批金额', dataIndex: 'amount', width: 130 },
  { title: '审批说明', dataIndex: 'approvalContent', width: 240 },
  { title: '付款方式', dataIndex: 'paymentMethod', width: 130, customRender: ({ record }: any) => approvalControlValue(record, ['付款方式']) },
  { title: '付款日期', dataIndex: 'paymentDate', width: 130, customRender: ({ record }: any) => approvalControlValue(record, ['付款日期']) },
  { title: '收款账号', dataIndex: 'receivingAccount', width: 190, customRender: ({ record }: any) => approvalControlValue(record, ['收款账号']) },
  { title: '附件', dataIndex: 'attachment', width: 150, customRender: ({ record }: any) => approvalControlValue(record, ['付款凭证附件', '附件']) },
  { title: '申请人', dataIndex: 'applicantName' },
  { title: '审批状态', dataIndex: 'status' },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 180 },
]
const instanceTableColumns = computed(() => enhanceBusinessTableColumns(instanceColumns))
const instanceTableScrollX = computed(() => createBusinessTableScrollX(instanceTableColumns.value, 2100))

const taskColumns = [
  { title: '提交时间', dataIndex: 'submittedAt', width: 130 },
  { title: '审批标题', dataIndex: ['instance', 'title'] },
  { title: '审批内容', dataIndex: 'approvalContent', width: 280 },
  { title: '金额', dataIndex: 'amount', width: 130 },
  { title: '节点', dataIndex: 'nodeName' },
  { title: '审批人', dataIndex: 'assigneeName' },
  { title: '任务状态', dataIndex: 'status' },
  { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 180 },
]
const taskTableColumns = computed(() => enhanceBusinessTableColumns(taskColumns))
const taskTableScrollX = computed(() => createBusinessTableScrollX(taskTableColumns.value, 1000))

const templateColumns = [
  { title: '模板名称', dataIndex: 'name' },
  { title: '适用业务', dataIndex: 'businessTypes', width: 300 },
  { title: '审批流程', dataIndex: 'nodes', width: 420 },
  { title: '启用', dataIndex: 'enabled' },
]
const templateTableColumns = computed(() => enhanceBusinessTableColumns(templateColumns, { noSortFields: ['businessTypes', 'nodes'] }))
const templateTableScrollX = computed(() => createBusinessTableScrollX(templateTableColumns.value, 900))

const businessColumns = [
  { title: '业务类型', dataIndex: 'businessType' },
  { title: '模块编号', dataIndex: 'businessNo' },
  { title: '模块标题', dataIndex: 'title' },
  { title: '业务状态', dataIndex: 'businessStatus' },
  { title: '审批状态', dataIndex: 'approvalStatus' },
  { title: '更新时间', dataIndex: 'updatedAt' },
  { title: '关联操作', dataIndex: 'action', fixed: 'right' as const, width: 150 },
]
const businessTableColumns = computed(() => enhanceBusinessTableColumns(businessColumns))
const businessTableScrollX = computed(() => createBusinessTableScrollX(businessTableColumns.value, 1000))

const businessTypeText: Record<string, string> = {
  expense: '费用报销',
  reimbursement: '费用报销',
  cash_expense: '现金支出',
  office_vehicle_expense: '办公用车费用审批',
  transport_fuel: '燃油费审批',
  transport_etc: 'ETC费审批',
  transport_maintenance: '维保费审批',
  transport_fee: '运输费用',
  vehicle_loan: '车贷审批',
  transport_exception_fee: '异常费用审批',
  payment: '付款申请',
  purchase: '采购申请',
  contract: '合同审批',
  trade_contract: '贸易合同',
  leave: '请假审批',
  overtime: '加班审批',
  travel: '出差审批',
  salary: '工资发放审批',
  attendance_adjustment: '考勤补录审批',
  receipt: '收款登记',
  inventory_adjustment: '库存调整',
  asset_purchase: '资产采购',
  asset_scrap: '资产报废',
  general: '通用审批',
}

function formatBusinessType(record: any) {
  const value = typeof record === 'string' ? record : record?.businessType
  return record?.formSnapshot?.contentOption || record?.payload?.contentOption || record?.formSnapshot?.wecomTemplateName || record?.payload?.wecomTemplateName || (value ? businessTypeText[value] || value : '-')
}

function formatBusinessDomain(record: any) {
  const stored = record?.formSnapshot?.businessDomain || record?.payload?.businessDomain
  if (stored)
    return stored
  const department = String(record?.deptName || '')
  if (/酒店|宾馆/.test(department))
    return '酒店'
  if (/运输|车队|物流/.test(department))
    return '运输'
  if (/贸易|商贸/.test(department))
    return '贸易'
  return '公司'
}

function approvalContent(record: any) {
  const instance = normalizeRecord(record)
  const form = instance?.formSnapshot || instance?.payload || {}
  const parts = [form.contentOption, form.description, form.remark]
    .map(value => String(value ?? '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index)
  if (form.occurredDate)
    parts.push(`日期 ${form.occurredDate}`)
  return parts.join('；') || instance?.title || '-'
}

function approvalControlValue(record: any, titles: string[]) {
  const instance = normalizeRecord(record)
  const form = instance?.formSnapshot || instance?.payload || {}
  const controls = Array.isArray(form.controls) ? form.controls : []
  const control = controls.find((item: any) => titles.includes(String(item?.title || '').trim()))
  const value = control?.value
  if (Array.isArray(value))
    return value.map(item => item?.name || item?.value || item).filter(Boolean).join('、') || '-'
  if (value && typeof value === 'object')
    return [value.accountName, value.accountNumber, value.bankName].filter(Boolean).join(' · ') || '-'
  return value == null || value === '' ? '-' : String(value)
}

function approvalFinancialPeriod(record: any) {
  const instance = normalizeRecord(record)
  const form = instance?.formSnapshot || instance?.payload || {}
  const paymentDate = form.paymentDate || approvalControlValue(instance, ['付款日期'])
  const occurredDate = form.occurredDate || approvalControlValue(instance, ['业务日期', '发生日期', '申请日期', '日期', '业务时间'])
  return resolveApprovalFinancialPeriod(
    [occurredDate === '-' ? '' : occurredDate, paymentDate === '-' ? '' : paymentDate, form.description, instance?.submittedAt],
    form.financialYear || approvalControlValue(instance, ['财务年度']),
    form.financialMonth || approvalControlValue(instance, ['财务月份']),
  )
}

function formatApprovalAmount(record: any) {
  const instance = normalizeRecord(record)
  const value = instance?.amount ?? instance?.formSnapshot?.amount ?? instance?.payload?.amount
  const amount = Number(value)
  if (value == null || value === '' || !Number.isFinite(amount))
    return '-'
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatSubmittedDate(record: any) {
  const instance = normalizeRecord(record)
  const value = instance?.submittedAt
  if (!value)
    return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function templateNodeText(node: any, index: number) {
  const approvers = (node.approverIds || []).map((id: string | number) => getUserDisplayName(id)).join('、')
  return `${index + 1}. ${node.name}${approvers ? `（${approvers}）` : ''}`
}

const approvalTypeOptions = computed(() => approvalTypeConfigs.map(item => ({
  label: item.label,
  value: item.businessType,
  category: item.category,
})))
const currentApprovalType = computed(() => approvalTypeConfigs.find(item => item.businessType === createForm.businessType) ?? approvalTypeConfigs[0])
const currentContentOptions = computed(() => {
  const config = currentApprovalType.value
  if (!config)
    return []
  if (config.category === '人事薪酬类')
    return personnelContentOptions[config.businessType] ?? []
  if (config.category.includes('支出') || ['财务收付款类', '合同采购类', '库存资产类'].includes(config.category))
    return expenseContentOptions[config.businessType] ?? defaultContentOptions.value
  return []
})
const contentOptionLabel = computed(() => currentApprovalType.value?.category === '人事薪酬类' ? '人事/考勤内容' : createForm.businessType === 'receivable' ? '应收业务类型' : '支出内容')
const isReceivableApproval = computed(() => createForm.businessType === 'receivable')

const filteredInstanceList = computed(() => instanceList.value.filter(matchApprovalRecord))
const filteredTodoList = computed(() => todoList.value.filter(matchApprovalRecord))
const filteredDoneList = computed(() => doneList.value.filter(matchApprovalRecord))
const filteredSubmittedList = computed(() => submittedList.value.filter(matchApprovalRecord))
const filteredCcList = computed(() => ccList.value.filter(item => matchApprovalRecord(item.instance ?? item)))
const filteredBusinessRecords = computed(() => businessRecords.value.filter(matchApprovalRecord))
const todoTaskByInstanceId = computed(() => new Map(todoList.value.map(task => [String(task.instanceId), task])))

function todoTaskForInstance(record: Record<string, any>) {
  return todoTaskByInstanceId.value.get(String(record.id))
}

const summaryCards = computed<SummaryCardItem[]>(() => {
  const pendingAmount = calculatePendingApprovalAmount(filteredInstanceList.value)
  return [
    { label: '待我审批', value: filteredTodoList.value.length, hint: '当前审批人待办', tone: 'warning' },
    { label: '我发起的', value: filteredSubmittedList.value.length, hint: '本人提交审批', tone: 'primary' },
    { label: '已审批', value: filteredDoneList.value.length, hint: '已处理任务', tone: 'success' },
    { label: '待审批金额', value: `¥${pendingAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, hint: '按筛选范围估算', tone: 'warning' },
  ]
})

const departmentAmountCards = computed<SummaryCardItem[]>(() =>
  summarizePendingApprovalAmountsByDepartment(filteredInstanceList.value).map(item => ({
    label: item.departmentName,
    value: `¥${item.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    hint: `${item.count} 笔待审`,
    tone: 'warning',
  })),
)

const statusText: Record<string, string> = {
  PENDING: '待审批',
  APPROVING: '审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  REVOKED: '已撤回',
  CANCELED: '已取消',
}

const businessStatusText: Record<string, string> = {
  DRAFT: '草稿',
  APPROVAL_PENDING: '审批中',
  APPROVAL_APPROVED: '已通过',
  APPROVAL_REJECTED: '已驳回',
  APPROVAL_REVOKED: '已撤回',
}

const actionText: Record<string, string> = {
  SUBMIT: '提交审批',
  APPROVE: '同意',
  REJECT: '驳回',
  REVOKE: '撤回',
  TRANSFER: '转交',
  CC: '抄送',
  EXTERNAL_SYNC: '同步企业微信审批',
}

function getBusinessModulePath(record: any) {
  const type = String(record?.businessType || record?.instance?.businessType || '')
  return approvalTypeConfigs.find(item => item.businessType === type)?.modulePath
}

function openBusinessModule(record: any) {
  const path = getBusinessModulePath(record)
  if (!path)
    return message.info('该审批类型暂未配置独立业务页面')
  router.push({ path, query: { approvalInstanceId: record?.approvalInstanceId || record?.id || record?.instance?.id, businessId: record?.businessId || record?.instance?.businessId } })
}

async function pushToWecom(record: any) {
  await pushWecomApprovalApi(record.id)
  message.success('已发起企业微信审批')
}

function canPushToWecom(record: any) {
  return approvalInitiationSource(String(record?.businessType || '')) === 'MANAGEMENT_SYSTEM' && record?.formSnapshot?.source !== '企业微信'
}

function normalizeRecord(record: any) {
  return record?.instance ?? record
}

function matchApprovalRecord(source: any) {
  const record = normalizeRecord(source)
  if (!record)
    return false
  if (queryModel.status && record.status !== queryModel.status && record.approvalStatus !== queryModel.status)
    return false
  const keyword = queryModel.keyword.trim()
  if (keyword && !JSON.stringify(record).includes(keyword))
    return false
  return true
}

function getActiveExportRows() {
  if (activeKey.value === 'todo')
    return filteredTodoList.value.map(item => ({ ...item, ...(item.instance || {}) }))
  if (activeKey.value === 'done')
    return filteredDoneList.value.map(item => ({ ...item, ...(item.instance || {}) }))
  if (activeKey.value === 'submitted')
    return filteredSubmittedList.value
  if (activeKey.value === 'cc')
    return filteredCcList.value.map(item => item.instance)
  if (activeKey.value === 'templates')
    return templateList.value
  if (activeKey.value === 'business')
    return filteredBusinessRecords.value
  return filteredInstanceList.value
}

function exportCurrentApprovalRows() {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
    页面: '审批中心',
    标签: activeKey.value,
    财务年: financialPeriodFilter.financialYear || '',
    财务月: financialPeriodFilter.financialMonth || '',
    起始日期: financialPeriodFilter.dateRange?.[0]?.format('YYYY-MM-DD') || '',
    结束日期: financialPeriodFilter.dateRange?.[1]?.format('YYYY-MM-DD') || '',
    状态: queryModel.status || '',
    关键字: queryModel.keyword || '',
  }]), '筛选条件')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(getActiveExportRows()), '导出数据')
  XLSX.writeFile(workbook, `审批中心_${activeKey.value}_${Date.now()}.xlsx`)
}

const createRules = computed<Record<string, any[]>>(() => ({
  title: [{ required: true, message: '请输入审批名称', trigger: 'blur' }],
  businessType: [{ required: true, message: '请选择审批类型', trigger: 'change' }],
  amount: currentApprovalType.value?.requireAmount ? [{ required: true, type: 'number', message: '请输入审批金额', trigger: 'change' }] : [],
  counterparty: isReceivableApproval.value ? [{ required: true, message: '请输入客户名称', trigger: 'blur' }] : [],
  occurredDate: isReceivableApproval.value ? [{ required: true, message: '请输入业务日期', trigger: 'blur' }] : [],
  dueDate: isReceivableApproval.value ? [{ required: true, message: '请输入到期日期', trigger: 'blur' }] : [],
  attachmentName: currentApprovalType.value?.requireAttachment ? [{ required: true, message: '请导入图片或文件附件', trigger: 'change' }] : [],
  approverIds: [{ required: true, type: 'array', min: 1, message: '请选择至少 1 个审批人员', trigger: 'change' }],
}))

const viewPathMap: Record<string, string> = {
  center: '/oa-approval/center',
  todo: '/oa-approval/todo',
  done: '/oa-approval/done',
  submitted: '/oa-approval/submitted',
  cc: '/oa-approval/cc',
  templates: '/oa-approval/templates',
  business: '/oa-approval/business',
}

function changeView(key: string | number) {
  const path = viewPathMap[String(key)]
  if (path && path !== route.path)
    router.push(path)
}

function updateOperator(value: any) {
  const item = operatorOptions.find(option => option.value === value)
  operator.id = value
  operator.name = item?.name ?? String(value)
}

async function loadAll() {
  loading.value = true
  loadError.value = ''
  try {
    const userId = operator.id
    const periodParams = financialQueryParams.value
    const [instances, todo, done, submitted, cc, templates, records] = await Promise.all([
      getApprovalInstancesApi(periodParams),
      getApprovalTodoApi(userId, periodParams),
      getApprovalDoneApi(userId, periodParams),
      getApprovalSubmittedApi(userStore.userInfo?.id ?? 1, periodParams),
      getApprovalCcApi(userId, periodParams),
      getApprovalTemplatesApi(),
      getApprovalBusinessRecordsApi(periodParams),
    ])
    instanceList.value = instances.data ?? []
    todoList.value = todo.data ?? []
    doneList.value = done.data ?? []
    submittedList.value = submitted.data ?? []
    ccList.value = cc.data ?? []
    templateList.value = templates.data ?? []
    businessRecords.value = records.data ?? []
    const approvalInstanceId = String(route.query.approvalInstanceId || '')
    if (approvalInstanceId && detail.value?.instance?.id !== approvalInstanceId)
      await openDetail(approvalInstanceId)
  }
  catch (error: any) {
    loadError.value = error?.message || '审批数据加载失败，请稍后重试'
    message.error(loadError.value)
  }
  finally {
    loading.value = false
  }
}

function resetFilters() {
  queryModel.status = undefined
  queryModel.keyword = ''
  resetFinancialPeriodFilter()
  loadAll()
}

function resetCreateForm() {
  createForm.businessType = approvalTypeOptions.value[0]?.value ?? 'general'
  createForm.businessId = ''
  createForm.contentOption = undefined
  createForm.amount = undefined
  createForm.counterparty = ''
  createForm.occurredDate = ''
  createForm.dueDate = ''
  createForm.attachmentName = ''
  createForm.attachmentUrl = ''
  createForm.description = ''
  createForm.approverIds = [...(currentApprovalType.value?.defaultApproverIds ?? [])]
  createForm.remark = ''
  syncCreateTitle()
  createFormRef.value?.clearValidate?.()
}

function syncCreateTitle() {
  const config = currentApprovalType.value
  createForm.title = config?.label ?? ''
}

function handleApprovalTypeChange() {
  createForm.businessId = ''
  createForm.contentOption = undefined
  createForm.amount = undefined
  createForm.counterparty = ''
  createForm.occurredDate = ''
  createForm.dueDate = ''
  createForm.attachmentName = ''
  createForm.attachmentUrl = ''
  createForm.approverIds = [...(currentApprovalType.value?.defaultApproverIds ?? [])]
  syncCreateTitle()
  createFormRef.value?.clearValidate?.()
}

async function loadUsers(keyword = '') {
  userLoading.value = true
  try {
    const res = await getUserListApi({ keyword, status: 'enabled' })
    userOptions.value = [...(res.data ?? [])].sort((a, b) => {
      const deptCompare = String(a.deptName ?? '').localeCompare(String(b.deptName ?? ''), 'zh-CN')
      if (deptCompare)
        return deptCompare
      const postCompare = String(a.postName ?? '').localeCompare(String(b.postName ?? ''), 'zh-CN')
      if (postCompare)
        return postCompare
      return String(a.nickname ?? '').localeCompare(String(b.nickname ?? ''), 'zh-CN')
    })
  }
  catch (error: any) {
    message.error(error?.message ?? '获取用户列表失败')
  }
  finally {
    userLoading.value = false
  }
}

function closeCreateApproval() {
  createOpen.value = false
  resetCreateForm()
}

async function openCreateApproval() {
  resetCreateForm()
  createOpen.value = true
  if (!userOptions.value.length)
    await loadUsers()
}

function getUserDisplayName(userId: string | number) {
  const user = userOptions.value.find(item => String(item.id) === String(userId))
  return user?.nickname ?? String(userId)
}

const approvalFlowGroups = computed(() => buildApprovalFlowGroups(detail.value, getUserDisplayName))

function approvalFlowSummary(group: { status: string, approvers: Array<{ status: string }> }) {
  const completed = group.approvers.filter(item => item.status === 'APPROVED').length
  const status = statusText[group.status] || group.status
  return `${status}（${completed}/${group.approvers.length}）`
}

function approvalTimelineColor(status: string) {
  return ({ APPROVED: 'green', REJECTED: 'red', PENDING: 'blue', APPROVING: 'blue' } as Record<string, string>)[status] || 'gray'
}

function formatApprovalTime(value?: string) {
  if (!value)
    return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN')
}

const groupedUserOptions = computed(() => {
  const groups = new Map<string, SystemUser[]>()
  userOptions.value.forEach((item) => {
    const deptName = item.deptName || '未分配部门'
    if (!groups.has(deptName))
      groups.set(deptName, [])
    groups.get(deptName)!.push(item)
  })
  return Array.from(groups.entries()).map(([deptName, users]) => ({ deptName, users }))
})

function beforeUploadApprovalAttachment(file: File) {
  uploadApprovalAttachment(file)
  return false
}

async function uploadApprovalAttachment(file: File) {
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
    createForm.attachmentName = result.data.originalName
    createForm.attachmentUrl = result.data.url
    message.success(`已上传 ${file.name}`)
    createFormRef.value?.clearValidate?.(['attachmentName'])
  }
  catch (error: any) {
    message.error(error?.message || '上传失败')
  }
}

async function submitCreateApproval() {
  if (createSubmitting.value)
    return
  try {
    await createFormRef.value?.validate?.()
    createSubmitting.value = true
    const applicantId = userStore.userInfo?.id ?? 1
    const applicantName = userStore.nickname || '超级管理员'
    const businessNo = `MOD-${createForm.businessType}-${Date.now()}`
    const businessId = businessNo
    const approverNames = createForm.approverIds.map(getUserDisplayName)
    const financialPeriod = resolveApprovalFinancialPeriod([createForm.occurredDate, new Date().toISOString()])
    const templateRes = await createApprovalTemplateApi({
      name: `${createForm.title}审批流程`,
      businessTypes: [createForm.businessType],
      nodes: [
        {
          id: `node-${Date.now()}`,
          name: '审批人员审批',
          order: 1,
          approverType: 'USER',
          approverIds: [...createForm.approverIds],
        },
      ],
    })
    await submitApprovalApi({
      templateId: templateRes.data?.id,
      approvalType: createForm.businessType,
      businessModule: currentApprovalType.value?.moduleName,
      businessType: createForm.businessType,
      businessId,
      businessNo,
      title: createForm.title,
      applicantId,
      applicantName,
      amount: createForm.amount,
      formData: {
        approvalType: currentApprovalType.value?.label,
        category: currentApprovalType.value?.category,
        moduleName: currentApprovalType.value?.moduleName,
        modulePath: currentApprovalType.value?.modulePath,
        contentOption: createForm.contentOption,
        amount: createForm.amount,
        counterparty: createForm.counterparty,
        customerName: createForm.counterparty,
        occurredDate: createForm.occurredDate,
        ...financialPeriod,
        dueDate: createForm.dueDate,
        attachmentName: createForm.attachmentName,
        attachmentUrl: createForm.attachmentUrl,
        description: createForm.description,
        remark: createForm.remark,
        approverIds: [...createForm.approverIds],
        approverNames,
      },
    })
    createOpen.value = false
    message.success('新增审批成功')
    resetCreateForm()
    await loadAll()
  }
  catch (error: any) {
    if (error?.errorFields)
      return
    message.error(error?.message ?? '新增审批失败')
  }
  finally {
    createSubmitting.value = false
  }
}

async function openDetail(instanceId: string) {
  const [res] = await Promise.all([
    getApprovalDetailApi(instanceId),
    userOptions.value.length ? Promise.resolve() : loadUsers(),
  ])
  detail.value = res.data
  detailOpen.value = true
}

async function approveTask(record: any) {
  await approveTaskApi(record.id, {
    operatorId: operator.id,
    operatorName: operator.name,
    comment: '同意',
  })
  message.success('审批通过')
  await loadAll()
}

const detailTodoTask = computed(() => detail.value ? todoTaskByInstanceId.value.get(String(detail.value.instance.id)) : undefined)

async function approveDetailTask() {
  if (!detailTodoTask.value)
    return
  await approveTask(detailTodoTask.value)
  detailOpen.value = false
}

function openSecondaryAction(action: 'reject' | 'transfer') {
  secondaryAction.value = action
  secondaryComment.value = ''
  transferUserId.value = undefined
  secondaryActionOpen.value = true
}

async function submitSecondaryAction() {
  if (secondarySubmitting.value)
    return
  const task = detailTodoTask.value
  if (!task)
    return
  if (!secondaryComment.value.trim())
    return message.warning(secondaryAction.value === 'reject' ? '请填写驳回原因' : '请填写转交说明')
  secondarySubmitting.value = true
  try {
    if (secondaryAction.value === 'reject') {
      await rejectTaskApi(task.id, { operatorId: operator.id, operatorName: operator.name, comment: secondaryComment.value.trim() })
      message.success('已驳回')
    }
    else {
      const target = userOptions.value.find(item => Number(item.id) === Number(transferUserId.value))
      if (!target)
        return message.warning('请选择转交人员')
      await transferTaskApi(task.id, {
        operatorId: operator.id,
        operatorName: operator.name,
        toUserId: Number(target.id),
        toUserName: target.nickname || target.username,
        comment: secondaryComment.value.trim(),
      })
      message.success('已转交')
    }
    secondaryActionOpen.value = false
    detailOpen.value = false
    await loadAll()
  }
  catch (error: any) {
    message.error(error?.message || '审批操作失败')
  }
  finally {
    secondarySubmitting.value = false
  }
}

async function rejectTask(record: any) {
  await rejectTaskApi(record.id, {
    operatorId: operator.id,
    operatorName: operator.name,
    comment: '资料不完整',
  })
  message.success('已驳回')
  await loadAll()
}

async function transferTask(record: any) {
  await transferTaskApi(record.id, {
    operatorId: operator.id,
    operatorName: operator.name,
    toUserId: 3,
    toUserName: '财务经理',
    comment: '转交财务处理',
  })
  message.success('已转交')
  await loadAll()
}

async function revokeInstance(record: any) {
  await revokeApprovalApi(record.id, {
    operatorId: userStore.userInfo?.id ?? 1,
    operatorName: userStore.nickname || '超级管理员',
    comment: '申请人撤回',
  })
  message.success('已撤回')
  await loadAll()
}

async function archiveInstance(record: any) {
  await archiveApprovalApi(record.id, ['PENDING', 'APPROVING'].includes(record.status) ? '管理员删除并撤销审批' : '管理员作废并归档审批')
  message.success(['PENDING', 'APPROVING'].includes(record.status) ? '审批已撤销并删除' : '审批已作废归档')
  await loadAll()
}

watch(() => operator.id, loadAll)
onMounted(async () => {
  await businessDictionaries.load()
  await loadAll()
})
</script>

<template>
  <page-container>
    <a-alert
      v-if="loadError"
      mb-4
      type="error"
      show-icon
      :message="loadError"
    >
      <template #action>
        <a-button size="small" type="link" @click="loadAll">
          重新加载
        </a-button>
      </template>
    </a-alert>

    <SummaryCards :cards="summaryCards" :loading="loading" :data-state="filteredInstanceList.length ? 'ready' : 'empty'" :xl-span="6" compact />
    <section class="department-amount-summary" aria-labelledby="department-amount-title">
      <div id="department-amount-title" class="department-amount-title">
        各业务部门待审批金额
      </div>
      <SummaryCards :cards="departmentAmountCards" :loading="loading" :data-state="filteredInstanceList.length ? 'ready' : 'empty'" :xl-span="6" compact />
    </section>
    <ApprovalInsights :instances="filteredInstanceList" :todo="filteredTodoList" :done="filteredDoneList" />

    <a-card :bordered="false" mb-4>
      <a-row :gutter="[16, 16]" align="middle">
        <a-col :xs="24" :lg="12">
          <div text-20px font-600>
            审批工作台
          </div>
          <div mt-2 c="var(--text-color-secondary)">
            集中处理待办、查看审批进度，并追踪业务单据与企业微信状态。
          </div>
        </a-col>
        <a-col :xs="24" :lg="12">
          <a-space wrap style="justify-content: flex-end; width: 100%;">
            <a-select :value="operator.id" w-180px @change="updateOperator">
              <a-select-option v-for="item in operatorOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </a-select-option>
            </a-select>
            <a-button @click="loadAll">
              <template #icon>
                <ReloadOutlined />
              </template>
              刷新
            </a-button>
            <a-button @click="resetFilters">
              重置
            </a-button>
            <a-button @click="exportCurrentApprovalRows">
              <template #icon>
                <ExportOutlined />
              </template>
              导出表格
            </a-button>
            <a-button @click="router.push('/oa-approval/wecom')">
              <template #icon>
                <CloudSyncOutlined />
              </template>
              查看同步状态
            </a-button>
            <a-button type="primary" @click="openCreateApproval">
              <template #icon>
                <PlusOutlined />
              </template>
              新增审批
            </a-button>
          </a-space>
        </a-col>
      </a-row>
      <a-form mt-4 :label-col="{ span: 7 }">
        <a-row :gutter="[16, 0]">
          <FinancialPeriodFilter v-model="financialPeriodFilter" />
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="状态">
              <a-select v-model:value="queryModel.status" allow-clear placeholder="请选择状态">
                <a-select-option v-for="item in approvalStatusOptions" :key="item.value" :value="item.value">
                  {{ item.label }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="6">
            <a-form-item label="关键字">
              <a-input v-model:value="queryModel.keyword" allow-clear placeholder="搜索标题、模块编号、申请人" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <a-card :bordered="false">
      <a-tabs :active-key="activeKey" @change="changeView">
        <a-tab-pane key="center" tab="审批中心">
          <a-table row-key="id" :loading="loading" :columns="instanceTableColumns" :data-source="filteredInstanceList" :scroll="{ x: instanceTableScrollX }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'status'">
                <a-tag :color="statusColor[record.status]">
                  {{ statusText[record.status] || record.status }}
                </a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'businessType'">
                {{ formatBusinessType(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'businessDomain'">
                <a-tag>{{ formatBusinessDomain(record) }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'approvalContent'">
                <a-tooltip :title="approvalContent(record)">
                  <span class="approval-content-cell">{{ approvalContent(record) }}</span>
                </a-tooltip>
              </template>
              <template v-else-if="column.dataIndex === 'amount'">
                {{ formatApprovalAmount(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'submittedAt'">
                {{ formatSubmittedDate(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'financialYear'">
                {{ approvalFinancialPeriod(record).financialYear || '-' }}
              </template>
              <template v-else-if="column.dataIndex === 'financialMonth'">
                {{ approvalFinancialPeriod(record).financialMonth || '-' }}
              </template>
              <template v-else-if="column.dataIndex === 'paymentMethod'">
                {{ record.formSnapshot?.paymentMethod || approvalControlValue(record, ['付款方式']) }}
              </template>
              <template v-else-if="column.dataIndex === 'paymentDate'">
                {{ record.formSnapshot?.paymentDate || approvalControlValue(record, ['付款日期']) }}
              </template>
              <template v-else-if="column.dataIndex === 'receivingAccount'">
                {{ record.formSnapshot?.receivingAccount ? [record.formSnapshot.receivingAccount.accountName, record.formSnapshot.receivingAccount.accountNumber].filter(Boolean).join(' · ') : approvalControlValue(record, ['收款账户', '收款账号']) }}
              </template>
              <template v-else-if="column.dataIndex === 'attachment'">
                {{ record.formSnapshot?.attachmentName || approvalControlValue(record, ['付款凭证附件', '附件']) }}
              </template>
              <template v-else-if="column.dataIndex === 'action'">
                <a-space>
                  <a @click="openDetail(record.id)">查看</a>
                  <a-dropdown v-if="todoTaskForInstance(record)">
                    <a @click.prevent>审核</a>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item @click="approveTask(todoTaskForInstance(record))">
                          通过
                        </a-menu-item>
                        <a-menu-item @click="rejectTask(todoTaskForInstance(record))">
                          驳回
                        </a-menu-item>
                        <a-menu-item @click="transferTask(todoTaskForInstance(record))">
                          转交
                        </a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                  <a v-if="getBusinessModulePath(record)" @click="openBusinessModule(record)">业务单据</a>
                  <a-dropdown>
                    <a @click.prevent>更多</a>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item v-if="canPushToWecom(record)" @click="pushToWecom(record)">
                          发起企业微信审批
                        </a-menu-item>
                        <a-menu-item v-if="['PENDING', 'APPROVING'].includes(record.status)">
                          <a-popconfirm
                            title="确定撤回该审批？"
                            ok-text="确定"
                            cancel-text="取消"
                            @confirm="revokeInstance(record)"
                          >
                            <span>撤回</span>
                          </a-popconfirm>
                        </a-menu-item>
                        <a-menu-item v-if="isAdmin" danger>
                          <a-popconfirm
                            :title="['PENDING', 'APPROVING'].includes(record.status) ? '删除后将撤销审批并回写原模块，确定继续？' : '已完成审批将保留审计记录并作废归档，确定继续？'"
                            ok-text="确定"
                            cancel-text="取消"
                            @confirm="archiveInstance(record)"
                          >
                            <span>{{ ['PENDING', 'APPROVING'].includes(record.status) ? '删除' : '作废归档' }}</span>
                          </a-popconfirm>
                        </a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
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
        </a-tab-pane>
        <a-tab-pane key="done" tab="已办审批">
          <a-table row-key="id" :loading="loading" :columns="taskTableColumns" :data-source="filteredDoneList" :scroll="{ x: taskTableScrollX }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'status'">
                <a-tag :color="statusColor[record.status]">
                  {{ statusText[record.status] || record.status }}
                </a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'businessType'">
                {{ formatBusinessType(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'businessDomain'">
                <a-tag>{{ formatBusinessDomain(record) }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'approvalContent'">
                <a-tooltip :title="approvalContent(record)">
                  <span class="approval-content-cell">{{ approvalContent(record) }}</span>
                </a-tooltip>
              </template>
              <template v-else-if="column.dataIndex === 'amount'">
                {{ formatApprovalAmount(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'submittedAt'">
                {{ formatSubmittedDate(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'action'">
                <a-space>
                  <a @click="openDetail(record.instanceId)">查看</a>
                  <a disabled>审核</a>
                  <a-dropdown disabled>
                    <a @click.prevent>更多</a>
                  </a-dropdown>
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
        </a-tab-pane>
        <a-tab-pane key="submitted" tab="我发起的">
          <a-table row-key="id" :loading="loading" :columns="instanceTableColumns" :data-source="filteredSubmittedList" :scroll="{ x: instanceTableScrollX }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'status'">
                <a-tag :color="statusColor[record.status]">
                  {{ statusText[record.status] || record.status }}
                </a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'businessType'">
                {{ formatBusinessType(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'businessDomain'">
                <a-tag>{{ formatBusinessDomain(record) }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'approvalContent'">
                <a-tooltip :title="approvalContent(record)">
                  <span class="approval-content-cell">{{ approvalContent(record) }}</span>
                </a-tooltip>
              </template>
              <template v-else-if="column.dataIndex === 'amount'">
                {{ formatApprovalAmount(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'submittedAt'">
                {{ formatSubmittedDate(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'action'">
                <a-space>
                  <a @click="openDetail(record.id)">查看</a>
                  <a disabled>审核</a>
                  <a-dropdown>
                    <a @click.prevent>更多</a>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item v-if="['PENDING', 'APPROVING'].includes(record.status)">
                          <a-popconfirm
                            title="确定撤回该审批？"
                            ok-text="确定"
                            cancel-text="取消"
                            @confirm="revokeInstance(record)"
                          >
                            <span>撤回</span>
                          </a-popconfirm>
                        </a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
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
        </a-tab-pane>
        <a-tab-pane key="cc" tab="抄送我的">
          <a-table row-key="id" :loading="loading" :columns="instanceTableColumns" :data-source="filteredCcList.map(item => item.instance)" :scroll="{ x: instanceTableScrollX }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'status'">
                <a-tag :color="statusColor[record.status]">
                  {{ statusText[record.status] || record.status }}
                </a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'businessType'">
                {{ formatBusinessType(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'businessDomain'">
                <a-tag>{{ formatBusinessDomain(record) }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'approvalContent'">
                <a-tooltip :title="approvalContent(record)">
                  <span class="approval-content-cell">{{ approvalContent(record) }}</span>
                </a-tooltip>
              </template>
              <template v-else-if="column.dataIndex === 'amount'">
                {{ formatApprovalAmount(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'submittedAt'">
                {{ formatSubmittedDate(record) }}
              </template>
              <template v-else-if="column.dataIndex === 'action'">
                <a-space>
                  <a @click="openDetail(record.id)">查看</a>
                  <a disabled>审核</a>
                  <a-dropdown disabled>
                    <a @click.prevent>更多</a>
                  </a-dropdown>
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
        </a-tab-pane>
        <a-tab-pane key="templates" tab="审批模板">
          <a-table row-key="id" :loading="loading" :columns="templateTableColumns" :data-source="templateList" :scroll="{ x: templateTableScrollX }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'businessTypes'">
                <a-space wrap>
                  <a-tag v-for="item in record.businessTypes" :key="item">
                    {{ formatBusinessType(item) }}
                  </a-tag>
                </a-space>
              </template>
              <template v-else-if="column.dataIndex === 'nodes'">
                <div class="template-flow-cell">
                  <div v-for="(node, index) in record.nodes" :key="node.id">
                    {{ templateNodeText(node, Number(index)) }}
                  </div>
                </div>
              </template>
              <template v-else-if="column.dataIndex === 'enabled'">
                <a-tag :color="record.enabled ? 'success' : 'default'">
                  {{ record.enabled ? '启用' : '停用' }}
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
        </a-tab-pane>
        <a-tab-pane key="business" tab="模块回写">
          <a-table row-key="businessId" :loading="loading" :columns="businessTableColumns" :data-source="filteredBusinessRecords" :scroll="{ x: businessTableScrollX }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'businessType'">
                {{ formatBusinessType(record.businessType) }}
              </template>
              <template v-else-if="column.dataIndex === 'approvalStatus'">
                <a-tag :color="statusColor[record.approvalStatus]">
                  {{ statusText[record.approvalStatus] || record.approvalStatus }}
                </a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'action'">
                <a-space>
                  <a v-if="record.approvalInstanceId" @click="openDetail(record.approvalInstanceId)">审批详情</a>
                  <a v-if="getBusinessModulePath(record)" @click="openBusinessModule(record)">业务单据</a>
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
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <a-modal
      v-model:open="createOpen"
      title="新增审批"
      width="760px"
      ok-text="提交"
      cancel-text="取消"
      :mask-closable="false"
      :confirm-loading="createSubmitting"
      :closable="!createSubmitting"
      :keyboard="!createSubmitting"
      :cancel-button-props="{ disabled: createSubmitting }"
      @ok="submitCreateApproval"
      @cancel="closeCreateApproval"
    >
      <a-form ref="createFormRef" :model="createForm" :rules="createRules" layout="vertical">
        <a-form-item label="审批类型" name="businessType">
          <a-select
            v-model:value="createForm.businessType"
            show-search
            placeholder="搜索或选择审批类型"
            :filter-option="(input: string, option: any) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())"
            @change="handleApprovalTypeChange"
          >
            <a-select-option v-for="item in approvalTypeOptions" :key="item.value" :value="item.value" :label="`${item.category} / ${item.label}`">
              {{ item.category }} / {{ item.label }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="审批名称" name="title">
          <a-input v-model:value="createForm.title" placeholder="选择审批类型后自动生成" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :xs="24" :md="12">
            <a-form-item label="对应模块">
              <a-input :value="currentApprovalType?.moduleName || '无需绑定业务模块'" disabled />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="模块路径">
              <a-input :value="currentApprovalType?.modulePath || '-'" disabled />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col v-if="currentContentOptions.length" :xs="24" :md="12">
            <a-form-item :label="contentOptionLabel">
              <a-select
                v-model:value="createForm.contentOption"
                allow-clear
                :placeholder="`请选择${contentOptionLabel}`"
                :options="currentContentOptions.map(item => ({ label: item, value: item }))"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item v-if="currentApprovalType?.requireAmount" label="审批金额" name="amount">
              <business-input-number v-model:value="createForm.amount" :min="0" :precision="2" prefix="¥" style="width: 100%;" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item v-if="currentApprovalType?.requireAttachment" label="附件" name="attachmentName">
              <a-upload :show-upload-list="false" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" :before-upload="beforeUploadApprovalAttachment">
                <a-button>
                  <template #icon>
                    <UploadOutlined />
                  </template>
                  导入图片/文件
                </a-button>
              </a-upload>
              <div v-if="createForm.attachmentName" mt-2 text-13px c="var(--text-color-secondary)">
                {{ createForm.attachmentName }}
              </div>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="isReceivableApproval" :gutter="16">
          <a-col :xs="24" :md="12">
            <a-form-item label="客户名称" name="counterparty">
              <a-input v-model:value="createForm.counterparty" placeholder="请输入客户或欠款单位" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="业务日期" name="occurredDate">
              <a-date-picker v-model:value="createForm.occurredDate" value-format="YYYY-MM-DD" format="YYYY-MM-DD" :allow-clear="false" style="width: 100%;" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="到期日期" name="dueDate">
              <a-date-picker v-model:value="createForm.dueDate" value-format="YYYY-MM-DD" format="YYYY-MM-DD" style="width: 100%;" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="审批说明" name="description">
          <a-textarea v-model:value="createForm.description" :placeholder="currentApprovalType?.descriptionPlaceholder || '请输入审批说明'" :rows="3" />
        </a-form-item>
        <a-form-item label="审批人员" name="approverIds">
          <a-select
            v-model:value="createForm.approverIds"
            mode="multiple"
            show-search
            placeholder="从组织架构在职人员中选择审批人"
            :loading="userLoading"
            :filter-option="false"
            @search="loadUsers"
            @focus="() => !userOptions.length && loadUsers()"
          >
            <a-select-opt-group v-for="group in groupedUserOptions" :key="group.deptName" :label="group.deptName">
              <a-select-option v-for="item in group.users" :key="item.id" :value="item.id">
                <div>
                  <span>{{ item.nickname }}</span>
                  <span ml-2 c="var(--text-color-secondary)">
                    {{ item.postName || '未分配岗位' }} / {{ item.roles?.join('、') || '普通用户' }}
                  </span>
                </div>
                <div text-12px c="var(--text-color-secondary)">
                  {{ item.username }} {{ item.mobile }}
                </div>
              </a-select-option>
            </a-select-opt-group>
          </a-select>
        </a-form-item>
        <a-form-item label="备注" name="remark">
          <a-textarea v-model:value="createForm.remark" placeholder="请输入备注" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-drawer v-model:open="detailOpen" title="审批详情" width="760">
      <template v-if="detail">
        <div class="detail-toolbar">
          <div>
            <div text-16px font-600>
              {{ detail.instance.title }}
            </div>
            <div mt-1 text-13px c="var(--text-color-secondary)">
              {{ detail.instance.code }} · {{ formatBusinessDomain(detail.instance) }} · {{ formatBusinessType(detail.instance) }}
            </div>
          </div>
          <a-space>
            <a-button v-if="getBusinessModulePath(detail.instance)" @click="openBusinessModule(detail.instance)">
              业务单据
            </a-button>
            <a-button v-if="canPushToWecom(detail.instance)" type="primary" @click="pushToWecom(detail.instance)">
              <template #icon>
                <CloudSyncOutlined />
              </template>发起企业微信审批
            </a-button>
          </a-space>
        </div>
        <a-descriptions bordered size="small" :column="2">
          <a-descriptions-item label="审批单号">
            {{ detail.instance.code }}
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="statusColor[detail.instance.status]">
              {{ statusText[detail.instance.status] || detail.instance.status }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="财务年度">
            {{ approvalFinancialPeriod(detail.instance).financialYear || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="财务月份">
            {{ approvalFinancialPeriod(detail.instance).financialMonth || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="业务类型">
            {{ formatBusinessType(detail.instance) }}
          </a-descriptions-item>
          <a-descriptions-item label="所属业务">
            {{ formatBusinessDomain(detail.instance) }}
          </a-descriptions-item>
          <a-descriptions-item label="所属部门">
            {{ detail.instance.deptName || detail.instance.formSnapshot?.departmentName || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="业务单号">
            {{ detail.instance.businessNo }}
          </a-descriptions-item>
          <a-descriptions-item label="业务状态">
            {{ businessStatusText[detail.business?.businessStatus] || detail.business?.businessStatus || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="申请人">
            {{ detail.instance.applicantName }}
          </a-descriptions-item>
          <a-descriptions-item v-if="detail.instance.formSnapshot?.contentOption" label="内容分类">
            {{ detail.instance.formSnapshot.contentOption }}
          </a-descriptions-item>
          <a-descriptions-item v-if="detail.instance.amount != null" label="申请金额">
            ¥{{ Number(detail.instance.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
          </a-descriptions-item>
          <a-descriptions-item v-if="detail.instance.formSnapshot?.occurredDate" label="发生日期">
            {{ detail.instance.formSnapshot.occurredDate }}
          </a-descriptions-item>
          <a-descriptions-item v-if="detail.instance.formSnapshot?.description" label="申请事由" :span="2">
            {{ detail.instance.formSnapshot.description }}
          </a-descriptions-item>
          <a-descriptions-item v-if="detail.instance.formSnapshot?.remark" label="备注" :span="2">
            {{ detail.instance.formSnapshot.remark }}
          </a-descriptions-item>
          <a-descriptions-item v-if="detail.instance.formSnapshot?.source" label="数据来源">
            {{ detail.instance.formSnapshot.source }}
          </a-descriptions-item>
          <a-descriptions-item v-if="detail.instance.formSnapshot?.wecomSpNo" label="企业微信审批单号">
            {{ detail.instance.formSnapshot.wecomSpNo }}
          </a-descriptions-item>
        </a-descriptions>

        <a-divider>审批节点</a-divider>
        <div v-if="approvalFlowGroups.length" class="approval-flow-list">
          <section v-for="group in approvalFlowGroups" :key="group.key" class="approval-flow-group">
            <div class="approval-flow-heading">
              <span>{{ group.title }}</span>
              <a-tag :color="statusColor[group.status]">
                {{ approvalFlowSummary(group) }}
              </a-tag>
            </div>
            <a-timeline class="approval-people-list">
              <a-timeline-item v-for="approver in group.approvers" :key="approver.key" :color="approvalTimelineColor(approver.status)">
                <div class="approval-person-row">
                  <strong>{{ approver.name }}</strong>
                  <span>{{ statusText[approver.status] || approver.status }} · {{ formatApprovalTime(approver.actedAt) }}</span>
                </div>
                <div v-if="approver.comment" class="approval-person-comment">
                  {{ approver.comment }}
                </div>
              </a-timeline-item>
            </a-timeline>
          </section>
        </div>
        <a-empty v-else description="暂无审批节点" />

        <a-divider>审批日志</a-divider>
        <a-timeline>
          <a-timeline-item v-for="log in detail.logs" :key="log.id">
            {{ new Date(log.createdAt).toLocaleString('zh-CN') }} · {{ log.operatorName }} · {{ actionText[log.action] || log.action }} · {{ log.comment || '' }}
          </a-timeline-item>
        </a-timeline>
      </template>
      <template v-if="detailTodoTask" #footer>
        <div class="approval-drawer-footer">
          <span>当前操作将记录到审批日志</span>
          <a-space>
            <a-button danger @click="openSecondaryAction('reject')">
              驳回
            </a-button>
            <a-button @click="openSecondaryAction('transfer')">
              转交
            </a-button>
            <a-button type="primary" @click="approveDetailTask">
              同意
            </a-button>
          </a-space>
        </div>
      </template>
    </a-drawer>

    <a-modal
      v-model:open="secondaryActionOpen"
      :title="secondaryAction === 'reject' ? '驳回审批' : '转交审批'"
      width="480px"
      :ok-text="secondaryAction === 'reject' ? '确认驳回' : '确认转交'"
      :confirm-loading="secondarySubmitting"
      :mask-closable="!secondarySubmitting"
      :closable="!secondarySubmitting"
      :keyboard="!secondarySubmitting"
      :cancel-button-props="{ disabled: secondarySubmitting }"
      :ok-button-props="{ danger: secondaryAction === 'reject' }"
      @ok="submitSecondaryAction"
    >
      <a-form layout="vertical">
        <a-form-item v-if="secondaryAction === 'transfer'" label="转交人员" required>
          <a-select v-model:value="transferUserId" show-search option-filter-prop="label" placeholder="请选择接收人">
            <a-select-option v-for="item in userOptions" :key="item.id" :value="Number(item.id)" :label="`${item.nickname || item.username} ${item.deptName || ''}`">
              {{ item.nickname || item.username }} · {{ item.deptName || '未分配部门' }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="secondaryAction === 'reject' ? '驳回原因' : '转交说明'" required>
          <a-textarea v-model:value="secondaryComment" :rows="4" :maxlength="300" show-count />
        </a-form-item>
      </a-form>
    </a-modal>
  </page-container>
</template>

<style scoped lang="less">
.department-amount-summary {
  margin-bottom: 16px;

  :deep(.summary-cards) {
    margin-bottom: 0;
  }
}

.department-amount-title {
  margin-bottom: 10px;
  color: var(--admin-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border-secondary);
}
.approval-flow-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.approval-flow-group {
  padding-bottom: 4px;
}
.approval-flow-heading,
.approval-person-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.approval-flow-heading {
  margin-bottom: 14px;
  font-weight: 600;
}
.approval-people-list {
  margin-left: 6px;
}
.approval-person-row > span,
.approval-person-comment {
  color: var(--admin-muted);
  font-size: 13px;
}
.approval-person-comment {
  margin-top: 4px;
}
.approval-drawer-footer {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}
.approval-drawer-footer > span {
  color: var(--admin-muted);
  font-size: 12px;
}

.approval-content-cell {
  display: -webkit-box;
  overflow: hidden;
  line-height: 20px;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.template-flow-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 20px;
  white-space: normal;
}

@media (max-width: 640px) {
  .detail-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .approval-drawer-footer {
    align-items: flex-start;
    flex-direction: column;
  }
  .approval-person-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }
}
</style>

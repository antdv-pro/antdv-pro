<script setup lang="ts">
/* eslint-disable ts/no-use-before-define -- lazy computed callbacks resolve after setup initialization */
import type { FinanceReconciliationResult } from '~@/api/approval'
import type { SummaryCardItem } from '~@/components/summary-cards/index.vue'
import { Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { allocateReceiptApi, confirmPaymentApi, createPaymentApi, failPaymentApi, generateSalaryPeriodApi, getApprovalBusinessRecordsApi, getFinanceReconciliationApi, getOaModuleStateApi, getSalaryTemplatesApi, reconcileFinanceRecordsApi, registerReceiptApi, saveOaModulePartitionApi, saveSalaryTemplateApi, submitPaymentApi } from '~@/api/approval'
import { getSystemOrganizationsApi, getSystemUsersApi } from '~@/api/system'
import FinancialPeriodFilter from '~@/components/financial-period-filter/index.vue'
import SummaryCards from '~@/components/summary-cards/index.vue'
import { useBusinessDictionaries } from '~@/composables/business-dictionaries'
import { useFinancialPeriodFilter } from '~@/composables/financial-period-filter'
import { createBusinessTableScrollX } from '~@/utils/business-table'
import { calculateActualCashTrend, calculateFinanceDashboardMetrics, latestCashBalance } from '~@/utils/finance-dashboard'
import { isSalaryEligibleEmployee, isSystemAdministratorSalary } from '~@/utils/salary-organization'
import { APPROVAL_BUSINESS_MAP, approvalOaModuleKey } from '../../../shared/approval-business-catalog'
import { calculateSalary } from '../../../shared/salary-calculation'
import CashBalanceView from './components/cash-balance-view.vue'
import FinanceAgingInsights from './components/finance-aging-insights.vue'
import FinanceWorkflowView from './components/finance-workflow-view.vue'
import OaBusinessTable from './components/oa-business-table.vue'
import OaDashboardView from './components/oa-dashboard-view.vue'
import OrgManagementView from './components/org-management-view.vue'
import SalaryWorkspaceControls from './components/salary-workspace-controls.vue'

type ModuleKey = 'dashboard' | 'receivable' | 'cash' | 'salary' | 'org' | 'vehicle'
type MoneyField = 'amount' | 'paidAmount' | 'unpaidAmount' | 'openingBalance' | 'incomeAmount' | 'expenseAmount' | 'currentBalance' | 'basicSalary' | 'performanceSalary' | 'allowance' | 'deduction' | 'socialSecurity' | 'tax' | 'grossSalary' | 'netSalary' | 'fuelFee' | 'tollFee' | 'parkingFee' | 'maintenanceFee' | 'insuranceFee' | 'inspectionFee' | 'otherFee' | 'totalFee'

interface RecordActionItem {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  hidden?: boolean
  confirm?: boolean
  confirmTitle?: string
  onClick: () => unknown | Promise<unknown>
}

interface OaRecord extends Record<string, any> {
  id: string
  code: string
  status: string
  date: string
  financialYear: number
  financialMonth: number
  amount?: number
  createdBy?: string | number
  approverId?: string | number
}

interface CashBalanceRecord {
  id: string
  balance_date: string
  company_name: string
  bank_name: string
  account_name: string
  account_no_tail: string
  balance_amount: number
  remark?: string
  created_by?: string | number
  created_at: string
  updated_by?: string | number
  updated_at: string
  balanceMovements?: Array<Record<string, any>>
}

type CashBalanceDraft = Omit<CashBalanceRecord, 'id' | 'updated_by' | 'updated_at'> & { created_at?: string }

interface ModuleProfile {
  key: ModuleKey
  title: string
  description: string
  keywordPlaceholder: string
  importable?: boolean
  columns: Array<{ title: string, dataIndex: string, width?: number, fixed?: 'left' | 'right', ellipsis?: boolean }>
  rows: OaRecord[]
}

const props = defineProps<{ moduleKey?: ModuleKey }>()
const businessDictionaries = useBusinessDictionaries()

const moneyFields = new Set<string>([
  'amount',
  'paidAmount',
  'unpaidAmount',
  'openingBalance',
  'incomeAmount',
  'expenseAmount',
  'currentBalance',
  'recognizedAmount',
  'unrecognizedAmount',
  'paymentAmount',
  'basicSalary',
  'performanceSalary',
  'attendanceSalary',
  'senioritySalary',
  'overtimeAllowance',
  'travelAllowance',
  'retroactiveSalary',
  'totalAmount',
  'socialSecurityBase',
  'companyPension',
  'companyMedical',
  'companyInjury',
  'companyUnemployment',
  'companySocialSecurityTotal',
  'personalPension',
  'personalMedical',
  'personalInjury',
  'personalUnemployment',
  'personalSocialSecurityTotal',
  'allowance',
  'deduction',
  'socialSecurity',
  'tax',
  'grossSalary',
  'netSalary',
  'fuelFee',
  'tollFee',
  'parkingFee',
  'maintenanceFee',
  'insuranceFee',
  'inspectionFee',
  'otherFee',
  'totalFee',
])

const route = useRoute()
const router = useRouter()
const message = useMessage()
const userStore = useUserStore()
const isSalaryRoute = props.moduleKey === 'salary' || route.path === '/oa-approval/salary'
const salaryDefaultPeriod = () => isSalaryRoute ? { financialMonth: dayjs().month() + 1 } : undefined
const { model: financialPeriodFilter, resetFinancialPeriodFilter } = useFinancialPeriodFilter(salaryDefaultPeriod())
const loading = ref(false)
const loadError = ref('')
const saving = ref(false)
const reconciliationLoading = ref(false)
const financeReconciliation = ref<FinanceReconciliationResult>({ approvedCount: 0, missingCount: 0, missing: [] })

const statusOptions = ['草稿', '待审批', '审批中', '审批通过', '审批驳回', '已同意', '已驳回', '已撤回', '待支付', '银行处理中', '已支付', '支付失败', '未认领', '部分认领', '已核销', '已结清', '已逾期', '已发放', '未发放', '使用中', '空闲', '已完成', '已归档', '已作废', '作废']
const queryModel = reactive({
  status: undefined as string | undefined,
  keyword: '',
  orgDepartment: undefined as string | undefined,
  orgPosition: undefined as string | undefined,
  orgRole: undefined as string | undefined,
  companyName: undefined as string | undefined,
  payStatus: undefined as string | undefined,
  hireDateRange: undefined as [dayjs.Dayjs, dayjs.Dayjs] | undefined,
})
const pagination = reactive({
  current: 1,
  pageSize: 10,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  onChange(current: number, pageSize: number) {
    pagination.current = current
    pagination.pageSize = pageSize
  },
})
const detailOpen = ref(false)
const editOpen = ref(false)
const detailRecord = ref<OaRecord>()
const editingRecord = ref<OaRecord>()
const salaryInlineEditingId = ref('')
const salaryInlineSnapshot = ref<OaRecord>()
const salaryActiveTab = ref<'records' | 'templates'>('records')
const salaryTemplateOpen = ref(false)
const salaryAutoGenerating = ref(false)
const salaryAutoGenerationError = ref('')
let salaryAutoGenerationReady = false
let salaryAutoGenerationRequestId = 0
const salaryTemplateSaving = ref(false)
const salaryTemplateForm = reactive<Record<string, any>>({
  companyName: '',
  department: '',
  position: '',
  basicSalary: 0,
  performanceSalary: 0,
  senioritySalary: 0,
  overtimeAllowance: 0,
  travelAllowance: 0,
  retroactiveSalary: 0,
  socialSecurityBase: 0,
  tax: 0,
  absenceDeductionPerDay: 0,
  housingFundBase: 0,
  companyHousingFundRatePercent: 0,
  personalHousingFundRatePercent: 0,
  effectiveDate: dayjs().format('YYYY-MM-DD'),
  remark: '',
})
const salaryTemplates = ref<Array<Record<string, any>>>([])
const orgActiveTab = ref<'employees' | 'positions' | 'departments'>('employees')
const orgTreeKeyword = ref('')
const selectedOrgKey = ref('ORG001')
const DEFAULT_COMPANY_NAME = '青海诚捷运输有限公司'
const orgFormOpen = ref(false)
const orgFormType = ref<'部门' | '岗位' | '员工'>('员工')
const orgFormMode = ref<'create' | 'edit'>('create')
const orgForm = reactive<OaRecord>(createOrgForm('员工'))
const roleModalOpen = ref(false)
const approverModalOpen = ref(false)
const orgActionRecord = ref<OaRecord>()
const cashBalanceOpen = ref(false)
const receiptOpen = ref(false)
const receiptAllocationOpen = ref(false)
const allocatingReceipt = ref<OaRecord>()
const receiptForm = reactive({
  cashBalanceId: '',
  accountName: '',
  amount: 0,
  receiptDate: dayjs().format('YYYY-MM-DD'),
  payerName: '',
  bankSerialNo: '',
  accountType: '银行账户',
  receiptType: '应收回款',
  remark: '',
})
const receiptAllocationRows = ref<Array<{ receivableId: string, amount: number, remark: string }>>([])
const receiptAllocationCashBalanceId = ref('')
const receiptAllocationBatchId = ref('')
const cashBalanceHistoryOpen = ref(false)
const activeCashBalance = ref<CashBalanceRecord>()
const paymentOpen = ref(false)
const paymentConfirmOpen = ref(false)
const paymentFailOpen = ref(false)
const activePayment = ref<OaRecord>()
const paymentForm = reactive({
  paymentRequestNo: '',
  cashBalanceId: '',
  companyName: '',
  accountName: '',
  accountNo: '',
  paymentDate: dayjs().format('YYYY-MM-DD'),
  payeeName: '',
  accountType: '银行账户',
  paymentMethod: '银行转账',
  remark: '',
})
const paymentAllocationRows = ref<Array<{ payableId: string, amount: number, remark: string }>>([])
const paymentConfirmForm = reactive({ bankSerialNo: '', paidAt: dayjs().format('YYYY-MM-DD HH:mm:ss') })
const paymentFailureReason = ref('')
const batchBalanceOpen = ref(false)
const batchConfirmOpen = ref(false)
const editingBalanceId = ref('')
const cashBalanceQuery = reactive({
  balance_date: '',
  company_name: '',
  bank_name: '',
})
const cashBalanceForm = reactive({
  balance_date: dayjs().format('YYYY-MM-DD'),
  company_name: '',
  bank_name: '',
  account_name: '',
  account_no_tail: '',
  balance_amount: 0,
  remark: '',
})
const batchBalanceRows = ref<CashBalanceDraft[]>([])
const cashBalanceRecords = ref<CashBalanceRecord[]>([])
const receiptCashAccounts = computed(() => cashBalanceRecords.value)
const selectedReceiptCashAccount = computed(() => cashBalanceRecords.value.find(row => row.id === receiptForm.cashBalanceId))
const selectedReceiptAllocationCashAccount = computed(() => cashBalanceRecords.value.find(row => row.id === receiptAllocationCashBalanceId.value))
const paymentCashAccounts = computed(() => cashBalanceRecords.value.filter(row => Number(row.balance_amount || 0) >= 0))
const paymentCompanyOptions = computed(() => [...new Set(paymentCashAccounts.value.map(row => row.company_name))].filter(Boolean))
const paymentAccountOptions = computed(() => paymentCashAccounts.value.filter(row => row.company_name === paymentForm.companyName))
const selectedPaymentCashAccount = computed(() => cashBalanceRecords.value.find(row => row.id === paymentForm.cashBalanceId))
const oaStateRevision = ref(0)

const currentUser = computed(() => userStore.userInfo)
const currentUserId = computed(() => currentUser.value?.id ?? 1)
const canViewSensitive = computed(() => {
  const roles = currentUser.value?.roles?.map(String) ?? []
  return roles.includes('admin') || roles.includes('ADMIN') || roles.includes('FINANCE_MANAGER') || userStore.nickname === '超级管理员'
})
const canManageCashBalance = computed(() => {
  const roles = currentUser.value?.roles?.map(String) ?? []
  return roles.includes('admin') || roles.includes('ADMIN') || roles.includes('FINANCE_MANAGER') || userStore.nickname === '超级管理员'
})

function money(value: unknown) {
  const number = Number(value ?? 0)
  if (!canViewSensitive.value)
    return '¥****'
  return `¥${number.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function plainMoney(value: unknown) {
  return Number(value ?? 0).toFixed(2)
}

function percent(value: number, total: number) {
  if (!total)
    return 0
  return Math.round((value / total) * 100)
}

const moduleProfiles = reactive<Record<ModuleKey, ModuleProfile>>({
  dashboard: {
    key: 'dashboard',
    title: '财务看板',
    description: '分开查看实际现金收支、应收应付计划、账户余额和待处理审批。',
    keywordPlaceholder: '搜索审批、单位、账户或备注',
    columns: [
      { title: '审批单号', dataIndex: 'code', width: 150 },
      { title: '审批类型', dataIndex: 'approvalType', width: 120 },
      { title: '申请人', dataIndex: 'applicant', width: 100 },
      { title: '金额', dataIndex: 'amount', width: 120 },
      { title: '审批状态', dataIndex: 'status', width: 110 },
      { title: '提交时间', dataIndex: 'date', width: 140 },
      { title: '备注', dataIndex: 'remark', ellipsis: true },
    ],
    rows: [],
  },
  receivable: {
    key: 'receivable',
    title: '应收应付',
    description: '管理往来单位应收款、应付款、到期、逾期和结清状态。',
    keywordPlaceholder: '搜索单据编号、往来单位或备注',
    importable: true,
    columns: [
      { title: '单据编号', dataIndex: 'code', width: 150 },
      { title: '往来单位', dataIndex: 'counterparty', width: 170 },
      { title: '类型', dataIndex: 'billType', width: 90 },
      { title: '金额', dataIndex: 'amount', width: 120 },
      { title: '已收/已付', dataIndex: 'paidAmount', width: 120 },
      { title: '未收/未付', dataIndex: 'unpaidAmount', width: 120 },
      { title: '到期日期', dataIndex: 'dueDate', width: 120 },
      { title: '状态', dataIndex: 'status', width: 110 },
      { title: '备注', dataIndex: 'remark', ellipsis: true },
      { title: '创建时间', dataIndex: 'date', width: 120 },
    ],
    rows: [],
  },
  cash: {
    key: 'cash',
    title: '现金管理',
    description: '管理现金、银行账户、收入登记、支出登记和流水余额。',
    keywordPlaceholder: '搜索账户、流水、单据或经办人',
    importable: true,
    columns: [
      { title: '账户名称', dataIndex: 'accountName', width: 150 },
      { title: '账户类型', dataIndex: 'accountType', width: 110 },
      { title: '期初余额', dataIndex: 'openingBalance', width: 120 },
      { title: '收入金额', dataIndex: 'incomeAmount', width: 120 },
      { title: '支出金额', dataIndex: 'expenseAmount', width: 120 },
      { title: '当前余额', dataIndex: 'currentBalance', width: 120 },
      { title: '流水日期', dataIndex: 'date', width: 120 },
      { title: '流水类型', dataIndex: 'flowType', width: 110 },
      { title: '付款/收款方', dataIndex: 'counterpartyName', width: 150 },
      { title: '银行流水号', dataIndex: 'bankSerialNo', width: 160 },
      { title: '已认领', dataIndex: 'recognizedAmount', width: 120 },
      { title: '未认领', dataIndex: 'unrecognizedAmount', width: 120 },
      { title: '经办人', dataIndex: 'handler', width: 100 },
      { title: '状态', dataIndex: 'status', width: 110 },
      { title: '备注', dataIndex: 'remark', ellipsis: true },
    ],
    rows: [],
  },
  salary: {
    key: 'salary',
    title: '工资管理',
    description: '录入、计算、审核、发放员工工资，并对敏感金额脱敏。',
    keywordPlaceholder: '搜索员工、部门、岗位或状态',
    importable: true,
    columns: [
      { title: '财务年', dataIndex: 'financialYear', width: 90 },
      { title: '财务月', dataIndex: 'financialMonth', width: 90 },
      { title: '公司名称', dataIndex: 'companyName', width: 180 },
      { title: '序号', dataIndex: 'sequenceNo', width: 70 },
      { title: '岗位', dataIndex: 'position', width: 120 },
      { title: '姓名', dataIndex: 'employeeName', width: 110 },
      { title: '出勤天数', dataIndex: 'attendanceDays', width: 100 },
      { title: '基本工资', dataIndex: 'basicSalary', width: 120 },
      { title: '绩效工资', dataIndex: 'performanceSalary', width: 120 },
      { title: '应发工资', dataIndex: 'grossSalary', width: 120 },
      { title: '出勤工资', dataIndex: 'attendanceSalary', width: 120 },
      { title: '工龄工资', dataIndex: 'senioritySalary', width: 120 },
      { title: '加班补助', dataIndex: 'overtimeAllowance', width: 120 },
      { title: '出差补助', dataIndex: 'travelAllowance', width: 120 },
      { title: '补发工资', dataIndex: 'retroactiveSalary', width: 120 },
      { title: '合计金额', dataIndex: 'totalAmount', width: 120 },
      { title: '社保基数', dataIndex: 'socialSecurityBase', width: 110 },
      { title: '公司养老16%', dataIndex: 'companyPension', width: 120 },
      { title: '公司医疗6.9%', dataIndex: 'companyMedical', width: 130 },
      { title: '公司工伤0.575%', dataIndex: 'companyInjury', width: 140 },
      { title: '公司失业0.5%', dataIndex: 'companyUnemployment', width: 130 },
      { title: '公司社保合计', dataIndex: 'companySocialSecurityTotal', width: 130 },
      { title: '个人养老8%', dataIndex: 'personalPension', width: 120 },
      { title: '个人医疗0.2%', dataIndex: 'personalMedical', width: 130 },
      { title: '个人工伤', dataIndex: 'personalInjury', width: 110 },
      { title: '个人失业0.5%', dataIndex: 'personalUnemployment', width: 130 },
      { title: '个人社保合计', dataIndex: 'personalSocialSecurityTotal', width: 130 },
      { title: '代扣个税', dataIndex: 'tax', width: 110 },
      { title: '实发工资', dataIndex: 'netSalary', width: 120 },
      { title: '现金发放', dataIndex: 'cashPayment', width: 110 },
      { title: '备注', dataIndex: 'remark', width: 180, ellipsis: true },
      { title: '发放状态', dataIndex: 'payStatus', width: 110 },
      { title: '审批状态', dataIndex: 'status', width: 110 },
    ],
    rows: [],
  },
  org: {
    key: 'org',
    title: '组织架构',
    description: '维护公司、部门、岗位、员工、直属领导、审批人和角色权限。',
    keywordPlaceholder: '搜索部门、岗位、员工、手机号',
    columns: [
      { title: '组织编号', dataIndex: 'code', width: 130 },
      { title: '类型', dataIndex: 'orgType', width: 90 },
      { title: '名称/员工', dataIndex: 'name', width: 140 },
      { title: '上级部门', dataIndex: 'parentDepartment', width: 120 },
      { title: '岗位', dataIndex: 'position', width: 120 },
      { title: '直属领导', dataIndex: 'leader', width: 110 },
      { title: '审批人', dataIndex: 'approver', width: 110 },
      { title: '角色权限', dataIndex: 'role', width: 130 },
      { title: '手机号', dataIndex: 'phone', width: 130 },
      { title: '状态', dataIndex: 'status', width: 100 },
      { title: '更新时间', dataIndex: 'date', width: 120 },
    ],
    rows: [],
  },
  vehicle: {
    key: 'vehicle',
    title: '办公用车',
    description: '以费用台账为核心，关联车辆、用车记录、费用类型、票据附件、OA审批、到期提醒和消息通知。',
    keywordPlaceholder: '搜索台账单号、员工、部门、项目、车牌、费用类型或票据',
    importable: true,
    columns: [
      { title: '台账单号', dataIndex: 'code', width: 150 },
      { title: '车辆/车牌', dataIndex: 'vehicleInfo', width: 160 },
      { title: '用车日期', dataIndex: 'date', width: 120 },
      { title: '员工', dataIndex: 'applicant', width: 100 },
      { title: '部门', dataIndex: 'department', width: 110 },
      { title: '项目', dataIndex: 'projectName', width: 130 },
      { title: '用车记录', dataIndex: 'usageSummary', width: 220, ellipsis: true },
      { title: '费用类型', dataIndex: 'expenseType', width: 110 },
      { title: '费用金额', dataIndex: 'totalFee', width: 110 },
      { title: '票据附件', dataIndex: 'attachmentName', width: 150 },
      { title: 'OA审批单', dataIndex: 'approvalNo', width: 150 },
      { title: '审批状态', dataIndex: 'status', width: 110 },
      { title: '到期提醒', dataIndex: 'reminderText', width: 160 },
      { title: '通知状态', dataIndex: 'notifyStatus', width: 110 },
    ],
    rows: [],
  },
})

function applyOaModuleState(data: any) {
  const modules = data?.modules || {}
  // Organization data is mirrored from system management and is never owned by OA partition responses.
  ;(['dashboard', 'receivable', 'cash', 'salary', 'vehicle'] as ModuleKey[]).forEach((key) => {
    const rows = Array.isArray(modules[key]) ? modules[key] : []
    moduleProfiles[key].rows = key === 'salary'
      ? rows.map((row: OaRecord) => ({
          requiredAttendanceDays: Number(row.requiredAttendanceDays || dayjs(`${row.financialYear}-${String(row.financialMonth).padStart(2, '0')}-01`).daysInMonth()),
          actualAttendanceDays: Number(row.actualAttendanceDays ?? row.attendanceDays ?? row.requiredAttendanceDays ?? 0),
          leaveDays: 0,
          absenceDays: 0,
          absenceDeduction: 0,
          attendanceStatus: '待录入',
          allowanceBonus: Number(row.senioritySalary || 0) + Number(row.overtimeAllowance || 0) + Number(row.travelAllowance || 0) + Number(row.retroactiveSalary || 0),
          ...row,
        }))
      : rows
  })
  cashBalanceRecords.value = Array.isArray(data?.cashBalanceRecords) ? data.cashBalanceRecords : []
  oaStateRevision.value = Number(data?.revision || 0)
}

async function loadSystemOrganizationMirror() {
  const [orgResponse, userResponse, templateResponse] = await Promise.all([getSystemOrganizationsApi(), getSystemUsersApi(), getSalaryTemplatesApi()])
  if (orgResponse.code !== 200 || userResponse.code !== 200)
    throw new Error('系统组织架构加载失败')

  const organizations = orgResponse.data || []
  const users = userResponse.data || []
  salaryTemplates.value = templateResponse.code === 200 ? (templateResponse.data || []) : []
  const byId = new Map(organizations.map(item => [String(item.id), item]))
  const nameOf = (id?: string) => id ? byId.get(String(id))?.name || '' : ''
  const roleLabels: Record<string, string> = {
    ADMIN: '管理员',
    APPROVER: '审批人',
    DEPT_LEADER: '部门负责人',
    FINANCE_MANAGER: '财务',
    USER: '普通用户',
  }
  const rows: OaRecord[] = organizations.map(item => ({
    id: `system-org-${item.id}`,
    code: item.code,
    name: item.name,
    orgType: item.type === 'company' ? '公司' : item.type === 'department' ? '部门' : '岗位',
    parentDepartment: nameOf(item.parentId),
    leader: item.leaderName || '',
    approver: '',
    role: '',
    phone: '',
    status: item.status === 'enabled' ? '正常' : '停用',
    date: '',
    sortNo: item.sortNo,
    companyName: item.type === 'company' ? item.name : nameOf(organizations.find(parent => parent.type === 'company')?.id),
    financialYear: 0,
    financialMonth: 0,
  }))
  users.forEach((user) => {
    rows.push({
      id: `system-user-${user.id || user.username}`,
      code: user.username,
      name: user.nickname,
      orgType: '员工',
      parentDepartment: user.deptName || nameOf(user.deptId),
      position: user.postName || nameOf(user.postId),
      leader: user.leaderName || '',
      approver: user.leaderName || '',
      role: (user.roles || []).map(role => roleLabels[role] || role).join('、'),
      systemRoles: user.roles || [],
      phone: user.mobile,
      email: user.email || '',
      status: user.status === 'enabled' ? '在职' : '停用',
      date: user.updatedAt || user.createdAt || '',
      companyName: user.companyName || '',
      financialYear: 0,
      financialMonth: 0,
    })
  })
  moduleProfiles.org.rows = rows
}

async function loadOaModuleState() {
  loading.value = true
  loadError.value = ''
  try {
    const [res, approvalRes] = await Promise.all([getOaModuleStateApi(), getApprovalBusinessRecordsApi()])
    applyOaModuleState(res.data)
    // System management is the single source for OA personnel associations.
    await loadSystemOrganizationMirror()
    const approvalRows = (approvalRes.data || []).map((item: any) => ({
      id: `approval-${item.approvalInstanceId || item.businessId}`,
      code: item.businessNo,
      title: item.title,
      approvalType: APPROVAL_BUSINESS_MAP.get(item.businessType)?.label || item.businessType,
      businessType: item.businessType,
      approvalInstanceId: item.approvalInstanceId,
      expenseType: item.payload?.contentOption || item.title,
      amount: Number(item.amount || item.payload?.amount || 0),
      expenseAmount: /APPROVAL_APPROVED/.test(item.businessStatus) ? Number(item.amount || item.payload?.amount || 0) : 0,
      status: item.businessStatus === 'APPROVAL_APPROVED' ? '已通过' : item.businessStatus === 'APPROVAL_REJECTED' ? '已驳回' : '审批中',
      date: item.payload?.occurredDate || item.updatedAt,
      financialYear: dayjs(item.payload?.occurredDate || item.updatedAt).year(),
      financialMonth: dayjs(item.payload?.occurredDate || item.updatedAt).month() + 1,
      applicant: item.payload?.applicantName,
      approvalNo: item.businessNo,
      sourceModule: item.businessModule || '审批中心',
      description: item.payload?.description,
      remark: item.payload?.remark,
    }))
    approvalRows.forEach((record: any) => {
      const moduleKey = approvalOaModuleKey(record.businessType)
      if (!moduleKey)
        return
      const rows = moduleProfiles[moduleKey].rows
      const index = rows.findIndex(item => item.approvalInstanceId === record.approvalInstanceId || item.id === record.id)
      if (index >= 0)
        rows[index] = { ...rows[index], ...record }
      else
        rows.unshift(record)
    })
    if (canManageCashBalance.value)
      await loadFinanceReconciliation()
  }
  catch (error: any) {
    loadError.value = error?.message || 'OA模块数据加载失败'
    message.error(loadError.value)
  }
  finally {
    loading.value = false
  }
}

async function loadFinanceReconciliation() {
  reconciliationLoading.value = true
  try {
    const res = await getFinanceReconciliationApi()
    if (!res.data)
      throw new Error('财务回写检查未返回结果')
    financeReconciliation.value = res.data
  }
  catch (error: any) {
    console.warn('[finance] reconciliation check failed', error)
  }
  finally {
    reconciliationLoading.value = false
  }
}

async function reconcileFinanceRecords() {
  reconciliationLoading.value = true
  try {
    const res = await reconcileFinanceRecordsApi()
    if (!res.data)
      throw new Error('历史审批回补未返回结果')
    financeReconciliation.value = res.data
    await loadOaModuleState()
    message.success(res.msg || `已回补 ${res.data.repairedCount || 0} 条财务记录`)
  }
  catch (error: any) {
    message.error(error?.message || '历史审批回补失败')
  }
  finally {
    reconciliationLoading.value = false
  }
}

async function persistOaModuleState(successText?: string, partition: ModuleKey | 'cashBalance' = activeKey.value) {
  saving.value = true
  try {
    const rows = partition === 'cashBalance' ? cashBalanceRecords.value : moduleProfiles[partition].rows
    const res = await saveOaModulePartitionApi({ partition, rows, revision: oaStateRevision.value })
    applyOaModuleState(res.data)
    if (successText)
      message.success(successText)
  }
  catch (error: any) {
    message.error(error?.message || 'OA模块数据保存失败')
    throw error
  }
  finally {
    saving.value = false
  }
}

async function ensureSalaryPeriodGenerated() {
  if (activeKey.value !== 'salary')
    return
  const requestId = ++salaryAutoGenerationRequestId
  const period = { ...currentSalaryPeriod.value }
  salaryAutoGenerating.value = true
  salaryAutoGenerationError.value = ''
  try {
    const res = await generateSalaryPeriodApi(period)
    if (requestId !== salaryAutoGenerationRequestId)
      return
    applyOaModuleState(res.data)
  }
  catch (error: any) {
    if (requestId !== salaryAutoGenerationRequestId)
      return
    salaryAutoGenerationError.value = error?.message || '当月工资表自动生成失败'
  }
  finally {
    if (requestId === salaryAutoGenerationRequestId)
      salaryAutoGenerating.value = false
  }
}

const activeKey = computed<ModuleKey>(() => {
  const moduleByPath: Record<string, ModuleKey> = {
    '/oa-approval/dashboard': 'dashboard',
    '/oa-approval/receivable-payable': 'receivable',
    '/oa-approval/cash': 'cash',
    '/oa-approval/salary': 'salary',
    '/oa-approval/org': 'org',
    '/oa-approval/vehicle': 'vehicle',
  }
  const key = String(props.moduleKey || route.meta.oaModule || moduleByPath[route.path] || 'dashboard') as ModuleKey
  return moduleProfiles[key] ? key : 'dashboard'
})
const activeProfile = computed(() => moduleProfiles[activeKey.value])
const rows = computed(() => activeProfile.value.rows)
const availableMonthKeys = computed(() => [...new Set(rows.value.map(row => `${row.financialYear}${String(row.financialMonth).padStart(2, '0')}`))])
const filteredRows = computed(() => rows.value.filter(row =>
  matchesFilter(row) && (activeKey.value !== 'salary' || !isSystemAdministratorSalary(row, moduleProfiles.org.rows)),
))
const actionColumn = { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 180 }
const salaryTableColumns = computed(() => [
  { title: '序号', dataIndex: 'sequenceNo', width: 60, fixed: 'left' as const },
  { title: '员工', dataIndex: 'employeeName', width: 170, fixed: 'left' as const },
  {
    title: '本月录入',
    children: [
      { title: '出勤天数', dataIndex: 'actualAttendanceDays', width: 120 },
      { title: '加班补助', dataIndex: 'overtimePay', width: 120 },
      { title: '出差补助', dataIndex: 'subsidy', width: 120 },
    ],
  },
  {
    title: '自动核算',
    children: [
      { title: '应发工资', dataIndex: 'grossSalary', width: 120 },
      { title: '个人社保', dataIndex: 'personalSocialSecurityTotal', width: 115 },
      { title: '代扣个税', dataIndex: 'tax', width: 105 },
      { title: '实发工资', dataIndex: 'netSalary', width: 125 },
    ],
  },
  { title: '状态', dataIndex: 'status', width: 100, fixed: 'right' as const },
  { ...actionColumn, width: 90 },
])
const salaryTemplateColumns = computed(() => enhanceColumns([
  { title: '员工姓名', dataIndex: 'employeeName', width: 110, fixed: 'left' as const },
  { title: '员工工号', dataIndex: 'employeeId', width: 120, fixed: 'left' as const },
  { title: '公司名称', dataIndex: 'companyName', width: 170 },
  { title: '部门', dataIndex: 'department', width: 120 },
  { title: '岗位', dataIndex: 'position', width: 120 },
  { title: '社保基数', dataIndex: 'socialSecurityBase', width: 110 },
  { title: '基础工资', dataIndex: 'basicSalary', width: 110 },
  { title: '绩效工资', dataIndex: 'performanceSalary', width: 110 },
  { title: '工龄工资', dataIndex: 'senioritySalary', width: 110 },
  { title: '岗位模板', dataIndex: 'templateStatus', width: 130 },
  { title: '人员状态', dataIndex: 'employeeStatus', width: 100 },
  actionColumn,
]))
const salaryWageFields = new Set(['basicSalary', 'performanceSalary', 'senioritySalary', 'overtimeAllowance', 'travelAllowance', 'retroactiveSalary', 'grossSalary', 'totalAmount', 'netSalary'])
const salarySocialExpenseFields = new Set(['socialSecurityBase', 'tax', 'companyPension', 'companyMedical', 'companyInjury', 'companyUnemployment', 'companySocialSecurityTotal', 'personalPension', 'personalMedical', 'personalInjury', 'personalUnemployment', 'personalSocialSecurityTotal'])
const tableColumns = computed(() => {
  if (activeKey.value === 'salary')
    return salaryActiveTab.value === 'templates' ? salaryTemplateColumns.value : enhanceColumns(salaryTableColumns.value)
  return enhanceColumns([...activeProfile.value.columns, actionColumn])
})
const activeTableScroll = computed(() => activeKey.value === 'salary'
  ? { x: createBusinessTableScrollX(tableColumns.value, salaryActiveTab.value === 'templates' ? 1450 : 1280) }
  : { x: createBusinessTableScrollX(tableColumns.value, 1400) })
const dashboardSource = computed(() => Object.values(moduleProfiles).flatMap(item => item.rows).filter(row => itemMatchesPeriod(row)))
const currentSalaryPeriod = computed(() => ({
  financialYear: financialPeriodFilter.financialYear || dayjs().year(),
  financialMonth: financialPeriodFilter.financialMonth || (dayjs().month() + 1),
}))
const currentSalaryRows = computed(() => moduleProfiles.salary.rows.filter(row =>
  row.financialYear === currentSalaryPeriod.value.financialYear
  && row.financialMonth === currentSalaryPeriod.value.financialMonth
  && !isSystemAdministratorSalary(row, moduleProfiles.org.rows),
))
const salaryPeriodOverview = computed(() => {
  const list = currentSalaryRows.value
  const employeeCount = orgEmployees.value.filter(row => row.status === '在职' && row.companyName).length
  const missingCount = Math.max(0, employeeCount - new Set(list.map(row => row.employeeId || `${row.companyName}-${row.employeeName}`)).size)
  const pendingEntryCount = list.filter(row => row.attendanceStatus === '待补录' || row.attendanceStatus === '待录入').length
  const lockedCount = list.filter(row => ['已锁定', '审批通过', '已发放', '已归档'].includes(String(row.status))).length
  const paidCount = list.filter(row => row.payStatus === '已发放' || row.status === '已发放').length
  const status = !list.length ? '未生成' : paidCount === list.length ? '已发放' : lockedCount === list.length ? '待审批/发放' : pendingEntryCount ? '待补录' : '核算中'
  return { employeeCount, generatedCount: list.length, missingCount, pendingEntryCount, lockedCount, paidCount, status }
})
const filteredCashBalanceRecords = computed(() => cashBalanceRecords.value.filter((row) => {
  if (cashBalanceQuery.balance_date && row.balance_date !== cashBalanceQuery.balance_date)
    return false
  if (cashBalanceQuery.company_name && !row.company_name.includes(cashBalanceQuery.company_name))
    return false
  if (cashBalanceQuery.bank_name && !row.bank_name.includes(cashBalanceQuery.bank_name))
    return false
  return true
}))
const currentCashBalanceRecords = computed(() => cashBalanceRecords.value)
const cashBalanceTotal = computed(() => currentCashBalanceRecords.value.reduce((total, row) => total + Number(row.balance_amount || 0), 0))
const cashBalanceGroups = computed(() => groupCashBalances(filteredCashBalanceRecords.value))
const currentCashBalanceGroups = computed(() => groupCashBalances(currentCashBalanceRecords.value))
const batchBalanceSummary = computed(() => groupCashBalances(batchBalanceRows.value as CashBalanceRecord[]))
const batchBalanceTotal = computed(() => batchBalanceRows.value.reduce((total, row) => total + Number(row.balance_amount || 0), 0))
const dashboardMetrics = computed(() => calculateFinanceDashboardMetrics(
  dashboardSource.value,
  currentCashBalanceRecords.value.length ? cashBalanceTotal.value : undefined,
))

const showFinanceWorkflow = computed(() => ['dashboard', 'receivable', 'cash'].includes(activeKey.value))
const financeWorkflow = computed(() => {
  const receivables = moduleProfiles.receivable.rows
  const cashRows = moduleProfiles.cash.rows
  const pendingApprovals = dashboardSource.value.filter(row => /待审批|审批中/.test(row.status)).length
  const openReceivables = receivables.filter(row => row.billType === '应收' && Number(row.unpaidAmount || 0) > 0).length
  const openPayables = receivables.filter(row => row.billType === '应付' && Number(row.unpaidAmount || 0) > 0).length
  const unallocatedReceipts = cashRows.filter(row => row.flowType === '来款登记' && Number(row.unrecognizedAmount || 0) > 0).length
  const pendingPayments = cashRows.filter(row => row.flowType === '付款执行' && ['PENDING', 'PROCESSING'].includes(row.paymentStatus)).length
  const completedCashFlows = cashRows.filter(row => Number(row.incomeAmount || 0) > 0 || Number(row.expenseAmount || 0) > 0).length
  return [
    { key: 'approval', label: '审批确认', count: pendingApprovals, detail: financeReconciliation.value.missingCount ? `${financeReconciliation.value.missingCount} 条待回写` : '审批结果已同步', path: '/oa-approval/center', state: financeReconciliation.value.missingCount ? 'warning' : pendingApprovals ? 'active' : 'done' },
    { key: 'ledger', label: '应收应付', count: openReceivables + openPayables, detail: `待收 ${openReceivables} · 待付 ${openPayables}`, path: '/oa-approval/receivable-payable', state: openReceivables + openPayables ? 'active' : 'done' },
    { key: 'receipt', label: '来款核销', count: unallocatedReceipts, detail: unallocatedReceipts ? '存在未认领来款' : '来款均已处理', path: '/oa-approval/cash', state: unallocatedReceipts ? 'warning' : 'done' },
    { key: 'payment', label: '付款执行', count: pendingPayments, detail: pendingPayments ? '等待银行或人工确认' : '无待执行付款', path: '/oa-approval/cash', state: pendingPayments ? 'active' : 'done' },
    { key: 'cash', label: '现金结果', count: completedCashFlows, detail: '实际收支进入看板', path: '/oa-approval/dashboard', state: 'done' },
  ]
})

const expenseTrend = computed(() => calculateActualCashTrend(dashboardSource.value))
const expenseTrendMax = computed(() => Math.max(0, ...expenseTrend.value.flatMap(item => [item.income, item.expense])))

const incomeExpenseShare = computed(() => {
  const income = dashboardMetrics.value.actualIncome
  const expense = dashboardMetrics.value.actualExpense
  return { income, expense, total: income + expense }
})
const dashboardFinanceStatus = computed(() => {
  const metrics = dashboardMetrics.value
  return [
    { label: '本月实际收入', value: money(metrics.actualIncome), hint: '已发生现金收入', tone: 'success' },
    { label: '本月实际支出', value: money(metrics.actualExpense), hint: '已发生现金支出', tone: 'danger' },
    { label: '现金余额', value: money(metrics.cashBalance), hint: currentCashBalanceRecords.value.length ? '最新账户余额快照' : '各账户最新流水余额', tone: 'primary' },
    { label: '待收金额', value: money(metrics.outstandingReceivable), hint: '应收未核销金额', tone: 'warning' },
    { label: '待付金额', value: money(metrics.outstandingPayable), hint: '应付未核销金额', tone: 'warning' },
    { label: '审批中金额', value: money(metrics.pendingApprovalAmount), hint: `${metrics.pendingApprovalCount} 笔审批去重汇总`, tone: 'warning' },
  ]
})
const dashboardApprovalBreakdown = computed(() => {
  const source = dashboardSource.value
  const items = [
    { label: '待我审批', value: count(source, row => row.approverId === currentUserId.value && /待审批|审批中/.test(row.status)), tone: 'warning' },
    { label: '审批中', value: count(source, row => row.status === '审批中'), tone: 'primary' },
    { label: '已通过', value: count(source, row => /审批通过|已同意|已归档|已发放/.test(row.status)), tone: 'success' },
    { label: '已驳回', value: count(source, row => /驳回/.test(row.status)), tone: 'danger' },
  ]
  const total = items.reduce((sum, item) => sum + item.value, 0)
  return items.map(item => ({ ...item, percent: percent(item.value, total) }))
})
const dashboardModuleSummaries = computed(() => [
  {
    title: '应收应付',
    path: '/oa-approval/receivable-payable',
    metrics: [
      ['待收', money(sum(moduleProfiles.receivable.rows.filter(row => row.billType === '应收'), 'unpaidAmount'))],
      ['待付', money(sum(moduleProfiles.receivable.rows.filter(row => row.billType === '应付'), 'unpaidAmount'))],
      ['逾期', money(sum(moduleProfiles.receivable.rows.filter(row => row.status === '已逾期'), 'unpaidAmount'))],
    ],
  },
  {
    title: '现金管理',
    path: '/oa-approval/cash',
    metrics: [
      ['实际收入', money(dashboardMetrics.value.actualIncome)],
      ['实际支出', money(dashboardMetrics.value.actualExpense)],
      ['余额', money(dashboardMetrics.value.cashBalance)],
    ],
  },
  {
    title: '工资管理',
    path: '/oa-approval/salary',
    metrics: [
      ['工资总额', money(sum(moduleProfiles.salary.rows, 'totalAmount'))],
      ['实发工资', money(sum(moduleProfiles.salary.rows, 'netSalary'))],
      ['待发人数', count(moduleProfiles.salary.rows, row => row.payStatus !== '已发放')],
    ],
  },
  {
    title: '办公用车',
    path: '/oa-approval/vehicle',
    metrics: [
      ['费用总额', money(sum(moduleProfiles.vehicle.rows, 'totalFee'))],
      ['待审批', count(moduleProfiles.vehicle.rows, row => /待审批|审批中/.test(row.status))],
      ['附件缺失', count(moduleProfiles.vehicle.rows, row => row.attachmentStatus === '待补票' || !row.attachmentName)],
    ],
  },
])
const dashboardRisks = computed(() => [
  { level: 'danger', title: '逾期未收', value: money(sum(moduleProfiles.receivable.rows.filter(row => row.billType === '应收' && row.status === '已逾期'), 'unpaidAmount')), desc: '需跟进客户回款' },
  { level: 'warning', title: '大额待审批', value: money(sum(dashboardSource.value.filter(row => /待审批|审批中/.test(row.status)), 'amount')), desc: '付款、报销、工资等审批占用资金' },
  { level: 'warning', title: '工资待发', value: money(sum(moduleProfiles.salary.rows.filter(row => row.payStatus !== '已发放'), 'netSalary')), desc: '影响本月人工成本结算' },
  { level: 'danger', title: '票据待补', value: count(moduleProfiles.vehicle.rows, row => row.attachmentStatus === '待补票' || !row.attachmentName), desc: '影响费用归档与报销凭证' },
  { level: 'warning', title: '保险/年检提醒', value: count(moduleProfiles.vehicle.rows, row => isVehicleExpiring(row)), desc: '30 天内到期事项' },
])
const dashboardQuickLinks = [
  { label: '处理审批', path: '/oa-approval/center', desc: '待审、已办、我发起' },
  { label: '查看待收待付', path: '/oa-approval/receivable-payable', desc: '应收应付与逾期' },
  { label: '核对现金余额', path: '/oa-approval/cash', desc: '银行与现金账户' },
  { label: '审核工资', path: '/oa-approval/salary', desc: '工资、考勤、发放' },
  { label: '维护组织架构', path: '/system/organization', desc: '人员、部门、岗位' },
  { label: '检查用车费用', path: '/oa-approval/vehicle', desc: '用车、票据、到期' },
]

const companyNameOptions = computed(() => businessDictionaries.values('oa_company'))
const roleOptions = computed(() => businessDictionaries.values('oa_role'))
const positionLevelOptions = computed(() => businessDictionaries.values('position_level'))
const orgRows = computed(() => moduleProfiles.org.rows)
const orgDepartments = computed(() => orgRows.value.filter(row => ['公司', '部门'].includes(row.orgType)))
const orgPositions = computed(() => orgRows.value.filter(row => row.orgType === '岗位'))
const orgEmployees = computed(() => orgRows.value.filter(isSalaryEligibleEmployee))
const salaryTemplateRows = computed(() => orgEmployees.value.map((employee, index) => buildSalaryTemplateRow(employee, index + 1)).filter(row => matchesSalaryTemplateFilter(row)))
const salaryVisibleRows = computed(() => salaryActiveTab.value === 'templates' ? salaryTemplateRows.value : filteredRows.value)
const orgEmployeeMap = computed(() => new Map(orgEmployees.value.map(row => [`${row.companyName}-${row.name}`, row])))
const selectedOrgRecord = computed(() => orgDepartments.value.find(row => row.code === selectedOrgKey.value) ?? orgDepartments.value[0])
const selectedDepartmentName = computed(() => selectedOrgRecord.value?.orgType === '部门' ? selectedOrgRecord.value.name : '')
const orgDepartmentOptions = computed(() => orgDepartments.value.filter(row => row.orgType === '部门').map(row => row.name))
const orgPositionOptions = computed(() => orgPositions.value
  .filter(row => !orgForm.parentDepartment || row.parentDepartment === orgForm.parentDepartment)
  .map(row => row.name))
const activeEmployeeOptions = computed(() => orgEmployees.value.filter(row => row.status === '在职').map(row => row.name))
const orgTreeData = computed(() => buildOrgTree(orgDepartments.value, orgTreeKeyword.value))
const orgFilteredRows = computed(() => {
  const source = orgActiveTab.value === 'employees'
    ? orgEmployees.value
    : orgActiveTab.value === 'positions'
      ? orgPositions.value
      : orgDepartments.value.filter(row => row.orgType === '部门')

  return source.filter((row) => {
    if (selectedDepartmentName.value && row.parentDepartment !== selectedDepartmentName.value && row.name !== selectedDepartmentName.value)
      return false
    if (queryModel.status && row.status !== queryModel.status)
      return false
    if (queryModel.orgDepartment && row.parentDepartment !== queryModel.orgDepartment)
      return false
    if (queryModel.orgPosition && row.position !== queryModel.orgPosition && row.name !== queryModel.orgPosition)
      return false
    if (queryModel.orgRole && !String(row.role ?? '').split('、').includes(queryModel.orgRole))
      return false
    if (queryModel.hireDateRange?.[0] && queryModel.hireDateRange?.[1]) {
      const date = dayjs(row.hireDate || row.date)
      if (date.isBefore(queryModel.hireDateRange[0], 'day') || date.isAfter(queryModel.hireDateRange[1], 'day'))
        return false
    }
    const keyword = queryModel.keyword.trim()
    if (keyword && !Object.values(row).some(value => String(value ?? '').includes(keyword)))
      return false
    return true
  })
})
const summaryCards = computed<SummaryCardItem[]>(() => {
  const list = activeKey.value === 'dashboard' ? dashboardSource.value : activeKey.value === 'salary' ? salaryVisibleRows.value : filteredRows.value
  if (activeKey.value === 'dashboard')
    return dashboardCards(list)
  if (activeKey.value === 'receivable')
    return receivableCards(list)
  if (activeKey.value === 'cash')
    return cashCards(list)
  if (activeKey.value === 'salary')
    return salaryActiveTab.value === 'templates' ? salaryTemplateCards(list) : salaryCards(list)
  if (activeKey.value === 'org')
    return orgCards(orgFilteredRows.value)
  return vehicleCards(list)
})
const orgTableColumns = computed(() => {
  const action = { title: '操作', dataIndex: 'action', fixed: 'right' as const, width: 260 }
  if (orgActiveTab.value === 'departments') {
    return [
      { title: '部门名称', dataIndex: 'name', width: 130 },
      { title: '部门编码', dataIndex: 'code', width: 120 },
      { title: '上级部门', dataIndex: 'parentDepartment', width: 130 },
      { title: '负责人', dataIndex: 'leader', width: 110 },
      { title: '联系电话', dataIndex: 'phone', width: 130 },
      { title: '排序号', dataIndex: 'sortNo', width: 90 },
      { title: '状态', dataIndex: 'status', width: 90 },
      { title: '备注', dataIndex: 'remark', ellipsis: true },
      action,
    ]
  }
  if (orgActiveTab.value === 'positions') {
    return [
      { title: '岗位名称', dataIndex: 'name', width: 130 },
      { title: '岗位编码', dataIndex: 'code', width: 120 },
      { title: '所属部门', dataIndex: 'parentDepartment', width: 130 },
      { title: '岗位级别', dataIndex: 'positionLevel', width: 110 },
      { title: '默认角色', dataIndex: 'role', width: 130 },
      { title: '岗位职责', dataIndex: 'responsibility', ellipsis: true },
      { title: '状态', dataIndex: 'status', width: 90 },
      action,
    ]
  }
  return [
    { title: '员工姓名', dataIndex: 'name', width: 110 },
    { title: '员工工号', dataIndex: 'code', width: 120 },
    { title: '公司', dataIndex: 'companyName', width: 170 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', width: 180 },
    { title: '所属部门', dataIndex: 'parentDepartment', width: 130 },
    { title: '岗位', dataIndex: 'position', width: 120 },
    { title: '基本工资', dataIndex: 'basicSalary', width: 110 },
    { title: '绩效工资', dataIndex: 'performanceSalary', width: 110 },
    { title: '社保基数', dataIndex: 'socialSecurityBase', width: 100 },
    { title: '直属领导', dataIndex: 'leader', width: 110 },
    { title: '审批人', dataIndex: 'approver', width: 110 },
    { title: '角色', dataIndex: 'role', width: 130 },
    { title: '入职日期', dataIndex: 'hireDate', width: 120 },
    { title: '状态', dataIndex: 'status', width: 90 },
    action,
  ]
})
const orgTableScrollX = computed(() => createBusinessTableScrollX(orgTableColumns.value, 1400))
const cashBalanceTableColumns = computed(() => enhanceColumns([
  { title: '日期', dataIndex: 'balance_date', width: 120, ellipsis: false },
  { title: '主体名称', dataIndex: 'company_name', width: 220, ellipsis: false },
  { title: '银行名称', dataIndex: 'bank_name', width: 200, ellipsis: false },
  { title: '账户名称', dataIndex: 'account_name', width: 170, ellipsis: false },
  { title: '账号', dataIndex: 'account_no_tail', width: 220, ellipsis: false },
  { title: '余额', dataIndex: 'balance_amount', width: 130 },
  { title: '最近变动', dataIndex: 'last_movement', width: 220, ellipsis: false },
  { title: '备注', dataIndex: 'remark', width: 220, ellipsis: false },
  { title: '操作', dataIndex: 'action', width: 200, fixed: 'right' },
]))
const cashBalanceTableScrollX = computed(() => createBusinessTableScrollX(cashBalanceTableColumns.value, 1580))
const batchBalanceTableScrollX = computed(() => createBusinessTableScrollX(cashBalanceTableColumns.value, 1310))

function createOrgForm(type: '部门' | '岗位' | '员工'): OaRecord {
  const row = {
    id: '',
    code: '',
    orgType: type,
    name: '',
    parentDepartment: type === '部门' ? '企业管理系统' : '',
    position: '',
    positionLevel: '专员',
    leader: '',
    approver: '',
    financeApprover: '',
    adminApprover: '',
    vehicleApprover: '',
    salaryApprover: '',
    companyName: DEFAULT_COMPANY_NAME,
    role: type === '员工' ? '普通员工' : '',
    phone: '',
    email: '',
    hireDate: dayjs().format('YYYY-MM-DD'),
    basicSalary: 0,
    performanceSalary: 0,
    senioritySalary: 0,
    overtimeAllowance: 0,
    travelAllowance: 0,
    retroactiveSalary: 0,
    socialSecurityBase: 0,
    tax: 0,
    status: type === '员工' ? '在职' : '正常',
    sortNo: 10,
    responsibility: '',
    remark: '',
    date: dayjs().format('YYYY-MM-DD'),
    financialYear: dayjs().year(),
    financialMonth: dayjs().month() + 1,
  } as OaRecord
  recalculateSalary(row)
  return row
}

function buildSalaryTemplateRow(employee: OaRecord, sequenceNo: number): OaRecord {
  const { financialYear, financialMonth } = currentSalaryPeriod.value
  const template = salaryTemplates.value.find(item => item.employeeId === employee.code)
    || salaryTemplates.value.find(item => item.companyName === employee.companyName && item.department === employee.parentDepartment && item.position === employee.position)
  const linkedSalary = moduleProfiles.salary.rows.find(row =>
    row.companyName === employee.companyName
    && row.financialYear === financialYear
    && row.financialMonth === financialMonth
    && row.employeeName === employee.name,
  )

  const row: OaRecord = {
    id: `salary-template-${employee.code}`,
    code: `TPL-${employee.code}`,
    employeeId: employee.code,
    employeeName: employee.name,
    companyName: employee.companyName,
    department: employee.parentDepartment,
    position: employee.position,
    sequenceNo,
    basicSalary: Number(template?.basicSalary ?? employee.basicSalary ?? 0),
    performanceSalary: Number(template?.performanceSalary ?? employee.performanceSalary ?? 0),
    senioritySalary: Number(template?.senioritySalary ?? employee.senioritySalary ?? 0),
    overtimeAllowance: Number(template?.overtimeAllowance ?? employee.overtimeAllowance ?? 0),
    travelAllowance: Number(template?.travelAllowance ?? employee.travelAllowance ?? 0),
    retroactiveSalary: Number(template?.retroactiveSalary ?? employee.retroactiveSalary ?? 0),
    socialSecurityBase: Number(template?.socialSecurityBase ?? employee.socialSecurityBase ?? 0),
    tax: Number(template?.tax ?? employee.tax ?? 0),
    absenceDeductionPerDay: Number(template?.absenceDeductionPerDay ?? 0),
    housingFundBase: Number(template?.housingFundBase ?? 0),
    companyHousingFundRate: Number(template?.companyHousingFundRate ?? 0),
    personalHousingFundRate: Number(template?.personalHousingFundRate ?? 0),
    fixedSalary: Number(template?.basicSalary ?? employee.basicSalary ?? 0) + Number(template?.performanceSalary ?? employee.performanceSalary ?? 0),
    salaryApprover: employee.salaryApprover || employee.approver || '',
    leader: employee.leader || '',
    employeeStatus: employee.status,
    linkStatus: linkedSalary ? '已生成工资' : employee.status === '在职' ? '未生成' : '人员停用',
    sourceModule: '组织架构',
    status: linkedSalary ? linkedSalary.status : employee.status,
    payStatus: linkedSalary?.payStatus || '',
    date: employee.date,
    financialYear,
    financialMonth,
    orgRecordId: employee.id,
    sourceEmployee: employee,
    linkedSalaryId: linkedSalary?.id,
    templateStatus: template ? '已设定岗位模板' : '未设定岗位模板',
  }
  recalculateSalary(row)
  return row
}

function matchesSalaryTemplateFilter(row: OaRecord) {
  if (queryModel.companyName && row.companyName !== queryModel.companyName)
    return false
  if (queryModel.orgPosition && ![row.position, row.department].some(value => String(value ?? '').includes(queryModel.orgPosition!)))
    return false
  if (queryModel.status && row.employeeStatus !== queryModel.status && row.linkStatus !== queryModel.status)
    return false
  const keyword = queryModel.keyword.trim()
  if (keyword && !Object.values(row).some(value => String(value ?? '').includes(keyword)))
    return false
  return true
}

function resetOrgForm(type: '部门' | '岗位' | '员工', record?: OaRecord) {
  Object.assign(orgForm, record ? { ...record } : createOrgForm(type))
  if (!record && type !== '部门')
    orgForm.parentDepartment = selectedDepartmentName.value || orgDepartmentOptions.value[0] || ''
  if (!record && type === '部门')
    orgForm.parentDepartment = selectedOrgRecord.value?.name || '企业管理系统'
}

function buildOrgTree(rows: OaRecord[], keyword: string) {
  const rootRows = rows.filter(row => row.orgType === '公司')
  const departmentRows = rows.filter(row => row.orgType === '部门')
  const buildChildren = (parentName: string): any[] => departmentRows
    .filter(row => row.parentDepartment === parentName)
    .map(row => ({
      title: `${row.name}${row.status === '停用' ? '（停用）' : ''}`,
      key: row.code,
      children: buildChildren(row.name),
    }))
  const tree = rootRows.map(row => ({
    title: row.name,
    key: row.code,
    children: buildChildren(row.name),
  }))

  if (!keyword)
    return tree

  const filterNode = (node: any): any | undefined => {
    const children = (node.children || []).map(filterNode).filter(Boolean)
    if (node.title.includes(keyword) || children.length)
      return { ...node, children }
  }
  return tree.map(filterNode).filter(Boolean)
}

function handleOrgTreeSelect(keys: Array<string | number>) {
  if (keys[0])
    selectedOrgKey.value = String(keys[0])
}

function openOrgCreate(type: '部门' | '岗位' | '员工') {
  orgFormMode.value = 'create'
  orgFormType.value = type
  resetOrgForm(type)
  orgFormOpen.value = true
}

function openOrgEdit(record: OaRecord) {
  orgFormMode.value = 'edit'
  orgFormType.value = record.orgType as '部门' | '岗位' | '员工'
  resetOrgForm(orgFormType.value, record)
  orgFormOpen.value = true
}

function validateOrgForm(record: OaRecord) {
  if (!record.name?.trim()) {
    message.warning('名称不能为空')
    return false
  }
  if (!record.code?.trim()) {
    message.warning('编码不能为空')
    return false
  }
  if (orgRows.value.some(row => row.id !== record.id && row.code === record.code)) {
    message.warning('编码不能重复')
    return false
  }
  if (record.orgType === '部门') {
    if (orgRows.value.some(row => row.id !== record.id && row.orgType === '部门' && row.parentDepartment === record.parentDepartment && row.name === record.name)) {
      message.warning('同一上级部门下部门名称不能重复')
      return false
    }
  }
  if (record.orgType === '岗位') {
    if (!record.parentDepartment) {
      message.warning('岗位必须归属部门')
      return false
    }
    if (orgRows.value.some(row => row.id !== record.id && row.orgType === '岗位' && row.parentDepartment === record.parentDepartment && row.name === record.name)) {
      message.warning('同一部门下岗位名称不能重复')
      return false
    }
  }
  if (record.orgType === '员工') {
    if (!record.parentDepartment) {
      message.warning('员工必须归属一个部门')
      return false
    }
    if (record.position && !orgPositions.value.some(row => row.parentDepartment === record.parentDepartment && row.name === record.position)) {
      message.warning('员工岗位必须属于当前部门')
      return false
    }
    if (orgEmployees.value.some(row => row.id !== record.id && row.code === record.code)) {
      message.warning('员工工号不能重复')
      return false
    }
    if (record.phone && orgEmployees.value.some(row => row.id !== record.id && row.phone === record.phone)) {
      message.warning('手机号不能重复')
      return false
    }
    if (record.email && orgEmployees.value.some(row => row.id !== record.id && row.email === record.email)) {
      message.warning('邮箱不能重复')
      return false
    }
    const approverNames = [record.approver, record.financeApprover, record.adminApprover, record.vehicleApprover, record.salaryApprover].filter(Boolean)
    if (approverNames.some(name => orgEmployees.value.some(row => row.name === name && row.status !== '在职'))) {
      message.warning('离职/停用员工不能作为审批人')
      return false
    }
  }
  return true
}

async function saveOrgForm() {
  if (saving.value)
    return
  if (!validateOrgForm(orgForm))
    return
  const payload: OaRecord = {
    ...orgForm,
    id: orgForm.id || `org-${Date.now()}`,
    date: dayjs().format('YYYY-MM-DD'),
    financialYear: dayjs().year(),
    financialMonth: dayjs().month() + 1,
  } as OaRecord
  const index = orgRows.value.findIndex(row => row.id === payload.id)
  if (index > -1)
    moduleProfiles.org.rows[index] = payload
  else
    moduleProfiles.org.rows.unshift(payload)
  selectedOrgKey.value = payload.orgType === '部门' ? payload.code : selectedOrgKey.value
  await persistOaModuleState(orgFormMode.value === 'create' ? '新增成功' : '保存成功')
  orgFormOpen.value = false
}

function deleteOrgRecord(record: OaRecord) {
  if (record.orgType === '部门') {
    if (orgDepartments.value.some(row => row.parentDepartment === record.name))
      return message.warning('该部门下存在子部门，不能删除')
    if (orgEmployees.value.some(row => row.parentDepartment === record.name))
      return message.warning('该部门下存在员工，不能删除')
  }
  if (record.orgType === '岗位' && orgEmployees.value.some(row => row.parentDepartment === record.parentDepartment && row.position === record.name))
    return message.warning('已关联员工的岗位不能直接删除')
  deleteRecord(record)
}

async function toggleOrgRecord(record: OaRecord) {
  if (record.orgType === '员工')
    record.status = record.status === '在职' ? '停用' : '在职'
  else
    record.status = record.status === '正常' ? '停用' : '正常'
  await persistOaModuleState(record.status === '停用' ? '已停用' : '已启用')
}

function openRoleModal(record: OaRecord) {
  orgActionRecord.value = record
  roleModalOpen.value = true
}

async function saveRoleAssignment() {
  if (saving.value)
    return
  await persistOaModuleState('角色权限已更新')
  roleModalOpen.value = false
}

function openApproverModal(record: OaRecord) {
  orgActionRecord.value = record
  approverModalOpen.value = true
}

async function saveApproverAssignment() {
  if (saving.value)
    return
  const record = orgActionRecord.value
  if (!record)
    return
  const approverNames = [record.approver, record.financeApprover, record.adminApprover, record.vehicleApprover, record.salaryApprover].filter(Boolean)
  if (approverNames.some(name => orgEmployees.value.some(row => row.name === name && row.status !== '在职')))
    return message.warning('离职/停用员工不能作为审批人')
  await persistOaModuleState('审批关系已更新')
  approverModalOpen.value = false
}

function adjustOrgField(record: OaRecord, field: 'parentDepartment' | 'position') {
  orgActionRecord.value = record
  orgFormMode.value = 'edit'
  orgFormType.value = record.orgType as '部门' | '岗位' | '员工'
  resetOrgForm(orgFormType.value, record)
  orgFormOpen.value = true
  message.info(field === 'parentDepartment' ? '请在弹窗中调整部门' : '请在弹窗中调整岗位')
}

function exportOrgRows() {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(orgFilteredRows.value.map(row => ({ ...row }))), '组织架构')
  XLSX.writeFile(workbook, `组织架构_${orgActiveTab.value}_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
  message.success('导出成功')
}

function itemMatchesPeriod(row: OaRecord) {
  const range = financialPeriodFilter.dateRange
  if (range?.[0] && range?.[1]) {
    const date = dayjs(row.date)
    return !date.isBefore(range[0], 'day') && !date.isAfter(range[1], 'day')
  }
  if (financialPeriodFilter.financialYear && row.financialYear !== financialPeriodFilter.financialYear)
    return false
  if (financialPeriodFilter.financialMonth && row.financialMonth !== financialPeriodFilter.financialMonth)
    return false
  return true
}

function matchesFilter(row: OaRecord) {
  if (!itemMatchesPeriod(row))
    return false
  if (activeKey.value === 'salary') {
    if (!orgEmployeeMap.value.has(`${row.companyName}-${row.employeeName}`))
      return false
    if (queryModel.companyName && row.companyName !== queryModel.companyName)
      return false
    if (queryModel.orgPosition && ![row.position, row.department].some(value => String(value ?? '').includes(queryModel.orgPosition!)))
      return false
    if (queryModel.payStatus && row.payStatus !== queryModel.payStatus)
      return false
  }
  if (queryModel.status && row.status !== queryModel.status && row.payStatus !== queryModel.status && row.dispatchStatus !== queryModel.status)
    return false
  const keyword = queryModel.keyword.trim()
  if (keyword && !Object.values(row).some(value => String(value ?? '').includes(keyword)))
    return false
  return true
}

function sum(list: OaRecord[], field: string) {
  return list.reduce((total, row) => total + Number(row[field] ?? 0), 0)
}

function groupCashBalances(list: CashBalanceRecord[]) {
  const map = new Map<string, { company_name: string, subtotal: number, rows: CashBalanceRecord[] }>()
  list.forEach((row) => {
    if (!map.has(row.company_name))
      map.set(row.company_name, { company_name: row.company_name, subtotal: 0, rows: [] })
    const group = map.get(row.company_name)!
    group.rows.push(row)
    group.subtotal += Number(row.balance_amount || 0)
  })
  return Array.from(map.values())
}

function count(list: OaRecord[], predicate: (row: OaRecord) => boolean) {
  return list.filter(predicate).length
}

function dashboardCards(list: OaRecord[]): SummaryCardItem[] {
  const metrics = calculateFinanceDashboardMetrics(list, currentCashBalanceRecords.value.length ? cashBalanceTotal.value : undefined)
  return [
    { label: '实际收入', value: money(metrics.actualIncome), hint: '筛选范围现金收入', tone: 'success' },
    { label: '实际支出', value: money(metrics.actualExpense), hint: '筛选范围现金支出', tone: 'danger' },
    { label: '待收金额', value: money(metrics.outstandingReceivable), hint: '应收未核销金额', tone: 'primary' },
    { label: '待付金额', value: money(metrics.outstandingPayable), hint: '应付未核销金额', tone: 'warning' },
    { label: '现金余额', value: money(metrics.cashBalance), hint: '账户快照或最新流水余额', tone: 'success' },
    { label: '待审批金额', value: money(metrics.pendingApprovalAmount), hint: '审批实例去重汇总', tag: `${metrics.pendingApprovalCount} 条`, tone: 'warning' },
  ]
}

function receivableCards(list: OaRecord[]): SummaryCardItem[] {
  return [
    { label: '应收总额', value: money(sum(list.filter(row => row.billType === '应收'), 'amount')), hint: '应收单据金额', tone: 'primary' },
    { label: '应付总额', value: money(sum(list.filter(row => row.billType === '应付'), 'amount')), hint: '应付单据金额', tone: 'warning' },
    { label: '已收金额', value: money(sum(list.filter(row => row.billType === '应收'), 'paidAmount')), hint: '已收款', tone: 'success' },
    { label: '已付金额', value: money(sum(list.filter(row => row.billType === '应付'), 'paidAmount')), hint: '已付款', tone: 'success' },
    { label: '逾期金额', value: money(sum(list.filter(row => row.status === '已逾期'), 'unpaidAmount')), hint: '已逾期未结', tone: 'danger' },
    { label: '待处理单据数', value: count(list, row => !['已结清', '作废'].includes(row.status)), hint: '未结清/待处理', tone: 'warning' },
  ]
}

function cashCards(list: OaRecord[]): SummaryCardItem[] {
  const cashBalanceRows = cashBalanceRecords.value
  const totalBalance = cashBalanceRows.length
    ? cashBalanceRows.reduce((total, row) => total + Number(row.balance_amount || 0), 0)
    : latestCashBalance(list)
  const metrics = calculateFinanceDashboardMetrics(list)
  return [
    { label: '现金总余额', value: money(totalBalance), hint: '全部主体账户汇总', tone: 'success' },
    { label: '主体数量', value: new Set(cashBalanceRows.map(row => row.company_name)).size, hint: '公司/主体数', tone: 'default' },
    { label: '银行账户数量', value: new Set(cashBalanceRows.map(row => `${row.bank_name}-${row.account_no_tail}`)).size, hint: '余额账户数', tone: 'default' },
    { label: '本月收入', value: money(metrics.actualIncome), hint: '实际收入流水', tone: 'primary' },
    { label: '本月支出', value: money(metrics.actualExpense), hint: '实际支出流水', tone: 'danger' },
    { label: '待处理流水', value: count(list, row => /异常|待审批|待支付|银行处理中|支付失败|未认领|部分认领/.test(row.status)), hint: '支付、异常或未完成认领', tone: 'warning' },
  ]
}

function salaryCards(list: OaRecord[]): SummaryCardItem[] {
  const companyCost = sum(list, 'grossSalary') + sum(list, 'companySocialSecurityTotal') + sum(list, 'companyHousingFund')
  const paidCount = count(list, row => row.payStatus === '已发放')
  return [
    { label: '应发工资', value: money(sum(list, 'grossSalary')), hint: '固定工资、考勤及奖金补贴', tone: 'primary' },
    { label: '实发工资', value: money(sum(list, 'netSalary')), hint: '扣除社保、公积金和个税后', tone: 'success' },
    { label: '公司用工成本', value: money(companyCost), hint: '应发工资及公司缴费合计', tone: 'warning' },
    { label: '核算进度', value: `${paidCount}/${list.length}`, hint: '已发放人数 / 本月人数', tone: paidCount === list.length && list.length > 0 ? 'success' : 'default' },
  ]
}

function salaryTemplateCards(list: OaRecord[]): SummaryCardItem[] {
  return [
    { label: '模板人数', value: list.length, hint: '来源组织架构员工', tone: 'primary' },
    { label: '在职模板', value: count(list, row => row.employeeStatus === '在职'), hint: '可生成工资', tone: 'success' },
    { label: '已生成工资', value: count(list, row => row.linkStatus === '已生成工资'), hint: '已关联当月工资', tone: 'success' },
    { label: '未生成工资', value: count(list, row => row.linkStatus === '未生成'), hint: '待生成当月工资', tone: 'warning' },
    { label: '基本工资合计', value: money(sum(list, 'basicSalary')), hint: '人员模板基本工资', tone: 'default' },
    { label: '绩效工资合计', value: money(sum(list, 'performanceSalary')), hint: '人员模板绩效工资', tone: 'default' },
  ]
}

function orgCards(list: OaRecord[]): SummaryCardItem[] {
  const departments = list.filter(row => row.orgType === '部门')
  const employees = list.filter(row => row.orgType === '员工')
  const positions = list.filter(row => row.orgType === '岗位')
  return [
    { label: '部门总数', value: departments.length, hint: '含子部门', tone: 'success' },
    { label: '员工总数', value: employees.length, hint: '员工档案', tone: 'primary' },
    { label: '在职员工', value: count(employees, row => row.status === '在职'), hint: '可参与审批', tone: 'success' },
    { label: '停用/离职员工', value: count(employees, row => ['停用', '离职'].includes(row.status)), hint: '不可作为审批人', tone: 'danger' },
    { label: '岗位总数', value: positions.length, hint: '岗位档案', tone: 'default' },
    { label: '未设置审批人', value: count(employees, row => !row.approver), hint: '需补齐审批关系', tone: 'warning' },
  ]
}

function vehicleCards(list: OaRecord[]): SummaryCardItem[] {
  const pendingRows = list.filter(row => ['待审批', '审批中'].includes(row.status))
  return [
    { label: '费用台账笔数', value: list.length, hint: '当前筛选范围', tone: 'primary' },
    { label: '费用总额', value: money(sum(list, 'totalFee')), hint: '燃油/通行/停车/维保等', tone: 'danger' },
    { label: '待审批金额', value: money(sum(pendingRows, 'totalFee')), hint: '需 OA 审批', tag: `${pendingRows.length} 笔`, tone: 'warning' },
    { label: '票据待补', value: count(list, row => row.attachmentStatus === '待补票' || !row.attachmentName), hint: '需补充附件', tag: '需及时处理', tone: 'warning' },
    { label: '即将到期提醒', value: count(list, row => isVehicleExpiring(row)), hint: '保险/年检 30 天内', tone: 'danger' },
    { label: '已归档费用', value: money(sum(list.filter(row => row.status === '已归档'), 'totalFee')), hint: '审批完成并归档', tone: 'success' },
  ]
}

function isVehicleExpiring(row: OaRecord) {
  const now = dayjs('2026-07-06')
  return ['insuranceDueDate', 'inspectionDueDate'].some((field) => {
    if (!row[field])
      return false
    const date = dayjs(row[field])
    return date.isAfter(now.subtract(1, 'day')) && date.diff(now, 'day') <= 30
  })
}

function statusColor(status: string) {
  if (/已同意|已结清|已发放|正常|空闲|已完成|已归档|已上传|已通知/.test(status))
    return 'green'
  if (/待|审批中|部分|使用中|已派车/.test(status))
    return 'orange'
  if (/驳回|逾期|异常|作废|停用|维修/.test(status))
    return 'red'
  return 'blue'
}

function displayCell(record: OaRecord, dataIndex: string) {
  if (moneyFields.has(dataIndex as MoneyField))
    return money(record[dataIndex])
  if (dataIndex === 'amount' && typeof record.amount === 'number')
    return money(record.amount)
  return record[dataIndex] ?? '-'
}

function enhanceColumns(columns: Array<Record<string, any>>): Array<Record<string, any>> {
  return columns.map((column) => {
    if (Array.isArray(column.children))
      return { ...column, children: enhanceColumns(column.children) }
    const dataIndex = columnKey(column.dataIndex)
    const enhanced: Record<string, any> = {
      ...column,
      width: column.width ?? inferOaColumnWidth(column, dataIndex),
      ellipsis: column.ellipsis ?? !['action', 'status', 'payStatus', 'dispatchStatus'].includes(dataIndex),
      customCell: () => ({ class: tableCellClass(dataIndex) }),
    }
    if (dataIndex === 'action')
      enhanced.align = 'center'
    else if (moneyFields.has(dataIndex) || ['amount', 'attendanceDays', 'financialYear', 'financialMonth', 'sequenceNo'].includes(dataIndex))
      enhanced.align = 'right'
    else if (/date|time|At|Month|Year/i.test(dataIndex))
      enhanced.align = 'center'

    if (dataIndex && dataIndex !== 'action' && !enhanced.sorter) {
      enhanced.sorter = (a: OaRecord, b: OaRecord) => compareTableValue(a[dataIndex], b[dataIndex])
    }
    return enhanced
  })
}

function inferOaColumnWidth(column: Record<string, any>, dataIndex: string) {
  const title = String(column.title ?? '')
  if (dataIndex === 'action')
    return 180
  if (['status', 'payStatus', 'dispatchStatus', 'billType', 'accountType', 'flowType', 'orgType'].includes(dataIndex))
    return 110
  if (['id', 'sequenceNo', 'sortNo', 'financialYear', 'financialMonth', 'attendanceDays', 'passengers', 'mileage'].includes(dataIndex))
    return 90
  if (moneyFields.has(dataIndex as MoneyField) || /amount|salary|balance|fee|tax/i.test(dataIndex))
    return 128
  if (/date|time|At|Month|Year/i.test(dataIndex))
    return /time|At/i.test(dataIndex) || title.includes('时间') ? 170 : 120
  if (/remark|usageSummary|responsibility|reminder|attachment|description|content/i.test(dataIndex))
    return 220
  if (/code|No|Bill|approvalNo/i.test(dataIndex))
    return 150
  if (/name|company|counterparty|department|position|role|account|bank|project|vehicle|applicant|handler|leader|approver|email/i.test(dataIndex))
    return 150

  const visualLength = Array.from(title).reduce((total, char) => total + (/[\u4E00-\u9FA5]/.test(char) ? 2 : 1), 0)
  if (visualLength <= 4)
    return 90
  if (visualLength <= 8)
    return 120
  if (visualLength <= 12)
    return 150
  return 180
}

function compareTableValue(a: unknown, b: unknown) {
  const aNumber = Number(String(a ?? '').replace(/[¥,]/g, ''))
  const bNumber = Number(String(b ?? '').replace(/[¥,]/g, ''))
  if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber))
    return aNumber - bNumber
  const aDate = dayjs(String(a ?? ''))
  const bDate = dayjs(String(b ?? ''))
  if (aDate.isValid() && bDate.isValid())
    return aDate.valueOf() - bDate.valueOf()
  return String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN')
}

function tableCellClass(dataIndex: string) {
  if (dataIndex === 'action')
    return 'table-cell-action'
  if (moneyFields.has(dataIndex) || ['amount', 'attendanceDays', 'financialYear', 'financialMonth', 'sequenceNo'].includes(dataIndex))
    return 'table-cell-money'
  if (/date|time|At|Month|Year/i.test(dataIndex))
    return 'table-cell-date'
  return ''
}

function asOaRecord(record: Record<string, any>) {
  return record as OaRecord
}

function asCashBalanceRecord(record: Record<string, any>) {
  return record as CashBalanceRecord
}

function columnKey(dataIndex: unknown) {
  return Array.isArray(dataIndex) ? String(dataIndex[0] ?? '') : String(dataIndex ?? '')
}

function statusCell(record: Record<string, any>, dataIndex: unknown) {
  return record[columnKey(dataIndex)] || '-'
}

function openDetail(record: OaRecord) {
  detailRecord.value = record
  detailOpen.value = true
}

function openOrgEmployeeFromTemplate(record: OaRecord) {
  const employee = record.sourceEmployee || orgEmployees.value.find(row => row.code === record.employeeId)
  if (!employee)
    return message.warning('未找到关联的组织架构人员')
  detailRecord.value = employee
  detailOpen.value = true
}

function openSalaryTemplateEdit(record: OaRecord) {
  Object.assign(salaryTemplateForm, {
    employeeId: record.employeeId,
    employeeName: record.employeeName,
    companyName: record.companyName,
    department: record.department,
    position: record.position,
    basicSalary: Number(record.basicSalary || 0),
    performanceSalary: Number(record.performanceSalary || 0),
    senioritySalary: Number(record.senioritySalary || 0),
    overtimeAllowance: Number(record.overtimeAllowance || 0),
    travelAllowance: Number(record.travelAllowance || 0),
    retroactiveSalary: Number(record.retroactiveSalary || 0),
    socialSecurityBase: Number(record.socialSecurityBase || 0),
    tax: Number(record.tax || 0),
    absenceDeductionPerDay: Number(record.absenceDeductionPerDay || 0),
    housingFundBase: Number(record.housingFundBase || 0),
    companyHousingFundRatePercent: Number(record.companyHousingFundRate || 0) * 100,
    personalHousingFundRatePercent: Number(record.personalHousingFundRate || 0) * 100,
    effectiveDate: dayjs().format('YYYY-MM-DD'),
    remark: '',
  })
  recalculateSalary(salaryTemplateForm as OaRecord)
  salaryTemplateOpen.value = true
}

async function saveSalaryDirectEntry() {
  const targets = salaryVisibleRows.value.filter(row => !['已锁定', '已发放', '已归档'].includes(String(row.status)))
  targets.forEach(row => recalculateSalary(row))
  if (!targets.length)
    return message.warning('当前没有可保存的工资记录')
  await persistOaModuleState(`已保存 ${targets.length} 人工资录入`, 'salary')
}

async function saveSalaryTemplate() {
  if (!salaryTemplateForm.position)
    return message.warning('岗位不能为空')
  salaryTemplateSaving.value = true
  try {
    await saveSalaryTemplateApi({ ...salaryTemplateForm, housingFundBase: 0, companyHousingFundRatePercent: 0, personalHousingFundRatePercent: 0 })
    salaryTemplateOpen.value = false
    await loadOaModuleState()
    message.success('岗位工资模板已保存，工资明细已同步')
  }
  finally {
    salaryTemplateSaving.value = false
  }
}

function recalculateSalaryTemplate() {
  salaryTemplateForm.companyHousingFundRate = Number(salaryTemplateForm.companyHousingFundRatePercent || 0) / 100
  salaryTemplateForm.personalHousingFundRate = Number(salaryTemplateForm.personalHousingFundRatePercent || 0) / 100
  recalculateSalary(salaryTemplateForm as OaRecord)
}

function openEdit(record: OaRecord) {
  editingRecord.value = { ...record }
  editOpen.value = true
}

function canInlineEditSalary(record: OaRecord) {
  return activeKey.value === 'salary' && !['审批通过', '已锁定', '已发放', '已作废', '已归档'].includes(record.status) && record.payStatus !== '已发放'
}

function startSalaryInlineEdit(record: OaRecord) {
  if (!canInlineEditSalary(record))
    return message.warning('当前工资记录不能在表格中修改')
  salaryInlineSnapshot.value = JSON.parse(JSON.stringify(record))
  salaryInlineEditingId.value = record.id
}

function cancelSalaryInlineEdit(record: OaRecord) {
  if (salaryInlineSnapshot.value && salaryInlineSnapshot.value.id === record.id) {
    const index = activeProfile.value.rows.findIndex(item => item.id === record.id)
    if (index > -1)
      activeProfile.value.rows[index] = salaryInlineSnapshot.value
  }
  salaryInlineEditingId.value = ''
  salaryInlineSnapshot.value = undefined
}

async function saveSalaryInlineEdit(record: OaRecord) {
  if (!validateRecord(record))
    return
  prepareCumulativeSalary(record)
  recalculateSalary(record)
  salaryInlineEditingId.value = ''
  salaryInlineSnapshot.value = undefined
  await persistOaModuleState('工资记录已保存')
}

async function saveEdit() {
  if (saving.value)
    return
  if (!editingRecord.value)
    return
  const record = editingRecord.value
  if (!validateRecord(record))
    return
  recalculateRecord(record)
  const list = activeProfile.value.rows
  const index = list.findIndex(item => item.id === record.id)
  if (index > -1)
    list[index] = record
  else
    list.unshift(record)
  await persistOaModuleState('保存成功')
  editOpen.value = false
}

async function deleteRecord(record: OaRecord) {
  const list = activeProfile.value.rows
  const index = list.findIndex(item => item.id === record.id)
  if (index > -1) {
    list.splice(index, 1)
    await persistOaModuleState('删除成功')
  }
}

const openReceivableOptions = computed(() => moduleProfiles.receivable.rows.filter(row =>
  row.billType === '应收' && Number(row.unpaidAmount || 0) > 0 && row.status !== '作废',
))
const openPayableOptions = computed(() => moduleProfiles.receivable.rows.filter(row =>
  row.billType === '应付' && Number(row.unpaidAmount || 0) > 0 && !['作废', '已结清'].includes(row.status),
))

const receiptAllocationTotal = computed(() => receiptAllocationRows.value.reduce((total, row) => total + Number(row.amount || 0), 0))
const receiptAllocationRemaining = computed(() => Math.max(
  Number(allocatingReceipt.value?.unrecognizedAmount || 0) - receiptAllocationTotal.value,
  0,
))
const receiptAccountBalanceAfterRegistration = computed(() =>
  Number(selectedReceiptCashAccount.value?.balance_amount || 0) + Number(receiptForm.amount || 0),
)
const receiptAllocationAccountBalanceAfterPosting = computed(() => {
  const account = selectedReceiptAllocationCashAccount.value
  const receipt = allocatingReceipt.value
  if (!account || !receipt)
    return 0
  return Number(account.balance_amount || 0) + (receipt.balancePostedAt ? 0 : Number(receipt.incomeAmount || 0))
})
const activeCashBalanceMovements = computed(() =>
  Array.isArray(activeCashBalance.value?.balanceMovements) ? activeCashBalance.value!.balanceMovements! : [],
)
const paymentAllocationTotal = computed(() => paymentAllocationRows.value.reduce((total, row) => total + Number(row.amount || 0), 0))

function receiptAllocationLimit(receivableId: string) {
  const receivable = openReceivableOptions.value.find(item => item.id === receivableId)
  return Number(receivable?.unpaidAmount || 0)
}

function receiptAllocationReceivable(receivableId: string) {
  return openReceivableOptions.value.find(item => item.id === receivableId)
}

function resetReceiptForm() {
  Object.assign(receiptForm, {
    cashBalanceId: '',
    accountName: '',
    amount: 0,
    receiptDate: dayjs().format('YYYY-MM-DD'),
    payerName: '',
    bankSerialNo: '',
    accountType: '银行账户',
    receiptType: '应收回款',
    remark: '',
  })
}

function cashBalanceOptionLabel(account: CashBalanceRecord) {
  return [...new Set([
    account.company_name,
    account.bank_name,
    account.account_name,
    account.account_no_tail ? `账号 ${account.account_no_tail}` : '',
  ].filter(Boolean))].join(' · ')
}

function cashBalanceCompactLabel(account: CashBalanceRecord) {
  return [
    account.account_no_tail ? `账号 ${account.account_no_tail}` : '',
    account.bank_name,
    account.account_name,
  ].filter(Boolean).join(' · ')
}

function handleReceiptCashAccountChange(id: unknown) {
  if (typeof id !== 'string' && typeof id !== 'number')
    return
  const account = cashBalanceRecords.value.find(row => String(row.id) === String(id))
  receiptForm.accountName = account?.bank_name || account?.account_name || ''
}

function inferReceiptCashBalanceId(receipt: OaRecord) {
  if (receipt.cashBalanceId && cashBalanceRecords.value.some(row => String(row.id) === String(receipt.cashBalanceId)))
    return String(receipt.cashBalanceId)
  const candidates = cashBalanceRecords.value.filter(account =>
    [account.account_name, account.bank_name].some(value => String(value || '').trim() === String(receipt.accountName || '').trim())
    || (receipt.accountNo && String(account.account_no_tail) === String(receipt.accountNo)),
  )
  return candidates.length === 1 ? candidates[0].id : ''
}

function openReceiptModal() {
  resetReceiptForm()
  receiptOpen.value = true
}

async function saveReceipt() {
  if (!receiptForm.cashBalanceId || !receiptForm.accountName.trim() || !receiptForm.payerName.trim() || !receiptForm.bankSerialNo.trim())
    return message.warning('请完整填写收款账户、付款方和银行流水号')
  if (!receiptForm.receiptDate || Number(receiptForm.amount) <= 0)
    return message.warning('请填写有效到账日期和来款金额')
  saving.value = true
  try {
    await registerReceiptApi({ ...receiptForm, handler: userStore.nickname || currentUser.value?.nickname || '' })
    receiptOpen.value = false
    await loadOaModuleState()
    message.success('来款已登记，当前状态为未认领')
  }
  catch (error: any) {
    message.error(error?.message || '来款登记失败')
  }
  finally {
    saving.value = false
  }
}

function addReceiptAllocationRow() {
  receiptAllocationRows.value.push({ receivableId: '', amount: 0, remark: '' })
}

function openReceiptAllocation(record: OaRecord) {
  allocatingReceipt.value = record
  receiptAllocationRows.value = [{ receivableId: '', amount: 0, remark: '' }]
  receiptAllocationCashBalanceId.value = inferReceiptCashBalanceId(record)
  receiptAllocationBatchId.value = `RA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  receiptAllocationOpen.value = true
}

async function saveReceiptAllocation() {
  const receipt = allocatingReceipt.value
  if (!receipt)
    return
  if (receiptAllocationRows.value.some(row => !row.receivableId || Number(row.amount) <= 0))
    return message.warning('请选择应收单并填写有效核销金额')
  if (!receiptAllocationCashBalanceId.value)
    return message.warning('请选择核销对应的收款账户')
  if (new Set(receiptAllocationRows.value.map(row => row.receivableId)).size !== receiptAllocationRows.value.length)
    return message.warning('同一应收单请合并为一行核销')
  if (receiptAllocationRows.value.some(row => Number(row.amount) > receiptAllocationLimit(row.receivableId)))
    return message.warning('核销金额不能超过对应应收单的未收金额')
  if (receiptAllocationTotal.value > Number(receipt.unrecognizedAmount || 0))
    return message.warning('核销合计不能超过未认领金额')
  saving.value = true
  try {
    await allocateReceiptApi(receipt.id, {
      allocations: receiptAllocationRows.value,
      cashBalanceId: receiptAllocationCashBalanceId.value,
      allocationBatchId: receiptAllocationBatchId.value,
      handler: userStore.nickname || currentUser.value?.nickname || '',
    })
    receiptAllocationOpen.value = false
    await loadOaModuleState()
    message.success(receipt.balancePostedAt ? '来款核销成功' : '来款核销成功，到账金额已计入对应账户')
  }
  catch (error: any) {
    message.error(error?.message || '来款核销失败')
  }
  finally {
    saving.value = false
  }
}

function resetPaymentForm(record?: OaRecord) {
  Object.assign(paymentForm, {
    paymentRequestNo: `PAY-${dayjs().format('YYYYMMDDHHmmss')}-${String(Date.now()).slice(-4)}`,
    cashBalanceId: '',
    companyName: '',
    accountName: '',
    accountNo: '',
    paymentDate: dayjs().format('YYYY-MM-DD'),
    payeeName: record?.counterparty || '',
    accountType: '银行账户',
    paymentMethod: '银行转账',
    remark: record?.remark || '',
  })
  paymentAllocationRows.value = record
    ? [{ payableId: record.id, amount: Number(record.unpaidAmount || 0), remark: '' }]
    : [{ payableId: '', amount: 0, remark: '' }]
}

function openPaymentModal(record?: OaRecord) {
  resetPaymentForm(record)
  paymentOpen.value = true
}

function selectPaymentCompany() {
  paymentForm.cashBalanceId = ''
  paymentForm.accountName = ''
  paymentForm.accountNo = ''
}

function selectPaymentAccount(id: unknown) {
  const account = cashBalanceRecords.value.find(row => row.id === String(id || ''))
  paymentForm.accountName = account?.account_no_tail || ''
  paymentForm.accountNo = account?.account_no_tail || ''
}

function addPaymentAllocationRow() {
  paymentAllocationRows.value.push({ payableId: '', amount: 0, remark: '' })
}

function validatePaymentInstructionForm() {
  if (!paymentForm.paymentRequestNo.trim() || !paymentForm.cashBalanceId || !paymentForm.companyName.trim() || !paymentForm.accountName.trim() || !paymentForm.payeeName.trim()) {
    message.warning('请完整选择主体、账号并填写付款请求号和收款方')
    return false
  }
  if (!paymentForm.paymentDate || paymentAllocationRows.value.some(row => !row.payableId || Number(row.amount) <= 0)) {
    message.warning('请选择应付单并填写有效付款金额')
    return false
  }
  if (selectedPaymentCashAccount.value && paymentAllocationTotal.value > Number(selectedPaymentCashAccount.value.balance_amount || 0)) {
    message.warning('付款金额超过所选账号的现金余额')
    return false
  }
  if (new Set(paymentAllocationRows.value.map(row => row.payableId)).size !== paymentAllocationRows.value.length) {
    message.warning('同一应付单请合并为一行付款')
    return false
  }
  return true
}

function confirmPaymentInstruction() {
  if (!validatePaymentInstructionForm())
    return
  Modal.confirm({
    title: '再次确认付款',
    content: `${paymentForm.companyName} · ${paymentForm.accountNo}，向 ${paymentForm.payeeName} 付款 ${money(paymentAllocationTotal.value)}。确认后将在现金管理生成待支付记录。`,
    okText: '确认并生成付款',
    cancelText: '返回修改',
    onOk: savePaymentInstruction,
  })
}

async function savePaymentInstruction() {
  saving.value = true
  try {
    await createPaymentApi({
      ...paymentForm,
      allocations: paymentAllocationRows.value,
      handler: userStore.nickname || currentUser.value?.nickname || '',
    })
    paymentOpen.value = false
    message.success('付款已确认，已在现金管理生成待支付记录')
    await router.push('/oa-approval/cash')
    await loadOaModuleState()
  }
  catch (error: any) {
    message.error(error?.message || '付款指令创建失败')
  }
  finally {
    saving.value = false
  }
}

function openPaymentConfirm(record: OaRecord) {
  activePayment.value = record
  paymentConfirmForm.bankSerialNo = ''
  paymentConfirmForm.paidAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
  paymentConfirmOpen.value = true
}

async function submitPaymentToBank(record: OaRecord) {
  saving.value = true
  try {
    await submitPaymentApi(record.id)
    await loadOaModuleState()
    message.success('付款指令已提交银行，等待异步结果')
  }
  catch (error: any) {
    message.error(error?.message || '提交银行失败')
  }
  finally {
    saving.value = false
  }
}

async function savePaymentConfirm() {
  if (!activePayment.value || !paymentConfirmForm.bankSerialNo.trim())
    return message.warning('请填写银行流水号')
  saving.value = true
  try {
    await confirmPaymentApi(activePayment.value.id, {
      ...paymentConfirmForm,
      handler: userStore.nickname || currentUser.value?.nickname || '',
    })
    paymentConfirmOpen.value = false
    await loadOaModuleState()
    message.success('支付已确认，应付和现金流水已同步更新')
  }
  catch (error: any) {
    message.error(error?.message || '支付确认失败')
  }
  finally {
    saving.value = false
  }
}

function openPaymentFailure(record: OaRecord) {
  activePayment.value = record
  paymentFailureReason.value = ''
  paymentFailOpen.value = true
}

async function savePaymentFailure() {
  if (!activePayment.value || !paymentFailureReason.value.trim())
    return message.warning('请填写支付失败原因')
  saving.value = true
  try {
    await failPaymentApi(activePayment.value.id, paymentFailureReason.value)
    paymentFailOpen.value = false
    await loadOaModuleState()
    message.success('已记录支付失败，应付金额未发生变化')
  }
  catch (error: any) {
    message.error(error?.message || '支付失败状态保存失败')
  }
  finally {
    saving.value = false
  }
}

function resetCashBalanceForm() {
  editingBalanceId.value = ''
  cashBalanceForm.balance_date = dayjs().format('YYYY-MM-DD')
  cashBalanceForm.company_name = ''
  cashBalanceForm.bank_name = ''
  cashBalanceForm.account_name = ''
  cashBalanceForm.account_no_tail = ''
  cashBalanceForm.balance_amount = 0
  cashBalanceForm.remark = ''
}

function openCashBalanceModal(record?: CashBalanceRecord) {
  if (!canManageCashBalance.value)
    return message.warning('当前用户无现金余额维护权限')
  if (record) {
    editingBalanceId.value = record.id
    Object.assign(cashBalanceForm, record)
  }
  else {
    resetCashBalanceForm()
  }
  cashBalanceOpen.value = true
}

function openCashBalanceHistory(record: CashBalanceRecord) {
  activeCashBalance.value = record
  cashBalanceHistoryOpen.value = true
}

function validateCashBalanceForm(record: typeof cashBalanceForm | CashBalanceDraft) {
  if (!record.company_name || !record.bank_name || !record.account_name || !record.account_no_tail) {
    message.warning('请填写主体、银行、账户名称和账号')
    return false
  }
  if (!dayjs(record.balance_date).isValid()) {
    message.warning('统计日期格式不正确')
    return false
  }
  if (Number(record.balance_amount) < 0) {
    message.warning('余额金额不能为负数')
    return false
  }
  return true
}

async function saveCashBalance() {
  if (saving.value)
    return
  if (!validateCashBalanceForm(cashBalanceForm))
    return
  const duplicate = cashBalanceRecords.value.some(row =>
    row.id !== editingBalanceId.value
    && row.company_name === cashBalanceForm.company_name
    && row.bank_name === cashBalanceForm.bank_name
    && row.account_no_tail === cashBalanceForm.account_no_tail,
  )
  if (duplicate)
    return message.warning('同一主体、银行和账号已存在余额记录')
  const existingRecord = cashBalanceRecords.value.find(row => row.id === editingBalanceId.value)
  const now = dayjs().format('YYYY-MM-DD HH:mm')
  const payload: CashBalanceRecord = {
    id: editingBalanceId.value || `cb-${Date.now()}`,
    balance_date: cashBalanceForm.balance_date,
    company_name: cashBalanceForm.company_name,
    bank_name: cashBalanceForm.bank_name,
    account_name: cashBalanceForm.account_name,
    account_no_tail: cashBalanceForm.account_no_tail,
    balance_amount: Number(cashBalanceForm.balance_amount || 0),
    remark: cashBalanceForm.remark,
    created_by: existingRecord?.created_by ?? currentUser.value?.id ?? 1,
    created_at: existingRecord?.created_at ?? now,
    updated_by: currentUser.value?.id ?? 1,
    updated_at: now,
    balanceMovements: existingRecord?.balanceMovements,
  }
  const index = cashBalanceRecords.value.findIndex(row => row.id === payload.id)
  if (index > -1)
    cashBalanceRecords.value[index] = payload
  else
    cashBalanceRecords.value.unshift(payload)
  await persistOaModuleState(editingBalanceId.value ? '余额记录已更新' : '余额记录已新增', 'cashBalance')
  cashBalanceOpen.value = false
}

async function deleteCashBalance(record: CashBalanceRecord) {
  if (!canManageCashBalance.value)
    return message.warning('当前用户无现金余额删除权限')
  const index = cashBalanceRecords.value.findIndex(row => row.id === record.id)
  if (index > -1) {
    cashBalanceRecords.value.splice(index, 1)
    await persistOaModuleState('余额记录已删除', 'cashBalance')
  }
}

function resetBatchRows() {
  batchBalanceRows.value = [
    { balance_date: dayjs().format('YYYY-MM-DD'), company_name: '', bank_name: '', account_name: '', account_no_tail: '', balance_amount: 0, remark: '', created_by: currentUser.value?.id ?? 1, created_at: dayjs().format('YYYY-MM-DD HH:mm') },
    { balance_date: dayjs().format('YYYY-MM-DD'), company_name: '', bank_name: '', account_name: '', account_no_tail: '', balance_amount: 0, remark: '', created_by: currentUser.value?.id ?? 1, created_at: dayjs().format('YYYY-MM-DD HH:mm') },
    { balance_date: dayjs().format('YYYY-MM-DD'), company_name: '', bank_name: '', account_name: '', account_no_tail: '', balance_amount: 0, remark: '', created_by: currentUser.value?.id ?? 1, created_at: dayjs().format('YYYY-MM-DD HH:mm') },
  ]
}

function openBatchBalanceModal() {
  if (!canManageCashBalance.value)
    return message.warning('当前用户无现金余额维护权限')
  resetBatchRows()
  batchBalanceOpen.value = true
}

function addBatchBalanceRow() {
  batchBalanceRows.value.push({ balance_date: dayjs().format('YYYY-MM-DD'), company_name: '', bank_name: '', account_name: '', account_no_tail: '', balance_amount: 0, remark: '', created_by: currentUser.value?.id ?? 1, created_at: dayjs().format('YYYY-MM-DD HH:mm') })
}

function removeBatchBalanceRow(index: number) {
  batchBalanceRows.value.splice(index, 1)
}

function validateBatchRows() {
  const validRows = batchBalanceRows.value.filter(row => row.company_name || row.bank_name || row.account_no_tail || Number(row.balance_amount) > 0)
  if (!validRows.length) {
    message.warning('请至少录入一条余额记录')
    return []
  }
  const uniqueKeys = new Set<string>()
  for (const row of validRows) {
    if (!validateCashBalanceForm(row))
      return []
    const key = `${row.company_name}-${row.bank_name}-${row.account_no_tail}`
    if (uniqueKeys.has(key)) {
      message.warning('批量录入中存在重复的主体、银行和账号')
      return []
    }
    uniqueKeys.add(key)
  }
  return validRows
}

function openBatchConfirm() {
  if (!validateBatchRows().length)
    return
  batchConfirmOpen.value = true
}

async function submitBatchBalances() {
  if (saving.value)
    return
  const validRows = validateBatchRows()
  if (!validRows.length)
    return
  validRows.forEach((row, index) => {
    const existingIndex = cashBalanceRecords.value.findIndex(item =>
      item.company_name === row.company_name
      && item.bank_name === row.bank_name
      && item.account_no_tail === row.account_no_tail,
    )
    const existingRecord = existingIndex > -1 ? cashBalanceRecords.value[existingIndex] : undefined
    const now = dayjs().format('YYYY-MM-DD HH:mm')
    const payload: CashBalanceRecord = {
      ...row,
      id: existingRecord?.id ?? `cb-batch-${Date.now()}-${index}`,
      account_name: row.account_name,
      balance_amount: Number(row.balance_amount || 0),
      created_by: existingRecord?.created_by ?? row.created_by ?? currentUser.value?.id ?? 1,
      created_at: existingRecord?.created_at ?? now,
      updated_by: currentUser.value?.id ?? 1,
      updated_at: now,
      balanceMovements: existingRecord?.balanceMovements,
    }
    if (existingIndex > -1)
      cashBalanceRecords.value[existingIndex] = payload
    else
      cashBalanceRecords.value.unshift(payload)
  })
  await persistOaModuleState('现金余额记录已保存', 'cashBalance')
  batchConfirmOpen.value = false
  batchBalanceOpen.value = false
}

async function updateStatus(record: OaRecord, status: string, successText: string) {
  if (activeKey.value === 'vehicle' && ['待审批', '已同意', '已归档'].includes(status) && !validateRecord(record))
    return
  record.status = status
  if (activeKey.value === 'vehicle') {
    if (['已同意', '已驳回', '已撤回'].includes(status))
      record.notifyStatus = '已通知申请人'
    if (status === '待审批')
      record.notifyStatus = '已通知审批人'
  }
  await persistOaModuleState(successText)
}

async function archiveVehicleExpense(record: OaRecord) {
  if (Number(record.totalFee) < 0)
    return message.warning('费用金额不能为负数')
  if (!record.attachmentName)
    return message.warning('请先上传或关联票据附件')
  record.status = '已归档'
  record.notifyStatus = '已通知申请人'
  await persistOaModuleState('费用已归档并通知申请人')
}

async function reuploadVehicleAttachment(record: OaRecord) {
  record.attachmentName = record.attachmentName || `${record.code}_票据.pdf`
  record.attachmentStatus = '已上传'
  record.notifyStatus = '已通知审批人'
  if (record.reminderText === '票据待补')
    record.reminderText = '-'
  await persistOaModuleState('票据已重新上传')
}

async function sendVehicleReminder(record: OaRecord) {
  record.notifyStatus = '已通知责任人'
  await persistOaModuleState('已发送到期/补票提醒')
}

function validateRecord(record: OaRecord) {
  if (activeKey.value === 'salary') {
    recalculateSalary(record)
    if (!record.companyName || !record.employeeName || !record.position) {
      message.warning('请填写公司、姓名和岗位')
      return false
    }
    if (!record.financialYear || !record.financialMonth) {
      message.warning('请填写财务年和财务月')
      return false
    }
    const duplicate = activeProfile.value.rows.some(row =>
      row.id !== record.id
      && row.companyName === record.companyName
      && row.financialYear === record.financialYear
      && row.financialMonth === record.financialMonth
      && row.employeeName === record.employeeName,
    )
    if (duplicate) {
      message.warning('同公司、同财务年、同财务月、同员工的工资不能重复')
      return false
    }
    if (['审批通过', '已发放', '已作废'].includes(record.status) && record.id && activeProfile.value.rows.some(row => row.id === record.id)) {
      const original = activeProfile.value.rows.find(row => row.id === record.id)
      if (original && ['审批通过', '已发放', '已作废'].includes(original.status) && editOpen.value) {
        message.warning('审批通过、已发放或已作废工资不能随意编辑')
        return false
      }
    }
  }
  if (activeKey.value === 'vehicle') {
    if (!record.vehicleName || !record.plateNo) {
      message.warning('请关联车辆和车牌')
      return false
    }
    if (!record.department || !record.applicant) {
      message.warning('请关联员工和部门')
      return false
    }
    if (!record.expenseType) {
      message.warning('请选择费用类型')
      return false
    }
    if (record.startTime && record.endTime && record.endTime < record.startTime) {
      message.warning('用车结束时间不能早于开始时间')
      return false
    }
    if (Number(record.passengers ?? 0) < 0) {
      message.warning('乘车人数不能为负数')
      return false
    }
    if (['fuelFee', 'tollFee', 'parkingFee', 'maintenanceFee', 'insuranceFee', 'inspectionFee', 'otherFee', 'totalFee'].some(field => Number(record[field] ?? 0) < 0)) {
      message.warning('费用金额不能为负数')
      return false
    }
    if (['待审批', '审批中', '已同意', '已归档'].includes(record.status) && !record.attachmentName) {
      message.warning('请先上传或关联票据附件')
      return false
    }
  }
  if (activeKey.value === 'org') {
    const duplicate = activeProfile.value.rows.some(row => row.id !== record.id && row.orgType === record.orgType && row.parentDepartment === record.parentDepartment && row.name === record.name)
    if (duplicate) {
      message.warning(record.orgType === '部门' ? '同一上级部门下部门名称不能重复' : '名称不能重复')
      return false
    }
  }
  return true
}

function recalculateRecord(record: OaRecord) {
  if (activeKey.value === 'salary')
    recalculateSalary(record)
  if (activeKey.value === 'vehicle') {
    record.timeRange = record.startTime && record.endTime ? `${record.startTime}-${record.endTime}` : record.timeRange
    record.vehicleInfo = record.vehicleName && record.plateNo ? `${record.vehicleName} / ${record.plateNo}` : record.vehicleInfo
    if (!record.usageSummary || record.usageSummary === '-') {
      const route = [record.departure, record.destination].filter(Boolean).join('-')
      record.usageSummary = [route, record.reason, record.mileage ? `${record.mileage}km` : ''].filter(Boolean).join(' / ') || '-'
    }
    record.attachmentStatus = record.attachmentName ? '已上传' : '待补票'
    record.totalFee = ['fuelFee', 'tollFee', 'parkingFee', 'maintenanceFee', 'insuranceFee', 'inspectionFee', 'otherFee'].reduce((total, field) => total + Number(record[field] ?? 0), 0)
  }
}

function recalculateSalary(record: OaRecord) {
  calculateSalary(record)
  record.allowanceBonus = Number(record.senioritySalary || 0) + Number(record.subsidy || 0) + Number(record.bonus || 0) + Number(record.overtimePay || 0)
}

function prepareCumulativeSalary(record: OaRecord) {
  const previous = moduleProfiles.salary.rows.filter(row =>
    row.id !== record.id
    && row.employeeId === record.employeeId
    && row.financialYear === record.financialYear
    && Number(row.financialMonth || 0) < Number(record.financialMonth || 0),
  )
  record.cumulativePriorIncome = sum(previous, 'grossSalary')
  record.cumulativePriorSocialFund = sum(previous, 'personalSocialSecurityTotal') + sum(previous, 'personalHousingFund')
  record.cumulativeSpecialAdditionalDeduction = sum(previous, 'specialAdditionalDeduction')
  record.cumulativeOtherPreTaxDeduction = sum(previous, 'otherPreTaxDeduction')
  record.cumulativeTaxPaid = sum(previous, 'tax')
}

async function lockVisibleSalaries() {
  const targets = salaryVisibleRows.value.filter(row => ['草稿', '待补录'].includes(String(row.status)))
  if (!targets.length) {
    message.warning('当前筛选范围没有可锁定的工资记录')
    return
  }
  const incomplete = targets.filter(row => !row.companyName || !row.employeeName || !row.position || Number(row.actualAttendanceDays ?? row.attendanceDays ?? 0) <= 0)
  const content = incomplete.length
    ? `将锁定 ${targets.length} 人工资，其中 ${incomplete.length} 人存在公司、姓名、岗位或出勤天数未完成。锁定后只能按工资流程更正，是否继续？`
    : `将锁定 ${targets.length} 人工资。锁定后不能直接编辑、删除或回退状态，是否继续？`
  const snapshots = targets.map(row => ({ row, value: JSON.parse(JSON.stringify(row)) }))
  Modal.confirm({
    title: '确认锁定本月工资',
    content,
    okText: incomplete.length ? '仍然锁定' : '确认锁定',
    cancelText: '返回检查',
    okButtonProps: { danger: incomplete.length > 0 },
    onOk: async () => {
      try {
        targets.forEach((row) => {
          prepareCumulativeSalary(row)
          recalculateSalary(row)
          row.status = '已锁定'
        })
        await persistOaModuleState(`已锁定 ${targets.length} 人工资`, 'salary')
      }
      catch (error) {
        snapshots.forEach(({ row, value }) => Object.assign(row, value))
        throw error
      }
    },
  })
}

function buildActions(record: OaRecord): RecordActionItem[] {
  const locked = ['已同意', '已结清', '已发放', '作废', '已完成', '已归档'].includes(record.status)
  const approvalAction: RecordActionItem = {
    key: 'approval-detail',
    label: '审批详情',
    hidden: !record.approvalInstanceId,
    onClick: () => router.push({ path: '/oa-approval/center', query: { approvalInstanceId: record.approvalInstanceId } }),
  }
  if (activeKey.value === 'salary') {
    const salaryLocked = ['审批通过', '已锁定', '已发放', '已作废', '已归档'].includes(record.status) || record.payStatus === '已发放'
    return [
      approvalAction,
      { key: 'view', label: '查看', onClick: () => openDetail(record) },
      { key: 'person-template', label: '工资模板', hidden: salaryLocked, onClick: () => openSalaryTemplateEdit(record) },
      { key: 'inline-edit', label: '表格填写', hidden: salaryInlineEditingId.value === record.id || salaryLocked, onClick: () => startSalaryInlineEdit(record) },
      { key: 'inline-save', label: '保存', hidden: salaryInlineEditingId.value !== record.id, onClick: () => saveSalaryInlineEdit(record) },
      { key: 'inline-cancel', label: '取消', hidden: salaryInlineEditingId.value !== record.id, onClick: () => cancelSalaryInlineEdit(record) },
      { key: 'edit', label: '编辑', hidden: salaryLocked, onClick: () => openEdit(record) },
      {
        key: 'lock',
        label: '复核锁定',
        hidden: !['草稿', '待补录'].includes(record.status),
        confirm: true,
        confirmTitle: '确定锁定该工资记录？锁定后不能直接编辑、删除或回退状态。',
        onClick: async () => {
          const snapshot = JSON.parse(JSON.stringify(record))
          try {
            prepareCumulativeSalary(record)
            recalculateSalary(record)
            record.status = '已锁定'
            await persistOaModuleState('工资已锁定', 'salary')
          }
          catch (error) {
            Object.assign(record, snapshot)
            throw error
          }
        },
      },
      { key: 'revoke', label: '撤回', hidden: record.status !== '待审批', confirm: true, confirmTitle: '确定撤回该工资审批？', onClick: () => updateStatus(record, '草稿', '已撤回') },
      {
        key: 'pay',
        label: '发放确认',
        hidden: record.status !== '审批通过' || record.payStatus === '已发放',
        onClick: async () => {
          record.payStatus = '已发放'
          record.status = '已发放'
          await persistOaModuleState('已确认发放')
        },
      },
      { key: 'archive', label: '归档', hidden: !['审批通过', '已发放'].includes(record.status), onClick: () => updateStatus(record, '已归档', '工资记录已归档') },
      { key: 'delete', label: '删除', hidden: record.payStatus === '已发放', danger: true, confirm: true, confirmTitle: '确定删除该工资记录？', onClick: () => deleteRecord(record) },
    ]
  }
  if (activeKey.value === 'vehicle') {
    const vehicleLocked = ['作废', '已归档'].includes(record.status)
    return [
      approvalAction,
      { key: 'view', label: '查看', onClick: () => openDetail(record) },
      { key: 'edit', label: '编辑', hidden: vehicleLocked || ['已同意'].includes(record.status), onClick: () => openEdit(record) },
      { key: 'revoke', label: '撤回', hidden: !['待审批', '审批中'].includes(record.status), confirm: true, confirmTitle: '确定撤回该审批？', onClick: () => updateStatus(record, '已撤回', '已撤回') },
      { key: 'preview', label: '预览票据', hidden: !record.attachmentName, onClick: () => openDetail(record) },
      { key: 'download', label: '下载票据', hidden: !record.attachmentName, onClick: () => message.success(`已下载 ${record.attachmentName}`) },
      { key: 'reupload', label: '重新上传', hidden: vehicleLocked, onClick: () => reuploadVehicleAttachment(record) },
      { key: 'archive', label: '归档', hidden: record.status !== '已同意', onClick: () => archiveVehicleExpense(record) },
      { key: 'remind', label: '发送提醒', hidden: record.reminderText === '-' && record.notifyStatus !== '待通知', onClick: () => sendVehicleReminder(record) },
      { key: 'flow', label: '查看审批流', onClick: () => openDetail(record) },
      { key: 'void', label: '作废', hidden: record.status === '作废', danger: true, confirm: true, confirmTitle: '确定作废该费用台账？', onClick: () => updateStatus(record, '作废', '已作废') },
      { key: 'delete', label: '删除', hidden: locked, danger: true, confirm: true, confirmTitle: '确定删除该费用台账？', onClick: () => deleteRecord(record) },
    ]
  }
  if (activeKey.value === 'receivable' && record.billType === '应付') {
    return [
      approvalAction,
      { key: 'view', label: '查看', onClick: () => openDetail(record) },
      {
        key: 'pay',
        label: '发起付款',
        hidden: Number(record.unpaidAmount || 0) <= 0 || ['作废', '已结清'].includes(record.status),
        onClick: () => openPaymentModal(record),
      },
    ]
  }
  if (activeKey.value === 'cash' && record.flowType === '付款执行') {
    return [
      { key: 'view', label: '查看', onClick: () => openDetail(record) },
      { key: 'submit-payment', label: '提交银行', hidden: record.paymentStatus !== 'PENDING', confirm: true, confirmTitle: '确认将该付款指令提交银行执行？', onClick: () => submitPaymentToBank(record) },
      { key: 'confirm-payment', label: '人工确认', hidden: !['PENDING', 'PROCESSING'].includes(record.paymentStatus), onClick: () => openPaymentConfirm(record) },
      { key: 'fail-payment', label: '支付失败', danger: true, hidden: !['PENDING', 'PROCESSING'].includes(record.paymentStatus), onClick: () => openPaymentFailure(record) },
    ]
  }
  if (activeKey.value === 'cash' && record.flowType === '来款登记') {
    return [
      approvalAction,
      { key: 'view', label: '查看', onClick: () => openDetail(record) },
      {
        key: 'allocate',
        label: '核销',
        hidden: Number(record.unrecognizedAmount || 0) <= 0 || record.status === '作废',
        onClick: () => openReceiptAllocation(record),
      },
    ]
  }
  return [
    approvalAction,
    { key: 'view', label: '查看', onClick: () => openDetail(record) },
    { key: 'edit', label: '编辑', hidden: locked, onClick: () => openEdit(record) },
    { key: 'transfer', label: '转交', hidden: !['待审批', '审批中'].includes(record.status), onClick: () => message.success('已转交审批人') },
    { key: 'revoke', label: '撤回', hidden: !['待审批', '审批中'].includes(record.status), confirm: true, confirmTitle: '确定撤回该审批？', onClick: () => updateStatus(record, '已撤回', '已撤回') },
    { key: 'flow', label: '查看审批流', onClick: () => openDetail(record) },
    { key: 'void', label: '作废', hidden: record.status === '作废', danger: true, confirm: true, confirmTitle: '确定作废该记录？', onClick: () => updateStatus(record, '作废', '已作废') },
    { key: 'delete', label: '删除', hidden: locked, danger: true, confirm: true, confirmTitle: '确定删除该记录？', onClick: () => deleteRecord(record) },
  ]
}

function visibleRowActions(record: OaRecord) {
  return buildActions(record).filter(action => !action.hidden)
}

function inlineRowActions(record: OaRecord) {
  if (activeKey.value === 'salary' && salaryActiveTab.value === 'records')
    return []
  return visibleRowActions(record).slice(0, 3)
}

function moreRowActions(record: OaRecord) {
  if (activeKey.value === 'salary' && salaryActiveTab.value === 'records')
    return visibleRowActions(record)
  return visibleRowActions(record).slice(3)
}

function runRowAction(action: RecordActionItem) {
  if (action.disabled)
    return
  return action.onClick()
}

function handleQuery() {
  pagination.current = 1
  salaryInlineEditingId.value = ''
  salaryInlineSnapshot.value = undefined
}

function resetQuery() {
  queryModel.status = undefined
  queryModel.keyword = ''
  queryModel.companyName = undefined
  queryModel.payStatus = undefined
  queryModel.orgPosition = undefined
  resetFinancialPeriodFilter(salaryDefaultPeriod())
  pagination.current = 1
  salaryInlineEditingId.value = ''
  salaryInlineSnapshot.value = undefined
}

function exportRows() {
  if (activeKey.value === 'salary' && salaryActiveTab.value === 'records') {
    exportMonthlyPayroll()
    return
  }
  const workbook = XLSX.utils.book_new()
  const flattenColumns = (columns: Array<Record<string, any>>): Array<Record<string, any>> => columns.flatMap(column => Array.isArray(column.children) ? flattenColumns(column.children) : [column])
  const exportColumns = activeKey.value === 'salary'
    ? flattenColumns(tableColumns.value).filter(column => column.dataIndex !== 'action')
    : activeProfile.value.columns
  const exportSource = activeKey.value === 'salary' ? salaryVisibleRows.value : filteredRows.value
  const conditionRows = [{
    页面: activeProfile.value.title,
    页签: activeKey.value === 'salary' ? (salaryActiveTab.value === 'templates' ? '工资模板' : '工资表') : '',
    财务年: financialPeriodFilter.financialYear || '',
    财务月: financialPeriodFilter.financialMonth || '',
    起始日期: financialPeriodFilter.dateRange?.[0]?.format('YYYY-MM-DD') || '',
    结束日期: financialPeriodFilter.dateRange?.[1]?.format('YYYY-MM-DD') || '',
    状态: queryModel.status || '',
    公司名称: queryModel.companyName || '',
    发放状态: queryModel.payStatus || '',
    关键字: queryModel.keyword || '',
  }]
  const exportData = exportSource.map(row => exportColumns.reduce<Record<string, any>>((target, column) => {
    const value = row[column.dataIndex]
    target[column.title] = moneyFields.has(column.dataIndex) ? plainMoney(value) : value
    return target
  }, {}))
  if (activeKey.value === 'salary' && salaryActiveTab.value === 'records') {
    const totalRow: Record<string, any> = { 姓名: '合计金额' }
    exportColumns.forEach((column) => {
      if (moneyFields.has(column.dataIndex))
        totalRow[column.title] = plainMoney(sum(salaryVisibleRows.value, column.dataIndex))
    })
    exportData.push(totalRow)
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(conditionRows), '筛选条件')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportData), '导出数据')
  const outputName = activeKey.value === 'salary'
    ? salaryActiveTab.value === 'templates' ? '工资模板' : '工资表'
    : activeProfile.value.title
  XLSX.writeFile(workbook, `${outputName}_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
}

function payrollCompanyShortName(companyName: string) {
  return companyName.replace(/^青海/, '').replace(/(运输|能源|新能源)?有限公司$/, '') || companyName
}

function payrollSheetName(companyName: string, month: number) {
  return `${month}月${payrollCompanyShortName(companyName)}`.replace(/[\\/?*[\]:]/g, '').slice(0, 31)
}

function exportMonthlyPayroll() {
  const { financialYear, financialMonth } = currentSalaryPeriod.value
  const rows = salaryVisibleRows.value.filter(row => row.financialYear === financialYear && row.financialMonth === financialMonth)
  if (!rows.length) {
    message.warning('当前财务年月没有可导出的工资记录')
    return
  }

  const workbook = XLSX.utils.book_new()
  const companyGroups = new Map<string, OaRecord[]>()
  rows.forEach((row) => {
    const companyName = String(row.companyName || '未归属公司')
    companyGroups.set(companyName, [...(companyGroups.get(companyName) || []), row])
  })

  companyGroups.forEach((companyRows, companyName) => {
    const orderedRows = [...companyRows].sort((a, b) => Number(a.sequenceNo || 0) - Number(b.sequenceNo || 0))
    const dataStartRow = 5
    const dataEndRow = dataStartRow + orderedRows.length - 1
    const totalRow = dataEndRow + 1
    const sheetRows: any[][] = [
      [`${companyName}${financialYear}年${financialMonth}月工资表`],
      ['序号', '岗位', '姓名', '出勤天数', '基本工资', '绩效工资', '应发工资', '', '', '', '', `社保公司缴纳部分/基数`, '', '', '', `社保个人缴纳部分/基数`, '', '', '', '代扣个税', '实发工资', '备注'],
      ['', '', '', '', '', '', '', '', '', '', '', orderedRows.reduce((total, row) => total + Number(row.companySocialSecurityTotal || 0), 0), '', '', '', orderedRows.reduce((total, row) => total + Number(row.personalSocialSecurityTotal || 0), 0)],
      ['', '', '', '', '', '', '出勤工资', '工龄工资', '加班补助', '出差/其他补助', '合计金额', '养老16%', '医疗6.9%', '工伤0.575%', '失业0.5%', '养老8%', '医疗0.2%', '工伤', '失业0.5%', '', '', ''],
      ...orderedRows.map((row, index) => [
        index + 1,
        row.position || '',
        row.employeeName || '',
        Number(row.actualAttendanceDays ?? row.attendanceDays ?? 0),
        Number(row.basicSalary || 0),
        Number(row.performanceSalary || 0),
        Number(row.attendanceSalary || 0),
        Number(row.senioritySalary || 0),
        Number(row.overtimePay || row.overtimeAllowance || 0),
        Number(row.subsidy || row.travelAllowance || row.bonus || row.retroactiveSalary || 0),
        Number(row.grossSalary || row.totalAmount || 0),
        Number(row.companyPension || 0),
        Number(row.companyMedical || 0),
        Number(row.companyInjury || 0),
        Number(row.companyUnemployment || 0),
        Number(row.personalPension || 0),
        Number(row.personalMedical || 0),
        Number(row.personalInjury || 0),
        Number(row.personalUnemployment || 0),
        Number(row.tax || 0),
        Number(row.netSalary || 0),
        row.remark || (row.cashPayment ? '现金发放' : ''),
      ]),
      ['合计金额'],
      [],
      ['批准：', '', '', '', '', '', '审核：', '', '', '', '', '', '', '', '', '复核：', '', '', '', '', '制表：'],
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows)
    for (const column of ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'])
      worksheet[`${column}${totalRow}`] = { t: 'n', f: `SUM(${column}${dataStartRow}:${column}${dataEndRow})`, z: '#,##0.00' }
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 21 } },
      { s: { r: 1, c: 6 }, e: { r: 1, c: 10 } },
      { s: { r: 1, c: 11 }, e: { r: 1, c: 14 } },
      { s: { r: 1, c: 15 }, e: { r: 1, c: 18 } },
      ...[0, 1, 2, 3, 4, 5, 19, 20, 21].map(c => ({ s: { r: 1, c }, e: { r: 3, c } })),
      { s: { r: totalRow - 1, c: 0 }, e: { r: totalRow - 1, c: 5 } },
    ]
    worksheet['!cols'] = [8, 14, 12, 11, 12, 12, 12, 11, 11, 14, 13, 11, 11, 12, 11, 11, 11, 9, 11, 11, 13, 24].map(wch => ({ wch }))
    worksheet['!rows'] = [{ hpt: 26 }, { hpt: 24 }, { hpt: 20 }, { hpt: 24 }]
    worksheet['!freeze'] = { xSplit: 3, ySplit: 4, topLeftCell: 'D5', activePane: 'bottomRight', state: 'frozen' }
    worksheet['!autofilter'] = { ref: `A4:V${dataEndRow}` }
    worksheet['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
    worksheet['!margins'] = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    XLSX.utils.book_append_sheet(workbook, worksheet, payrollSheetName(companyName, financialMonth))
  })
  XLSX.writeFile(workbook, `工资表_${financialYear}年${financialMonth}月.xlsx`)
}

watch(currentSalaryPeriod, () => {
  if (salaryAutoGenerationReady)
    void ensureSalaryPeriodGenerated()
})

onMounted(async () => {
  await businessDictionaries.load()
  await loadOaModuleState()
  salaryAutoGenerationReady = true
  await ensureSalaryPeriodGenerated()
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
      closable
      @close="loadError = ''"
    >
      <template #action>
        <a-button size="small" type="link" @click="loadOaModuleState">
          重新加载
        </a-button>
      </template>
    </a-alert>

    <FinanceWorkflowView
      v-if="showFinanceWorkflow"
      :can-manage="canManageCashBalance"
      :loading="reconciliationLoading"
      :reconciliation="financeReconciliation"
      :steps="financeWorkflow"
      @check="loadFinanceReconciliation"
      @reconcile="reconcileFinanceRecords"
    />

    <SummaryCards v-if="activeKey !== 'dashboard' && activeKey !== 'salary'" :cards="summaryCards" :loading="loading || saving" :data-state="filteredRows.length ? 'ready' : 'empty'" :xl-span="4" compact />
    <FinanceAgingInsights v-if="activeKey === 'receivable'" :rows="filteredRows" />

    <a-card v-if="activeKey !== 'org'" :bordered="false" mb-4>
      <section v-if="activeKey === 'salary'" class="salary-period-workspace">
        <div class="salary-period-head">
          <div>
            <div class="salary-period-title-row">
              <h2>工资管理</h2>
              <span v-if="salaryActiveTab === 'records'" class="salary-period-date">{{ currentSalaryPeriod.financialYear }}年{{ currentSalaryPeriod.financialMonth }}月</span>
              <a-tag v-if="salaryActiveTab === 'records' && salaryAutoGenerating" color="processing">
                自动生成中
              </a-tag>
              <a-tag v-else-if="salaryActiveTab === 'records'" :color="statusColor(salaryPeriodOverview.status)">
                {{ salaryPeriodOverview.status }}
              </a-tag>
            </div>
            <p>{{ salaryActiveTab === 'templates' ? '维护人员固定工资标准，新月份自动沿用。' : '在职人员工资表按月自动生成；录入本月三项变动后即时核算。' }}</p>
          </div>
          <a-space v-if="salaryActiveTab === 'templates'" wrap>
            <a-button v-if="salaryActiveTab === 'templates'" @click="router.push('/system/users')">
              新增人员
            </a-button>
          </a-space>
        </div>

        <a-alert v-if="salaryAutoGenerationError" class="salary-generation-alert" type="error" show-icon :message="salaryAutoGenerationError">
          <template #action>
            <a-button size="small" @click="ensureSalaryPeriodGenerated">
              重试
            </a-button>
          </template>
        </a-alert>

        <div class="salary-action-bar">
          <div v-if="salaryActiveTab === 'records'" class="salary-period-summary" aria-label="本月工资摘要">
            <span>在职 <strong>{{ salaryPeriodOverview.employeeCount }}</strong> 人</span>
            <span>已生成 <strong>{{ salaryPeriodOverview.generatedCount }}</strong> 人</span>
            <span v-if="salaryPeriodOverview.missingCount" class="is-warning">缺少 <strong>{{ salaryPeriodOverview.missingCount }}</strong> 人</span>
            <span v-if="salaryPeriodOverview.pendingEntryCount" class="is-warning">待补录 <strong>{{ salaryPeriodOverview.pendingEntryCount }}</strong> 人</span>
            <span>实发合计 <strong>{{ money(sum(currentSalaryRows, 'netSalary')) }}</strong></span>
          </div>
          <div v-else class="salary-period-summary" aria-label="工资模板摘要">
            <span>在职人员 <strong>{{ salaryPeriodOverview.employeeCount }}</strong> 人</span>
            <span>已设模板 <strong>{{ salaryTemplateRows.filter(row => row.templateStatus !== '未设置').length }}</strong> 人</span>
            <span v-if="salaryTemplateRows.some(row => row.templateStatus === '未设置')" class="is-warning">待设置 <strong>{{ salaryTemplateRows.filter(row => row.templateStatus === '未设置').length }}</strong> 人</span>
          </div>
          <a-space wrap>
            <a-button v-if="salaryActiveTab === 'records'" type="primary" :loading="saving" :disabled="salaryAutoGenerating" @click="saveSalaryDirectEntry">
              保存本月录入
            </a-button>
            <a-button v-if="salaryActiveTab === 'records'" :disabled="salaryAutoGenerating || saving" @click="lockVisibleSalaries">
              锁定本月
            </a-button>
            <a-button v-if="salaryActiveTab === 'records'" @click="exportRows">
              导出
            </a-button>
          </a-space>
        </div>
      </section>

      <a-row v-else :gutter="[16, 16]" align="middle">
        <a-col :xs="24" :lg="12">
          <div text-20px font-600>
            {{ activeProfile.title }}
          </div>
          <div mt-2 c="var(--text-color-secondary)">
            {{ activeProfile.description }}
          </div>
        </a-col>
        <a-col :xs="24" :lg="12">
          <a-space wrap style="justify-content: flex-end; width: 100%;">
            <a-button @click="exportRows">
              导出表格
            </a-button>
            <a-button v-if="activeKey === 'cash'" type="primary" @click="openReceiptModal">
              登记来款
            </a-button>
          </a-space>
        </a-col>
      </a-row>
      <a-form mt-4 class="oa-query" :label-col="{ span: 7 }" @finish="handleQuery">
        <a-row :gutter="[16, 0]">
          <FinancialPeriodFilter
            v-if="activeKey !== 'salary' || salaryActiveTab === 'records'"
            v-model="financialPeriodFilter"
            :available-month-keys="activeKey === 'salary' ? [] : availableMonthKeys"
            :show-date-range="activeKey !== 'salary'"
            :year-col="activeKey === 'salary' ? { xs: 24, md: 8, xl: 4 } : { xs: 24, md: 8, xl: 6 }"
            :month-col="activeKey === 'salary' ? { xs: 24, md: 8, xl: 4 } : { xs: 24, md: 8, xl: 6 }"
          />
          <a-col v-if="activeKey !== 'salary'" :xs="24" :md="8" :xl="4">
            <a-form-item label="状态">
              <a-select v-model:value="queryModel.status" allow-clear placeholder="请选择状态">
                <a-select-option v-for="item in statusOptions.filter(item => !(activeKey === 'salary' && item === '已作废'))" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="activeKey === 'salary' ? 5 : 6">
            <a-form-item label="关键字">
              <a-input v-model:value="queryModel.keyword" :placeholder="activeProfile.keywordPlaceholder" allow-clear />
            </a-form-item>
          </a-col>
          <template v-if="activeKey === 'salary'">
            <a-col :xs="24" :md="8" :xl="5">
              <a-form-item label="公司名称">
                <a-select v-model:value="queryModel.companyName" allow-clear placeholder="请选择公司">
                  <a-select-option v-for="item in companyNameOptions" :key="item" :value="item">
                    {{ item }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="8" :xl="4">
              <a-form-item label="部门/岗位">
                <a-input v-model:value="queryModel.orgPosition" allow-clear placeholder="输入岗位" />
              </a-form-item>
            </a-col>
            <a-col v-if="salaryActiveTab === 'records'" :xs="24" :md="8" :xl="3">
              <a-form-item label="发放状态">
                <a-select v-model:value="queryModel.payStatus" allow-clear placeholder="请选择">
                  <a-select-option value="未发放">
                    未发放
                  </a-select-option>
                  <a-select-option value="已发放">
                    已发放
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </template>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item>
              <a-space>
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
      <SalaryWorkspaceControls
        v-if="activeKey === 'salary'"
        v-model:active-tab="salaryActiveTab"
        v-model:template-open="salaryTemplateOpen"
        :template-form="salaryTemplateForm"
        :template-saving="salaryTemplateSaving"
        @save-template="saveSalaryTemplate"
        @recalculate-template="recalculateSalaryTemplate"
        @update-template-field="(field, value) => salaryTemplateForm[field] = Number(value || 0)"
      />
    </a-card>

    <OrgManagementView
      v-if="activeKey === 'org'"
      v-model:tree-keyword="orgTreeKeyword"
      v-model:active-tab="orgActiveTab"
      :query="queryModel"
      :department-options="orgDepartmentOptions"
      :positions="orgPositions"
      :role-options="roleOptions"
      :tree-data="orgTreeData"
      :selected-key="selectedOrgKey"
      :selected-record="selectedOrgRecord"
      :columns="orgTableColumns"
      :rows="orgFilteredRows"
      :pagination="pagination"
      :scroll-x="orgTableScrollX"
      :loading="loading || saving"
      :read-only="true"
      :status-color="statusColor"
      :column-key="columnKey"
      @query="handleQuery"
      @reset="resetQuery"
      @select-tree="handleOrgTreeSelect"
      @create="openOrgCreate"
      @export="exportOrgRows"
      @detail="record => openDetail(asOaRecord(record))"
      @edit="record => openOrgEdit(asOaRecord(record))"
      @delete="record => deleteOrgRecord(asOaRecord(record))"
      @toggle="record => toggleOrgRecord(asOaRecord(record))"
      @role="record => openRoleModal(asOaRecord(record))"
      @approver="record => openApproverModal(asOaRecord(record))"
      @adjust="(record, field) => adjustOrgField(asOaRecord(record), field)"
    />

    <OaDashboardView
      v-if="activeKey === 'dashboard'"
      :quick-links="dashboardQuickLinks"
      :finance-status="dashboardFinanceStatus"
      :approval-breakdown="dashboardApprovalBreakdown"
      :risks="dashboardRisks"
      :module-summaries="dashboardModuleSummaries"
      :expense-trend="expenseTrend"
      :expense-trend-max="expenseTrendMax"
      :income-expense-share="incomeExpenseShare"
      :pending-salary-amount="sum(moduleProfiles.salary.rows.filter(row => row.payStatus !== '已发放'), 'netSalary')"
      :overdue-receivable-amount="sum(moduleProfiles.receivable.rows.filter(row => row.billType === '应收' && row.status === '已逾期'), 'unpaidAmount')"
      :money="money"
      :percent="percent"
    />

    <CashBalanceView
      v-if="activeKey === 'cash'"
      :current-groups="currentCashBalanceGroups"
      :total="cashBalanceTotal"
      :query="cashBalanceQuery"
      :groups="cashBalanceGroups"
      :filtered-total="filteredCashBalanceRecords.reduce((total, row) => total + row.balance_amount, 0)"
      :columns="cashBalanceTableColumns"
      :scroll-x="cashBalanceTableScrollX"
      :loading="loading || saving"
      :money="money"
      @batch="openBatchBalanceModal"
      @create="openCashBalanceModal()"
      @history="record => openCashBalanceHistory(asCashBalanceRecord(record))"
      @edit="record => openCashBalanceModal(asCashBalanceRecord(record))"
      @delete="record => deleteCashBalance(asCashBalanceRecord(record))"
    />

    <OaBusinessTable
      v-if="activeKey !== 'org' && activeKey !== 'dashboard'"
      :module-key="activeKey"
      :salary-tab="salaryActiveTab"
      :title="activeKey === 'salary' ? (salaryActiveTab === 'templates' ? '人员工资模板' : `${currentSalaryPeriod.financialYear}年${currentSalaryPeriod.financialMonth}月工资表`) : `${activeProfile.title}列表`"
      :columns="tableColumns"
      :rows="activeKey === 'salary' ? salaryVisibleRows : filteredRows"
      :pagination="activeKey === 'salary' ? false : pagination"
      :scroll="activeTableScroll"
      :loading="loading || saving"
      :salary-editing-id="salaryInlineEditingId"
      :salary-direct-entry="activeKey === 'salary' && salaryActiveTab === 'records'"
      :wage-fields="salaryWageFields"
      :social-fields="salarySocialExpenseFields"
      :column-key="columnKey"
      :status-color="statusColor"
      :status-cell="statusCell"
      :display-cell="displayCell"
      :inline-actions="inlineRowActions"
      :more-actions="moreRowActions"
      @view-employee="record => openOrgEmployeeFromTemplate(asOaRecord(record))"
      @edit-template="record => openSalaryTemplateEdit(asOaRecord(record))"
      @recalculate-salary="record => recalculateSalary(asOaRecord(record))"
      @run-action="runRowAction"
    />

    <a-modal v-model:open="orgFormOpen" :title="`${orgFormMode === 'create' ? '新增' : '编辑'}${orgFormType}`" width="760px" :mask-closable="false" :confirm-loading="saving" :closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" ok-text="保存" cancel-text="取消" @ok="saveOrgForm">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="12">
            <a-form-item :label="`${orgFormType}名称`" required>
              <a-input v-model:value="orgForm.name" placeholder="请输入名称" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item :label="`${orgFormType}编码`" required>
              <a-input v-model:value="orgForm.code" placeholder="请输入唯一编码" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType !== '部门'" :xs="24" :md="12">
            <a-form-item label="所属部门" required>
              <a-select v-model:value="orgForm.parentDepartment" placeholder="请选择部门">
                <a-select-option v-for="item in orgDepartmentOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col v-else :xs="24" :md="12">
            <a-form-item label="上级部门" required>
              <a-select v-model:value="orgForm.parentDepartment" placeholder="请选择上级部门">
                <a-select-option v-for="item in orgDepartments" :key="item.code" :value="item.name">
                  {{ item.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '岗位'" :xs="24" :md="12">
            <a-form-item label="岗位级别">
              <a-select v-model:value="orgForm.positionLevel">
                <a-select-option v-for="item in positionLevelOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="岗位" required>
              <a-select v-model:value="orgForm.position" placeholder="请选择岗位">
                <a-select-option v-for="item in orgPositionOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="负责人/直属领导">
              <a-select v-model:value="orgForm.leader" allow-clear placeholder="请选择">
                <a-select-option v-for="item in activeEmployeeOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="审批人">
              <a-select v-model:value="orgForm.approver" allow-clear placeholder="请选择在职员工">
                <a-select-option v-for="item in activeEmployeeOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="公司名称" required>
              <a-select v-model:value="orgForm.companyName" placeholder="请选择公司">
                <a-select-option v-for="item in companyNameOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="手机号">
              <a-input v-model:value="orgForm.phone" placeholder="请输入手机号" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="邮箱">
              <a-input v-model:value="orgForm.email" placeholder="请输入邮箱" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="入职日期">
              <a-date-picker v-model:value="orgForm.hireDate" value-format="YYYY-MM-DD" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="基本工资">
              <business-input-number v-model:value="orgForm.basicSalary" class="w-full" :precision="2" :min="0" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="绩效工资">
              <business-input-number v-model:value="orgForm.performanceSalary" class="w-full" :precision="2" :min="0" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="工龄工资">
              <business-input-number v-model:value="orgForm.senioritySalary" class="w-full" :precision="2" :min="0" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="加班补助">
              <business-input-number v-model:value="orgForm.overtimeAllowance" class="w-full" :precision="2" :min="0" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="出差补助">
              <business-input-number v-model:value="orgForm.travelAllowance" class="w-full" :precision="2" :min="0" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="补发工资">
              <business-input-number v-model:value="orgForm.retroactiveSalary" class="w-full" :precision="2" :min="0" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="社保基数">
              <business-input-number v-model:value="orgForm.socialSecurityBase" class="w-full" :precision="2" :min="0" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '员工'" :xs="24" :md="12">
            <a-form-item label="默认个税">
              <business-input-number v-model:value="orgForm.tax" class="w-full" :precision="2" :min="0" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="状态">
              <a-select v-model:value="orgForm.status">
                <a-select-option v-if="orgFormType === '员工'" value="在职">
                  在职
                </a-select-option>
                <a-select-option v-if="orgFormType === '员工'" value="离职">
                  离职
                </a-select-option>
                <a-select-option value="正常">
                  正常
                </a-select-option>
                <a-select-option value="停用">
                  停用
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="角色">
              <a-select v-model:value="orgForm.role" mode="tags" placeholder="请选择角色">
                <a-select-option v-for="item in roleOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '部门'" :xs="24" :md="12">
            <a-form-item label="联系电话">
              <a-input v-model:value="orgForm.phone" placeholder="请输入联系电话" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '部门'" :xs="24" :md="12">
            <a-form-item label="排序号">
              <business-input-number v-model:value="orgForm.sortNo" class="w-full" :min="0" />
            </a-form-item>
          </a-col>
          <a-col v-if="orgFormType === '岗位'" :span="24">
            <a-form-item label="岗位职责">
              <a-textarea v-model:value="orgForm.responsibility" :rows="3" placeholder="请输入岗位职责" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="orgForm.remark" :rows="3" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-modal v-model:open="roleModalOpen" title="分配角色/权限" width="520px" :mask-closable="false" :confirm-loading="saving" :closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" ok-text="保存" cancel-text="取消" @ok="saveRoleAssignment">
      <a-form v-if="orgActionRecord" layout="vertical">
        <a-form-item label="角色">
          <a-select v-model:value="orgActionRecord.role" mode="tags" placeholder="请选择角色">
            <a-select-option v-for="item in roleOptions" :key="item" :value="item">
              {{ item }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="部门权限范围">
          <a-select v-model:value="orgActionRecord.permissionScope" placeholder="请选择权限范围">
            <a-select-option value="全部数据">
              全部数据
            </a-select-option>
            <a-select-option value="本部门及下级">
              本部门及下级
            </a-select-option>
            <a-select-option value="本部门">
              本部门
            </a-select-option>
            <a-select-option value="本人">
              本人
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="approverModalOpen" title="设置审批关系" width="680px" :mask-closable="false" :confirm-loading="saving" :closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" ok-text="保存" cancel-text="取消" @ok="saveApproverAssignment">
      <a-form v-if="orgActionRecord" layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="12">
            <a-form-item label="直属领导">
              <a-select v-model:value="orgActionRecord.leader" allow-clear>
                <a-select-option v-for="item in activeEmployeeOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="审批人">
              <a-select v-model:value="orgActionRecord.approver" allow-clear>
                <a-select-option v-for="item in activeEmployeeOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="财务审批人">
              <a-select v-model:value="orgActionRecord.financeApprover" allow-clear>
                <a-select-option v-for="item in activeEmployeeOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="行政审批人">
              <a-select v-model:value="orgActionRecord.adminApprover" allow-clear>
                <a-select-option v-for="item in activeEmployeeOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="用车审批人">
              <a-select v-model:value="orgActionRecord.vehicleApprover" allow-clear>
                <a-select-option v-for="item in activeEmployeeOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="工资审批人">
              <a-select v-model:value="orgActionRecord.salaryApprover" allow-clear>
                <a-select-option v-for="item in activeEmployeeOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-modal v-model:open="detailOpen" :title="`${activeProfile.title}详情`" width="760px" :footer="null">
      <a-descriptions v-if="detailRecord" bordered :column="2" size="small">
        <a-descriptions-item v-for="column in activeProfile.columns" :key="column.dataIndex" :label="column.title">
          {{ displayCell(detailRecord, column.dataIndex) }}
        </a-descriptions-item>
      </a-descriptions>
      <a-divider v-if="detailRecord" orientation="left">
        审批流
      </a-divider>
      <a-steps v-if="detailRecord" size="small" :current="detailRecord.status === '已完成' || detailRecord.status === '已同意' ? 3 : 1">
        <a-step title="提交申请" />
        <a-step title="负责人审批" />
        <a-step title="财务/行政审批" />
        <a-step title="归档完成" />
      </a-steps>
    </a-modal>

    <a-modal v-model:open="editOpen" :title="`${activeKey === 'salary' && editingRecord?.employeeName ? `编辑工资 - ${editingRecord.employeeName}` : `编辑${activeProfile.title}`}`" width="760px" :mask-closable="false" :confirm-loading="saving" :closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" ok-text="保存" cancel-text="取消" @ok="saveEdit">
      <a-form v-if="editingRecord && activeKey === 'salary'" layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="8">
            <a-form-item label="公司名称">
              <a-select v-model:value="editingRecord.companyName">
                <a-select-option value="青海诚捷运输有限公司">
                  青海诚捷运输有限公司
                </a-select-option>
                <a-select-option value="青海诚域能源有限公司">
                  青海诚域能源有限公司
                </a-select-option>
                <a-select-option value="青海诺锐新能源有限公司">
                  青海诺锐新能源有限公司
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="财务年">
              <business-input-number v-model:value="editingRecord.financialYear" class="w-full" :min="2020" :max="2035" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="财务月">
              <business-input-number v-model:value="editingRecord.financialMonth" class="w-full" :min="1" :max="12" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="岗位">
              <a-input v-model:value="editingRecord.position" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="姓名">
              <a-input v-model:value="editingRecord.employeeName" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="部门">
              <a-input v-model:value="editingRecord.department" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="出勤天数">
              <business-input-number v-model:value="editingRecord.attendanceDays" class="w-full" :min="0" :max="31" @change="recalculateSalary(editingRecord)" />
            </a-form-item>
          </a-col>
          <a-col
            v-for="field in [
              ['基本工资', 'basicSalary'],
              ['绩效工资', 'performanceSalary'],
              ['工龄工资', 'senioritySalary'],
              ['加班补助', 'overtimeAllowance'],
              ['出差补助', 'travelAllowance'],
              ['补发工资', 'retroactiveSalary'],
              ['社保基数', 'socialSecurityBase'],
              ['代扣个税', 'tax'],
            ]" :key="field[1]" :xs="24" :md="8"
          >
            <a-form-item :label="field[0]">
              <business-input-number
                v-model:value="editingRecord[field[1]]"
                class="w-full"
                :precision="2"
                :min="0"
                @change="recalculateSalary(editingRecord)"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="应发工资">
              <a-input :value="plainMoney(editingRecord.grossSalary)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="合计金额">
              <a-input :value="plainMoney(editingRecord.totalAmount)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="公司社保合计">
              <a-input :value="plainMoney(editingRecord.companySocialSecurityTotal)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="公司养老16%">
              <a-input :value="plainMoney(editingRecord.companyPension)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="公司医疗6.9%">
              <a-input :value="plainMoney(editingRecord.companyMedical)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="公司工伤0.575%">
              <a-input :value="plainMoney(editingRecord.companyInjury)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="公司失业0.5%">
              <a-input :value="plainMoney(editingRecord.companyUnemployment)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="个人社保合计">
              <a-input :value="plainMoney(editingRecord.personalSocialSecurityTotal)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="个人养老8%">
              <a-input :value="plainMoney(editingRecord.personalPension)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="个人医疗0.2%">
              <a-input :value="plainMoney(editingRecord.personalMedical)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="个人工伤">
              <a-input :value="plainMoney(editingRecord.personalInjury)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="个人失业0.5%">
              <a-input :value="plainMoney(editingRecord.personalUnemployment)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="实发工资">
              <a-input :value="plainMoney(editingRecord.netSalary)" readonly />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="现金发放">
              <a-input v-model:value="editingRecord.cashPayment" placeholder="如：3000现金" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="发放状态">
              <a-select v-model:value="editingRecord.payStatus">
                <a-select-option value="未发放">
                  未发放
                </a-select-option>
                <a-select-option value="已发放">
                  已发放
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-form-item label="审批状态">
              <a-select v-model:value="editingRecord.status">
                <a-select-option value="草稿">
                  草稿
                </a-select-option>
                <a-select-option value="待审批">
                  待审批
                </a-select-option>
                <a-select-option value="审批通过">
                  审批通过
                </a-select-option>
                <a-select-option value="审批驳回">
                  审批驳回
                </a-select-option>
                <a-select-option value="已发放">
                  已发放
                </a-select-option>
                <a-select-option value="已作废">
                  已作废
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="editingRecord.remark" :rows="3" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
      <a-form v-else-if="editingRecord" layout="vertical">
        <a-row :gutter="16">
          <a-col v-for="column in activeProfile.columns.filter(item => !['grossSalary', 'netSalary', 'timeRange', 'vehicleInfo'].includes(item.dataIndex))" :key="column.dataIndex" :xs="24" :md="12">
            <a-form-item :label="column.title">
              <business-input-number
                v-if="moneyFields.has(column.dataIndex) || ['passengers', 'mileage'].includes(column.dataIndex)"
                v-model:value="editingRecord[column.dataIndex]"
                :precision="moneyFields.has(column.dataIndex) ? 2 : 0"
                style="width: 100%;"
              />
              <a-select v-else-if="column.dataIndex === 'status'" v-model:value="editingRecord.status">
                <a-select-option v-for="item in statusOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
              <a-input v-else v-model:value="editingRecord[column.dataIndex]" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-modal v-model:open="paymentOpen" title="确认付款" width="860px" :mask-closable="false" :closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" ok-text="确认付款" cancel-text="取消" :confirm-loading="saving" @ok="confirmPaymentInstruction">
      <a-alert mb-4 type="warning" show-icon message="请完整选择付款主体和账号；创建指令不会立即扣款，确认支付成功后将从该账号现金余额中扣除付款金额。" />
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="12">
            <a-form-item label="付款请求号" required>
              <a-input v-model:value="paymentForm.paymentRequestNo" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="主体名称" required>
              <a-select v-model:value="paymentForm.companyName" show-search placeholder="请选择付款主体" @change="selectPaymentCompany">
                <a-select-option v-for="company in paymentCompanyOptions" :key="company" :value="company">
                  {{ company }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="付款账号" required>
              <a-select v-model:value="paymentForm.cashBalanceId" show-search option-filter-prop="label" :disabled="!paymentForm.companyName" placeholder="请选择现金余额账号" @change="selectPaymentAccount">
                <a-select-option v-for="account in paymentAccountOptions" :key="account.id" :value="account.id" :label="`${account.bank_name} ${account.account_no_tail}`">
                  {{ account.bank_name }} · {{ account.account_no_tail }} · 余额 {{ money(account.balance_amount) }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="计划付款日期" required>
              <a-date-picker v-model:value="paymentForm.paymentDate" value-format="YYYY-MM-DD" format="YYYY-MM-DD" :allow-clear="false" style="width: 100%;" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="收款方" required>
              <a-input v-model:value="paymentForm.payeeName" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="付款方式">
              <a-select v-model:value="paymentForm.paymentMethod">
                <a-select-option value="银行转账">
                  银行转账
                </a-select-option>
                <a-select-option value="现金支付">
                  现金支付
                </a-select-option>
                <a-select-option value="承兑汇票">
                  承兑汇票
                </a-select-option>
                <a-select-option value="其他">
                  其他
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="paymentForm.remark" :rows="2" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
      <a-divider orientation="left">
        应付核销明细
      </a-divider>
      <a-space direction="vertical" style="width: 100%;" :size="12">
        <a-row v-for="(row, index) in paymentAllocationRows" :key="index" :gutter="12" align="middle">
          <a-col :xs="24" :md="12">
            <a-select v-model:value="row.payableId" show-search option-filter-prop="label" placeholder="选择应付单" style="width: 100%;">
              <a-select-option v-for="item in openPayableOptions" :key="item.id" :value="item.id" :label="`${item.code} ${item.counterparty}`">
                {{ item.code }} · {{ item.counterparty }} · 未付 {{ money(item.unpaidAmount) }}
              </a-select-option>
            </a-select>
          </a-col>
          <a-col :xs="18" :md="7">
            <business-input-number v-model:value="row.amount" :precision="2" :min="0.01" placeholder="付款金额" style="width: 100%;" />
          </a-col>
          <a-col :xs="6" :md="3">
            <a-button type="link" danger :disabled="paymentAllocationRows.length === 1" @click="paymentAllocationRows.splice(index, 1)">
              删除
            </a-button>
          </a-col>
        </a-row>
        <a-button :disabled="paymentAllocationRows.length >= openPayableOptions.length" @click="addPaymentAllocationRow">
          添加应付单
        </a-button>
      </a-space>
      <a-divider />
      <div class="receipt-allocation-summary">
        <span>付款合计</span>
        <strong>{{ money(paymentAllocationTotal) }}</strong>
      </div>
    </a-modal>

    <a-modal v-model:open="paymentConfirmOpen" title="确认银行支付" width="620px" :mask-closable="false" :closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" ok-text="确认已支付" cancel-text="取消" :confirm-loading="saving" @ok="savePaymentConfirm">
      <a-alert mb-4 type="warning" show-icon message="确认后将生成现金支出并核销应付，请根据银行回单操作。" />
      <a-descriptions v-if="activePayment" size="small" :column="2" bordered mb-4>
        <a-descriptions-item label="付款请求号">
          {{ activePayment.paymentRequestNo }}
        </a-descriptions-item>
        <a-descriptions-item label="付款金额">
          {{ money(activePayment.paymentAmount) }}
        </a-descriptions-item>
        <a-descriptions-item label="付款账户">
          {{ activePayment.companyName }} · {{ activePayment.accountNo || activePayment.accountName }}
        </a-descriptions-item>
        <a-descriptions-item label="收款方">
          {{ activePayment.payeeName }}
        </a-descriptions-item>
      </a-descriptions>
      <a-form layout="vertical">
        <a-form-item label="银行流水号" required>
          <a-input v-model:value="paymentConfirmForm.bankSerialNo" placeholder="填写银行回单流水号" />
        </a-form-item>
        <a-form-item label="支付时间">
          <a-date-picker v-model:value="paymentConfirmForm.paidAt" show-time value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm:ss" style="width: 100%;" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="paymentFailOpen" title="记录支付失败" width="560px" :mask-closable="false" :closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" ok-text="确认失败" cancel-text="取消" :confirm-loading="saving" @ok="savePaymentFailure">
      <a-alert mb-4 type="info" show-icon message="标记失败不会产生现金支出，也不会增加应付单已付金额。" />
      <a-form layout="vertical">
        <a-form-item label="失败原因" required>
          <a-textarea v-model:value="paymentFailureReason" :rows="4" placeholder="如：银行退回、账户信息错误" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="receiptOpen" title="登记来款" width="720px" :mask-closable="false" :closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" ok-text="确认登记" cancel-text="取消" :confirm-loading="saving" @ok="saveReceipt">
      <a-alert mb-4 type="info" show-icon message="登记后将整笔到账金额计入所选银行账号；关联应收请在流水列表执行核销。" />
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="12">
            <a-form-item label="收款账户" required>
              <a-select
                v-model:value="receiptForm.cashBalanceId"
                show-search
                option-filter-prop="label"
                option-label-prop="label"
                placeholder="请选择现金余额管理中的账号"
                @change="handleReceiptCashAccountChange"
              >
                <a-select-option
                  v-for="account in receiptCashAccounts"
                  :key="account.id"
                  :value="account.id"
                  :label="cashBalanceCompactLabel(account)"
                >
                  {{ cashBalanceOptionLabel(account) }} · 当前余额 {{ money(account.balance_amount) }}
                </a-select-option>
              </a-select>
              <small v-if="selectedReceiptCashAccount" class="form-field-hint">
                登记后余额 {{ money(receiptAccountBalanceAfterRegistration) }}
              </small>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="账户类型">
              <a-select v-model:value="receiptForm.accountType">
                <a-select-option value="银行账户">
                  银行账户
                </a-select-option>
                <a-select-option value="现金账户">
                  现金账户
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="到账日期" required>
              <a-date-picker v-model:value="receiptForm.receiptDate" value-format="YYYY-MM-DD" format="YYYY-MM-DD" :allow-clear="false" style="width: 100%;" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="来款金额" required>
              <business-input-number v-model:value="receiptForm.amount" :precision="2" :min="0.01" style="width: 100%;" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="付款方" required>
              <a-input v-model:value="receiptForm.payerName" placeholder="客户或付款单位名称" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="银行流水号" required>
              <a-input v-model:value="receiptForm.bankSerialNo" placeholder="用于防止重复登记" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="来款类型">
              <a-select v-model:value="receiptForm.receiptType">
                <a-select-option value="应收回款">
                  应收回款
                </a-select-option>
                <a-select-option value="预收款">
                  预收款
                </a-select-option>
                <a-select-option value="保证金">
                  保证金
                </a-select-option>
                <a-select-option value="退款到账">
                  退款到账
                </a-select-option>
                <a-select-option value="其他来款">
                  其他来款
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="receiptForm.remark" :rows="3" placeholder="填写合同、订单或来款说明" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="receiptAllocationOpen"
      title="核销来款"
      width="960px"
      wrap-class-name="receipt-allocation-modal"
      :mask-closable="false"
      :keyboard="!saving"
      :closable="!saving"
      ok-text="确认核销"
      cancel-text="取消"
      :confirm-loading="saving"
      :cancel-button-props="{ disabled: saving }"
      @ok="saveReceiptAllocation"
    >
      <div v-if="allocatingReceipt" class="receipt-allocation-meta">
        <div class="receipt-allocation-meta__item">
          <span>入账账户</span>
          <strong>
            <a-select
              v-model:value="receiptAllocationCashBalanceId"
              show-search
              option-filter-prop="label"
              option-label-prop="label"
              placeholder="请选择对应银行账号"
              :disabled="Boolean(allocatingReceipt.balancePostedAt)"
              class="receipt-allocation-account-select"
              aria-label="核销对应的收款账户"
            >
              <a-select-option
                v-for="account in receiptCashAccounts"
                :key="account.id"
                :value="account.id"
                :label="cashBalanceCompactLabel(account)"
              >
                {{ cashBalanceOptionLabel(account) }} · 余额 {{ money(account.balance_amount) }}
              </a-select-option>
            </a-select>
          </strong>
        </div>
        <div class="receipt-allocation-meta__item">
          <span>付款方</span>
          <strong>{{ allocatingReceipt.payerName || allocatingReceipt.counterpartyName || '-' }}</strong>
        </div>
        <div class="receipt-allocation-meta__item">
          <span>来款金额</span>
          <strong>{{ money(allocatingReceipt.incomeAmount) }}</strong>
        </div>
        <div class="receipt-allocation-meta__item">
          <span>未认领</span>
          <strong>{{ money(allocatingReceipt.unrecognizedAmount) }}</strong>
        </div>
      </div>

      <a-alert
        v-if="selectedReceiptAllocationCashAccount"
        class="receipt-allocation-posting-alert"
        :type="allocatingReceipt?.balancePostedAt ? 'success' : 'info'"
        show-icon
        :message="allocatingReceipt?.balancePostedAt
          ? `该来款已计入此账号，当前余额 ${money(selectedReceiptAllocationCashAccount.balance_amount)}，本次核销不会重复增加。`
          : `确认后整笔到账 ${money(allocatingReceipt?.incomeAmount)} 将计入此账号，预计余额 ${money(receiptAllocationAccountBalanceAfterPosting)}。`"
      />

      <div class="receipt-allocation-workspace">
        <div class="receipt-allocation-list" role="group" aria-label="应收单核销明细">
          <div v-for="(row, index) in receiptAllocationRows" :key="index" class="receipt-allocation-row">
            <div class="receipt-allocation-field">
              <span class="receipt-allocation-field__label">核销应收单</span>
              <a-select
                v-model:value="row.receivableId"
                show-search
                option-filter-prop="label"
                placeholder="请选择应收单"
                aria-label="核销应收单"
                class="receipt-allocation-receivable"
              >
                <a-select-option
                  v-for="item in openReceivableOptions"
                  :key="item.id"
                  :value="item.id"
                  :label="`${item.code} · ${item.counterparty} · 未收 ${money(item.unpaidAmount)}`"
                >
                  {{ item.code }} · {{ item.counterparty }} · 未收 {{ money(item.unpaidAmount) }}
                </a-select-option>
              </a-select>
              <small v-if="receiptAllocationReceivable(row.receivableId)" class="receipt-allocation-field__hint">
                往来单位：{{ receiptAllocationReceivable(row.receivableId)?.counterparty }}
              </small>
            </div>
            <div class="receipt-allocation-field">
              <span class="receipt-allocation-field__label">核销金额（元）</span>
              <business-input-number
                v-model:value="row.amount"
                :precision="2"
                :min="0.01"
                :max="row.receivableId ? receiptAllocationLimit(row.receivableId) : undefined"
                placeholder="请输入核销金额"
                aria-label="核销金额"
                class="receipt-allocation-amount"
              />
              <small v-if="receiptAllocationReceivable(row.receivableId)" class="receipt-allocation-field__hint">
                本单最多核销 {{ money(receiptAllocationLimit(row.receivableId)) }}
              </small>
            </div>
            <a-button
              type="link"
              danger
              :disabled="receiptAllocationRows.length === 1"
              class="receipt-allocation-delete"
              @click="receiptAllocationRows.splice(index, 1)"
            >
              删除
            </a-button>
          </div>
        </div>

        <a-button
          class="receipt-allocation-add"
          :disabled="receiptAllocationRows.length >= openReceivableOptions.length"
          @click="addReceiptAllocationRow"
        >
          添加应收单
        </a-button>
      </div>

      <div class="receipt-allocation-summary">
        <div>
          <span>本次核销合计</span>
          <small>核销后剩余 {{ money(receiptAllocationRemaining) }}</small>
        </div>
        <strong>{{ money(receiptAllocationTotal) }}</strong>
      </div>
    </a-modal>

    <a-modal v-model:open="cashBalanceOpen" :title="editingBalanceId ? '修改余额记录' : '新增余额记录'" width="760px" :mask-closable="false" :confirm-loading="saving" :closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" ok-text="保存" cancel-text="取消" @ok="saveCashBalance">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="12">
            <a-form-item label="主体名称" required>
              <a-input v-model:value="cashBalanceForm.company_name" placeholder="请输入公司/主体" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="银行名称" required>
              <a-input v-model:value="cashBalanceForm.bank_name" placeholder="请输入银行名称" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="账户名称" required>
              <a-input v-model:value="cashBalanceForm.account_name" placeholder="如：基本户、一般户" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="账号" required>
              <a-input v-model:value="cashBalanceForm.account_no_tail" placeholder="请输入完整账号" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="余额" required>
              <business-input-number v-model:value="cashBalanceForm.balance_amount" :precision="2" :min="0" style="width: 100%;" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="cashBalanceForm.remark" :rows="3" placeholder="请输入备注" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="cashBalanceHistoryOpen"
      title="账户资金变动"
      width="980px"
      :footer="null"
    >
      <div v-if="activeCashBalance" class="cash-balance-history-head">
        <div>
          <span>账户</span>
          <strong>{{ cashBalanceOptionLabel(activeCashBalance) }}</strong>
        </div>
        <div>
          <span>当前余额</span>
          <strong>{{ money(activeCashBalance.balance_amount) }}</strong>
        </div>
      </div>
      <a-table
        row-key="id"
        size="small"
        :pagination="false"
        :data-source="activeCashBalanceMovements"
        :scroll="{ x: 1100 }"
      >
        <a-table-column title="入账时间" data-index="postedAt" width="170" />
        <a-table-column title="来款流水" data-index="receiptCode" width="170" />
        <a-table-column title="付款方" data-index="payerName" width="180" />
        <a-table-column title="到账金额" data-index="amount" width="130">
          <template #default="{ text }">
            <strong class="cash-increase">+{{ money(text) }}</strong>
          </template>
        </a-table-column>
        <a-table-column title="变动前" data-index="balanceBefore" width="130">
          <template #default="{ text }">
            {{ money(text) }}
          </template>
        </a-table-column>
        <a-table-column title="变动后" data-index="balanceAfter" width="130">
          <template #default="{ text }">
            {{ money(text) }}
          </template>
        </a-table-column>
        <a-table-column title="核销应收单" data-index="receivableCodes" width="190">
          <template #default="{ text }">
            {{ Array.isArray(text) && text.length ? text.join('、') : '待核销' }}
          </template>
        </a-table-column>
        <a-table-column title="经办人" data-index="operator" width="110" />
      </a-table>
    </a-modal>

    <a-modal v-model:open="batchBalanceOpen" title="批量录入余额" width="1100px" :mask-closable="false" ok-text="确认汇总" cancel-text="取消" @ok="openBatchConfirm">
      <a-alert mb-3 type="info" show-icon :message="`当前批量合计 ${money(batchBalanceTotal)}。`" />
      <a-table
        row-key="index"
        size="small"
        :loading="saving"
        :pagination="false"
        :data-source="batchBalanceRows"
        :scroll="{ x: batchBalanceTableScrollX }"
      >
        <a-table-column title="主体名称" data-index="company_name" width="190">
          <template #default="{ record }">
            <a-input v-model:value="record.company_name" />
          </template>
        </a-table-column>
        <a-table-column title="银行名称" data-index="bank_name" width="140">
          <template #default="{ record }">
            <a-input v-model:value="record.bank_name" />
          </template>
        </a-table-column>
        <a-table-column title="账户名称" data-index="account_name" width="150">
          <template #default="{ record }">
            <a-input v-model:value="record.account_name" />
          </template>
        </a-table-column>
        <a-table-column title="账号" data-index="account_no_tail" width="220">
          <template #default="{ record }">
            <a-input v-model:value="record.account_no_tail" />
          </template>
        </a-table-column>
        <a-table-column title="余额" data-index="balance_amount" width="130">
          <template #default="{ record }">
            <business-input-number v-model:value="record.balance_amount" :precision="2" :min="0" style="width: 100%;" />
          </template>
        </a-table-column>
        <a-table-column title="备注" data-index="remark" width="150">
          <template #default="{ record }">
            <a-input v-model:value="record.remark" />
          </template>
        </a-table-column>
        <a-table-column title="操作" data-index="action" width="80">
          <template #default="{ index }">
            <a-button type="link" danger size="small" @click="removeBatchBalanceRow(index)">
              删除
            </a-button>
          </template>
        </a-table-column>
        <template #summary>
          <a-table-summary fixed>
            <a-table-summary-row class="cash-summary-row">
              <a-table-summary-cell :index="0" :col-span="4">
                批量录入总合计
              </a-table-summary-cell>
              <a-table-summary-cell :index="4">
                {{ money(batchBalanceTotal) }}
              </a-table-summary-cell>
              <a-table-summary-cell :index="5" :col-span="2">
                <a-button type="link" size="small" @click="addBatchBalanceRow">
                  增加一行
                </a-button>
              </a-table-summary-cell>
            </a-table-summary-row>
          </a-table-summary>
        </template>
      </a-table>
    </a-modal>

    <a-modal v-model:open="batchConfirmOpen" title="确认批量余额汇总" width="680px" :mask-closable="false" :confirm-loading="saving" :closable="!saving" :keyboard="!saving" :cancel-button-props="{ disabled: saving }" ok-text="确认提交" cancel-text="返回修改" @ok="submitBatchBalances">
      <a-alert mb-3 type="warning" show-icon message="提交后将按主体、银行和账号覆盖或新增余额记录。" />
      <a-descriptions bordered :column="1" size="small">
        <a-descriptions-item label="总汇总">
          {{ money(batchBalanceTotal) }}
        </a-descriptions-item>
        <a-descriptions-item v-for="group in batchBalanceSummary" :key="group.company_name" :label="group.company_name">
          {{ money(group.subtotal) }} / {{ group.rows.length }} 个账户
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </page-container>
</template>

<style scoped lang="less">
@import './oa-module.less';
</style>

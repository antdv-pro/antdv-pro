<script setup lang="ts">
import type { DictionaryItem, LoginLog, OperationLog, OrganizationNode, RoleRecord, SystemStatus, SystemUser } from '~@/api/system'
import { DownloadOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { cloneDeep } from 'lodash-es'
import { h } from 'vue'
import {
  deleteSystemDictionaryApi,
  deleteSystemOrganizationApi,
  deleteSystemRoleApi,
  deleteSystemUserApi,
  disableSystemUserApi,
  getSystemDictionariesApi,
  getSystemLoginLogsApi,
  getSystemOperationLogsApi,
  getSystemOrganizationsApi,
  getSystemRolesApi,
  getSystemUsersApi,
  recordSystemOperationApi,
  resetSystemUserPasswordApi,
  saveSystemDictionaryApi,
  saveSystemOrganizationApi,
  saveSystemRoleApi,
  saveSystemUserApi,
} from '~@/api/system'
import { invalidateBusinessDictionaries } from '~@/composables/business-dictionaries'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { buildOrganizationTree, getOrganizationTreeKey } from '~@/utils/organization-tree'
import { businessDictionaryDefaultKeySet, businessDictionaryTypes } from '../../../shared/business-dictionaries'

type ModalType = 'user' | 'org' | 'role' | 'dict'
type SystemSection = 'users' | 'org' | 'roles' | 'dicts' | 'logs'

const props = defineProps<{ section?: SystemSection }>()
const message = useMessage()
const route = useRoute()

const loading = ref(false)
const activeSection = computed<SystemSection>(() => props.section || resolveSystemSection(route.path))
const userKeyword = ref('')
const selectedUserOrgKeys = ref<string[]>([])
const selectedOrganizationKeys = ref<string[]>([])
const expandedUserOrgKeys = ref<string[]>([])
const logKeyword = ref('')
const logAction = ref<string>()
const dictType = ref<string>()

const users = ref<SystemUser[]>([])
const organizations = ref<OrganizationNode[]>([])
const roles = ref<RoleRecord[]>([])
const dictionaries = ref<DictionaryItem[]>([])
const loginLogs = ref<LoginLog[]>([])
const operationLogs = ref<OperationLog[]>([])

const modalOpen = ref(false)
const modalSaving = ref(false)
const modalType = ref<ModalType>('user')
const formModel = ref<Record<string, any>>({})
const passwordModalOpen = ref(false)
const passwordSubmitting = ref(false)
const passwordTarget = ref<Pick<SystemUser, 'id' | 'nickname'>>()
const passwordForm = ref({ password: '', confirmPassword: '' })
const passwordFormValid = computed(() => {
  const { password, confirmPassword } = passwordForm.value
  return password.length >= 6 && password.length <= 64 && password === confirmPassword
})
const modalTitle = computed(() => {
  const titleMap = { user: '用户', org: '组织', role: '角色', dict: '字典' }
  return `${formModel.value.id ? '编辑' : '新增'}${titleMap[modalType.value]}`
})

const statusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' },
]
const orgTypeOptions = [
  { label: '公司', value: 'company' },
  { label: '部门', value: 'department' },
  { label: '岗位', value: 'post' },
]
const dataScopeOptions = [
  { label: '全部数据', value: 'all' },
  { label: '本公司数据', value: 'company' },
  { label: '本部门数据', value: 'department' },
  { label: '本人数据', value: 'self' },
]
const buttonPermissionOptions = [
  { label: '查看', value: 'view' },
  { label: '新增', value: 'create' },
  { label: '修改', value: 'update' },
  { label: '删除', value: 'delete' },
  { label: '审批', value: 'approve' },
  { label: '导出', value: 'export' },
]
const menuPermissionOptions = [
  { label: '全部菜单', value: '*' },
  { label: '首页', value: '/dashboard/workplace' },
  { label: 'OA 审批', value: '/oa-approval' },
  { label: '审批中心', value: '/oa-approval/center' },
  { label: '办公用车', value: '/oa-approval/vehicle' },
  { label: '运输管理', value: '/transport' },
  { label: '规费管理', value: '/transport/fees' },
  { label: '车贷费用', value: '/transport/vehicle-loans' },
  { label: '系统管理', value: '/system' },
  { label: '用户管理', value: '/system/users' },
  { label: '组织管理', value: '/system/organization' },
  { label: '角色权限', value: '/system/roles' },
  { label: '系统字典', value: '/system/dictionaries' },
  { label: '安全日志', value: '/system/logs' },
]
const menuPermissionTree = [
  { title: '首页', key: '/dashboard/workplace' },
  { title: 'OA 审批', key: '/oa-approval', children: [
    { title: '审批中心', key: '/oa-approval/center' },
    { title: '办公用车', key: '/oa-approval/vehicle' },
  ] },
  { title: '运输管理', key: '/transport', children: [
    { title: '规费管理', key: '/transport/fees' },
    { title: '车贷费用', key: '/transport/vehicle-loans' },
  ] },
  { title: '系统管理', key: '/system', children: [
    { title: '用户管理', key: '/system/users' },
    { title: '组织管理', key: '/system/organization' },
    { title: '角色权限', key: '/system/roles' },
    { title: '系统字典', key: '/system/dictionaries' },
    { title: '安全日志', key: '/system/logs' },
  ] },
]
const roleTemplates = [
  { label: '管理员', value: 'admin', menus: ['*'], buttons: buttonPermissionOptions.map(item => item.value), scope: 'all' },
  { label: '部门负责人', value: 'manager', menus: ['/dashboard/workplace', '/oa-approval', '/oa-approval/center', '/transport'], buttons: ['view', 'create', 'update', 'approve', 'export'], scope: 'department' },
  { label: '财务人员', value: 'finance', menus: ['/dashboard/workplace', '/oa-approval', '/oa-approval/center', '/transport', '/transport/fees', '/transport/vehicle-loans'], buttons: ['view', 'create', 'update', 'approve', 'export'], scope: 'company' },
  { label: '只读用户', value: 'viewer', menus: ['/dashboard/workplace'], buttons: ['view', 'export'], scope: 'self' },
]

function applyRoleTemplate(value: unknown) {
  const template = roleTemplates.find(item => item.value === String(value || ''))
  if (!template)
    return
  formModel.value.menuPermissions = [...template.menus]
  formModel.value.buttonPermissions = [...template.buttons]
  formModel.value.dataScope = template.scope
}
const systemDictionaryTypes = [
  { label: '费用类型', value: 'fee_type' },
  { label: '审批状态', value: 'approval_status' },
  { label: '车辆状态', value: 'vehicle_status' },
  { label: '证照类型', value: 'license_type' },
  { label: '支付方式', value: 'payment_method' },
]
const dictionaryTypeOptions = [...systemDictionaryTypes, ...businessDictionaryTypes]
const dictionaryTypeSelectOptions = [
  { label: '系统字典', options: systemDictionaryTypes },
  { label: '业务主数据', options: [...businessDictionaryTypes] },
]

const stats = computed(() => [
  { label: '用户总数', value: users.value.length },
  { label: '启用用户', value: users.value.filter(item => item.status === 'enabled').length },
  { label: '组织节点', value: organizations.value.length },
  { label: '角色数量', value: roles.value.length },
  { label: '字典项', value: dictionaries.value.length },
])

const companyOptions = computed(() => organizations.value.filter(item => item.type === 'company').map(toSelectOption))
const deptOptions = computed(() => organizations.value.filter(item => item.type === 'department').map(toSelectOption))
const postOptions = computed(() => organizations.value.filter(item => item.type === 'post').map(toSelectOption))
const userPostOptions = computed(() => organizations.value
  .filter(item => item.type === 'post' && (!formModel.value.deptId || item.parentId === formModel.value.deptId))
  .map(toSelectOption))
const roleOptions = computed(() => roles.value.map(item => ({ label: item.name, value: item.id })))
const roleNameMap = computed(() => new Map(roles.value.map(item => [item.code, item.name])))
const userOptions = computed(() => users.value.map(item => ({ label: item.nickname, value: item.id })))
const userOrganizationNodes = computed(() => {
  const included = new Set<string>()
  const includeWithParents = (item?: OrganizationNode) => {
    let current = item
    while (current) {
      const key = getOrganizationTreeKey(current)
      if (included.has(key))
        break
      included.add(key)
      const parentId = current.parentId
      if (parentId == null) {
        current = undefined
        continue
      }
      const parentType = current.type === 'post'
        ? 'department'
        : organizations.value.some(parent => parent.type === 'department' && String(parent.id) === String(parentId) && String(parent.id) !== String(current?.id))
          ? 'department'
          : 'company'
      current = organizations.value.find(parent => parent.type === parentType && String(parent.id) === String(parentId))
    }
  }
  users.value.forEach((user) => {
    includeWithParents(organizations.value.find(item => item.type === 'company' && String(item.id) === String(user.companyId)))
    includeWithParents(organizations.value.find(item => item.type === 'department' && String(item.id) === String(user.deptId)))
    includeWithParents(organizations.value.find(item =>
      item.type === 'post'
      && String(item.id) === String(user.postId)
      && String(item.parentId) === String(user.deptId),
    ))
  })
  return organizations.value.filter(item => included.has(getOrganizationTreeKey(item)))
})
const orgTree = computed(() => buildOrganizationTree(organizations.value, getOrganizationMemberCount))
const userOrgTree = computed(() => buildOrganizationTree(userOrganizationNodes.value, getOrganizationMemberCount))
const selectedUserOrg = computed(() => organizations.value.find(item => getOrganizationTreeKey(item) === selectedUserOrgKeys.value[0]))
function findTreeNode(nodes: ReturnType<typeof buildOrganizationTree>, key?: string): ReturnType<typeof buildOrganizationTree>[number] | undefined {
  for (const node of nodes) {
    if (node.key === key)
      return node
    const child = findTreeNode(node.children, key)
    if (child)
      return child
  }
}
const selectedOrganizationNode = computed(() =>
  findTreeNode(userOrgTree.value, selectedOrganizationKeys.value[0]) || userOrgTree.value[0],
)
const selectedOrganization = computed(() => selectedOrganizationNode.value)
const selectedOrganizationMembers = computed(() => {
  const selected = selectedOrganization.value
  if (!selected)
    return []
  if (selected.type === 'company')
    return users.value.filter(user => String(user.companyId || '') === String(selected.id || ''))
  if (selected.type === 'department')
    return getDepartmentMembers(selected)
  return users.value.filter(user =>
    String(user.deptId || '') === String(selected.parentId || '')
    && String(user.postId || '') === String(selected.id || ''),
  )
})
const selectedOrganizationChildren = computed(() => {
  return selectedOrganizationNode.value?.children || []
})
const filteredUsers = computed(() => {
  const keyword = userKeyword.value.trim().toLowerCase()
  const selected = selectedUserOrg.value

  return users.value.filter((user) => {
    const matchesKeyword = !keyword || [user.nickname, user.username, user.mobile, user.deptName, user.postName]
      .some(value => String(value || '').toLowerCase().includes(keyword))
    if (!matchesKeyword || !selected)
      return matchesKeyword
    if (selected.type === 'company')
      return String(user.companyId || '') === String(selected.id || '') || user.companyName === selected.name
    if (selected.type === 'department')
      return String(user.deptId || '') === String(selected.id || '') || user.deptName === selected.name
    const belongsToPostDepartment = String(user.deptId || '') === String(selected.parentId || '')
    return belongsToPostDepartment
      && (String(user.postId || '') === String(selected.id || '') || user.postName === selected.name)
  })
})

const userColumns = [
  { title: '姓名', dataIndex: 'nickname', width: 120 },
  { title: '手机', dataIndex: 'mobile', width: 130 },
  { title: '企业微信 UserID', dataIndex: 'wecomUserId', width: 170 },
  { title: '部门', dataIndex: 'deptName', width: 130 },
  { title: '岗位', dataIndex: 'postName', width: 130 },
  { title: '角色', dataIndex: 'roles', width: 180 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '最近登录', dataIndex: 'lastLoginAt', width: 170 },
  { title: '操作', dataIndex: 'action', width: 260, fixed: 'right' as const },
]
const userTableColumns = computed(() => enhanceBusinessTableColumns(userColumns, { noSortFields: ['roles'] }))
const userTableScrollX = computed(() => createBusinessTableScrollX(userTableColumns.value, 1450))
const roleColumns = [
  { title: '角色名称', dataIndex: 'name', width: 130 },
  { title: '角色编码', dataIndex: 'code', width: 150 },
  { title: '数据权限', dataIndex: 'dataScope', width: 120 },
  { title: '菜单权限', dataIndex: 'menuPermissions' },
  { title: '按钮权限', dataIndex: 'buttonPermissions', width: 220 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '操作', dataIndex: 'action', width: 160 },
]
const roleTableColumns = computed(() => enhanceBusinessTableColumns(roleColumns, { noSortFields: ['menuPermissions', 'buttonPermissions'] }))
const roleTableScrollX = computed(() => createBusinessTableScrollX(roleTableColumns.value, 1180))
const dictColumns = [
  { title: '字典类型', dataIndex: 'typeName', width: 120 },
  { title: '类型编码', dataIndex: 'type', width: 150 },
  { title: '标签', dataIndex: 'label', width: 140 },
  { title: '值', dataIndex: 'value', width: 160 },
  { title: '排序', dataIndex: 'sortNo', width: 90 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '操作', dataIndex: 'action', width: 150 },
]
const dictTableColumns = computed(() => enhanceBusinessTableColumns(dictColumns))
const dictTableScrollX = computed(() => createBusinessTableScrollX(dictTableColumns.value, 900))
const loginLogColumns = [
  { title: '账号', dataIndex: 'username', width: 130 },
  { title: '姓名', dataIndex: 'nickname', width: 120 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: 'IP', dataIndex: 'ip', width: 130 },
  { title: '说明', dataIndex: 'message', width: 160 },
  { title: '时间', dataIndex: 'createdAt', width: 180 },
  { title: '终端', dataIndex: 'userAgent', ellipsis: true },
]
const loginLogTableColumns = computed(() => enhanceBusinessTableColumns(loginLogColumns))
const loginLogTableScrollX = computed(() => createBusinessTableScrollX(loginLogTableColumns.value, 1000))
const operationLogColumns = [
  { title: '模块', dataIndex: 'module', width: 120 },
  { title: '动作', dataIndex: 'action', width: 120 },
  { title: '内容', dataIndex: 'content' },
  { title: '操作人', dataIndex: 'operatorName', width: 130 },
  { title: '时间', dataIndex: 'createdAt', width: 180 },
]
const operationLogTableColumns = computed(() => enhanceBusinessTableColumns(operationLogColumns))
const operationLogTableScrollX = computed(() => createBusinessTableScrollX(operationLogTableColumns.value, 900))

onMounted(loadAll)

function resolveSystemSection(path: string): SystemSection {
  if (path.includes('/organization'))
    return 'org'
  if (path.includes('/roles'))
    return 'roles'
  if (path.includes('/dictionaries'))
    return 'dicts'
  if (path.includes('/logs'))
    return 'logs'
  return 'users'
}

function toSelectOption(item: OrganizationNode) {
  return { label: item.name, value: item.id }
}

function roleLabel(role: string | number) {
  const code = String(role)
  const fallbackLabels: Record<string, string> = {
    ADMIN: '管理员',
    APPROVER: '审批人',
    DEPT_LEADER: '部门负责人',
    FINANCE_MANAGER: '财务',
    GENERAL_MANAGER: '总经理',
    OFFICE_ADMIN: '行政管理员',
    USER: '普通用户',
  }
  return roleNameMap.value.get(code) || fallbackLabels[code] || code
}

function getDepartmentMembers(department: Pick<OrganizationNode, 'id' | 'name'>) {
  return users.value.filter(user =>
    String(user.deptId || '') === String(department.id || '')
    || (!user.deptId && String(user.deptName || '') === String(department.name || '')),
  )
}

function getOrganizationMemberCount(item: OrganizationNode) {
  if (item.type === 'company')
    return users.value.filter(user => String(user.companyId || '') === String(item.id || '') || user.companyName === item.name).length
  if (item.type === 'department')
    return getDepartmentMembers(item).length
  return users.value.filter(user =>
    String(user.deptId || '') === String(item.parentId || '')
    && (String(user.postId || '') === String(item.id || '') || user.postName === item.name),
  ).length
}

function statusLabel(status: SystemStatus) {
  return status === 'enabled' ? '启用' : '禁用'
}

function formatDisplayDate(value: unknown) {
  const text = String(value || '').trim()
  if (!text)
    return '-'
  const date = new Date(text)
  if (Number.isNaN(date.getTime()))
    return text
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function maskMobile(value: unknown) {
  const text = String(value || '')
  return text.length >= 7 ? `${text.slice(0, 3)}****${text.slice(-4)}` : text || '-'
}

function maskIp(value: unknown) {
  const text = String(value || '')
  if (!text)
    return '-'
  if (text.includes(':'))
    return text.replace(/:[^:]+$/, ':****')
  const parts = text.split('.')
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.***.***` : text
}

function formatUserAgent(value: unknown) {
  const text = String(value || '')
  return text ? text.replace(/\s+/g, ' ').slice(0, 80) : '-'
}

function statusColor(status: SystemStatus) {
  return status === 'enabled' ? 'green' : 'red'
}

function orgTypeLabel(type: string) {
  return orgTypeOptions.find(item => item.value === type)?.label || type
}

function dataScopeLabel(scope: string) {
  return dataScopeOptions.find(item => item.value === scope)?.label || scope
}

function menuPermissionLabel(permission: string) {
  return menuPermissionOptions.find(item => item.value === permission)?.label || permission
}

function buttonPermissionLabel(permission: string) {
  return buttonPermissionOptions.find(item => item.value === permission)?.label || permission
}

async function loadAll() {
  loading.value = true
  try {
    const [userRes, orgRes, roleRes, dictRes, loginRes, opRes] = await Promise.all([
      getSystemUsersApi(),
      getSystemOrganizationsApi(),
      getSystemRolesApi(),
      getSystemDictionariesApi({ type: dictType.value }),
      getSystemLoginLogsApi({ keyword: logKeyword.value }),
      getSystemOperationLogsApi({ keyword: logKeyword.value, action: logAction.value }),
    ])
    users.value = userRes.data || []
    organizations.value = orgRes.data || []
    expandedUserOrgKeys.value = organizations.value
      .filter(item => item.type !== 'post')
      .map(getOrganizationTreeKey)
    roles.value = roleRes.data || []
    dictionaries.value = dictRes.data || []
    loginLogs.value = loginRes.data || []
    operationLogs.value = opRes.data || []
  }
  finally {
    loading.value = false
  }
}

async function queryUsers() {
  // 搜索由 filteredUsers 即时完成，保留完整用户集以保证组织人数准确。
}

async function queryDicts() {
  const res = await getSystemDictionariesApi({ type: dictType.value })
  dictionaries.value = res.data || []
}

async function queryLogs() {
  const [loginRes, opRes] = await Promise.all([
    getSystemLoginLogsApi({ keyword: logKeyword.value }),
    getSystemOperationLogsApi({ keyword: logKeyword.value, action: logAction.value }),
  ])
  loginLogs.value = loginRes.data || []
  operationLogs.value = opRes.data || []
}

function openModal(type: ModalType, record?: any) {
  modalType.value = type
  formModel.value = record ? cloneDeep(record) : createDefaultModel(type)
  modalOpen.value = true
}

function openAddPostMember(post: Record<string, any>) {
  const model = createDefaultModel('user') as Record<string, any>
  const department = organizations.value.find(item => item.id === post.departmentId || item.id === post.parentId)
  const company = organizations.value.find(item => item.type === 'company')

  model.fromOrgAdd = true
  model.companyId = company?.id || model.companyId
  model.deptId = department?.id || model.deptId
  model.postId = organizations.value.some(item => item.id === post.id) ? post.id : undefined
  model.postName = String(post.name || '')
  modalType.value = 'user'
  formModel.value = model
  modalOpen.value = true
}

function openAddMember(record: OrganizationNode) {
  const model = createDefaultModel('user') as Record<string, any>
  const parent = record.parentId ? organizations.value.find(item => item.id === record.parentId) : undefined
  const parentDept = parent?.type === 'department' ? parent : undefined
  const company = record.type === 'company'
    ? record
    : organizations.value.find(item => item.id === record.parentId && item.type === 'company')
      || organizations.value.find(item => item.id === parentDept?.parentId && item.type === 'company')
      || organizations.value.find(item => item.type === 'company')

  if (record.type === 'company') {
    model.companyId = record.id
    model.deptId = deptOptions.value[0]?.value
    model.postId = postOptions.value[0]?.value
  }
  else if (record.type === 'department') {
    const firstPost = organizations.value.find(item => item.parentId === record.id && item.type === 'post')
    model.companyId = company?.id
    model.deptId = record.id
    model.postId = firstPost?.id || postOptions.value[0]?.value
    model.postName = String(firstPost?.name || postOptions.value.find(item => item.value === model.postId)?.label || '')
  }
  else {
    model.companyId = company?.id
    model.deptId = parentDept?.id || deptOptions.value[0]?.value
    model.postId = record.id
    model.postName = String(record.name || '')
  }

  model.fromOrgAdd = true
  modalType.value = 'user'
  formModel.value = model
  modalOpen.value = true
}

function createDefaultModel(type: ModalType) {
  const defaultCompany = organizations.value.find(item => item.type === 'company' && item.name === '青海诚捷运输有限公司')
    || organizations.value.find(item => item.type === 'company')
  const defaultDepartment = organizations.value.find(item => item.type === 'department' && item.parentId === defaultCompany?.id)
    || organizations.value.find(item => item.type === 'department')
  const defaultPost = organizations.value.find(item => item.type === 'post' && item.parentId === defaultDepartment?.id)

  const map = {
    user: {
      username: '',
      nickname: '',
      mobile: '',
      wecomUserId: '',
      email: '',
      companyId: defaultCompany?.id,
      deptId: defaultDepartment?.id,
      deptName: String(defaultDepartment?.name || ''),
      postId: defaultPost?.id,
      postName: String(defaultPost?.name || ''),
      roleIds: [],
      roles: [],
      status: 'enabled',
      password: '123456',
    },
    org: {
      type: 'department',
      name: '',
      code: '',
      parentId: 'company-main',
      leaderId: undefined,
      leaderName: '',
      sortNo: organizations.value.length + 1,
      status: 'enabled',
      remark: '',
    },
    role: {
      code: '',
      name: '',
      dataScope: 'self',
      menuPermissions: [],
      buttonPermissions: [],
      status: 'enabled',
      remark: '',
    },
    dict: {
      type: 'fee_type',
      typeName: '费用类型',
      label: '',
      value: '',
      sortNo: dictionaries.value.length + 1,
      status: 'enabled',
      remark: '',
    },
  }
  return map[type]
}

function syncLeaderName() {
  const leader = users.value.find(item => item.id === formModel.value.leaderId)
  formModel.value.leaderName = leader?.nickname
}

function syncUserDepartment(value?: unknown) {
  const deptId = String(value || '')
  const department = organizations.value.find(item => item.type === 'department' && String(item.id) === deptId)
  formModel.value.deptName = String(department?.name || '')
  const post = organizations.value.find(item => item.type === 'post' && String(item.id) === String(formModel.value.postId) && String(item.parentId) === deptId)
  if (!post) {
    formModel.value.postId = undefined
    formModel.value.postName = ''
  }
}

function syncUserPost(value?: unknown) {
  const postId = String(value || '')
  const post = organizations.value.find(item => item.type === 'post' && String(item.id) === postId && String(item.parentId) === String(formModel.value.deptId))
  formModel.value.postName = String(post?.name || '')
}

async function ensureUserDepartment() {
  const deptName = String(formModel.value.deptName ?? '').trim()
  if (!deptName) {
    formModel.value.deptId = undefined
    return
  }

  const existingDepartment = organizations.value.find(item => item.type === 'department' && item.name === deptName)
  if (existingDepartment) {
    formModel.value.deptId = existingDepartment.id
    formModel.value.deptName = existingDepartment.name
    return
  }

  const newDepartment = {
    type: 'department' as const,
    name: deptName,
    code: `DEPT${String(organizations.value.filter(item => item.type === 'department').length + 1).padStart(3, '0')}`,
    parentId: formModel.value.companyId || 'company-main',
    sortNo: organizations.value.length + 1,
    status: 'enabled' as const,
    remark: '用户管理中手动输入创建',
  }
  const res = await saveSystemOrganizationApi(newDepartment)
  const savedDepartment = (res.data || { ...newDepartment, id: `department-${Date.now()}` }) as OrganizationNode
  formModel.value.deptId = savedDepartment.id
  formModel.value.deptName = savedDepartment.name
  organizations.value.push(savedDepartment)
}

async function ensureUserPost() {
  if (modalType.value !== 'user')
    return
  const postName = String(formModel.value.postName ?? '').trim()
  if (!postName) {
    formModel.value.postId = undefined
    return
  }

  const existingPost = organizations.value.find(item => item.type === 'post' && item.parentId === formModel.value.deptId && item.name === postName)
  if (existingPost) {
    formModel.value.postId = existingPost.id
    formModel.value.postName = existingPost.name
    return
  }

  const newPost = {
    type: 'post' as const,
    name: postName,
    code: `POST${String(organizations.value.filter(item => item.type === 'post').length + 1).padStart(3, '0')}`,
    parentId: formModel.value.deptId || 'company-main',
    sortNo: organizations.value.length + 1,
    status: 'enabled' as const,
    remark: '用户管理中手动输入创建',
  }
  const res = await saveSystemOrganizationApi(newPost)
  const savedPost = (res.data || { ...newPost, id: `post-${Date.now()}` }) as OrganizationNode
  formModel.value.postId = savedPost.id
  formModel.value.postName = savedPost.name
  organizations.value.push(savedPost)
}

function syncDictTypeName() {
  formModel.value.typeName = dictionaryTypeOptions.find(item => item.value === formModel.value.type)?.label || ''
}

function isProtectedDictionary(record: DictionaryItem) {
  return businessDictionaryDefaultKeySet.has(`${record.type}::${record.value}`)
}

function modalValidationError() {
  const model = formModel.value
  if (modalType.value === 'user') {
    if (!String(model.nickname || '').trim())
      return '请填写姓名'
    if (!/^1\d{10}$/.test(String(model.mobile || '').trim()))
      return '请填写 11 位手机号'
    if (model.email && !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(String(model.email)))
      return '请填写有效邮箱'
    if (!model.companyId || !model.deptId || !model.postId)
      return '请选择公司、部门和岗位'
    if (!Array.isArray(model.roleIds) || !model.roleIds.length)
      return '请至少选择一个角色'
    if (!model.id && String(model.password || '').length < 6)
      return '初始密码至少 6 位'
  }
  if (modalType.value === 'org') {
    if (!model.type || !String(model.name || '').trim() || !String(model.code || '').trim())
      return '请填写组织类型、名称和编码'
    if (model.type !== 'company' && !model.parentId)
      return '请选择上级组织'
  }
  if (modalType.value === 'role' && (!String(model.name || '').trim() || !String(model.code || '').trim()))
    return '请填写角色名称和编码'
  if (modalType.value === 'dict' && (!model.type || !String(model.label || '').trim() || !String(model.value || '').trim()))
    return '请选择数据类型并填写标签、键值'
  return ''
}

async function submitModal() {
  if (modalSaving.value)
    return
  const validationError = modalValidationError()
  if (validationError) {
    message.warning(validationError)
    return
  }
  modalSaving.value = true
  try {
    if (modalType.value === 'user') {
      if (!String(formModel.value.username || '').trim())
        formModel.value.username = `u${Date.now()}`
      await ensureUserDepartment()
      await ensureUserPost()
      await saveSystemUserApi(formModel.value)
    }
    if (modalType.value === 'org')
      await saveSystemOrganizationApi(formModel.value)
    if (modalType.value === 'role')
      await saveSystemRoleApi(formModel.value)
    if (modalType.value === 'dict') {
      await saveSystemDictionaryApi(formModel.value)
      invalidateBusinessDictionaries()
    }
    modalOpen.value = false
    message.success('保存成功')
    await loadAll()
  }
  catch (error: any) {
    message.error(error?.message || '保存失败，请检查录入内容')
  }
  finally {
    modalSaving.value = false
  }
}

async function removeRecord(type: ModalType, record: any) {
  if (type === 'user')
    await deleteSystemUserApi(record.id)
  if (type === 'org')
    await deleteSystemOrganizationApi(record.id)
  if (type === 'role')
    await deleteSystemRoleApi(record.id)
  if (type === 'dict')
    await deleteSystemDictionaryApi(record.id)
  if (type === 'dict')
    invalidateBusinessDictionaries()
  message.success('删除成功')
  await loadAll()
}

async function toggleUser(record: any) {
  await disableSystemUserApi(record.id!, record.status === 'enabled' ? 'disabled' : 'enabled')
  message.success(record.status === 'enabled' ? '已禁用用户' : '已启用用户')
  await loadAll()
}

function openPasswordModal(record: Record<string, any>) {
  passwordTarget.value = { id: record.id, nickname: String(record.nickname || '') }
  passwordForm.value = { password: '', confirmPassword: '' }
  passwordModalOpen.value = true
}

async function submitPasswordReset() {
  if (!passwordTarget.value?.id || !passwordFormValid.value)
    return
  passwordSubmitting.value = true
  try {
    await resetSystemUserPasswordApi(passwordTarget.value.id, passwordForm.value.password)
    message.success(`已修改 ${passwordTarget.value.nickname} 的密码`)
    passwordModalOpen.value = false
    await loadAll()
  }
  finally {
    passwordSubmitting.value = false
  }
}

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) {
    message.warning('暂无可导出数据')
    return
  }
  const headers = Object.keys(rows[0])
  const content = [headers.join(','), ...rows.map(row => headers.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function exportOperationLogs() {
  downloadCsv('操作日志.csv', operationLogs.value)
  await recordSystemOperationApi({ module: '操作日志', action: 'export', content: '导出操作日志' })
  await queryLogs()
}

async function exportUsers() {
  downloadCsv('用户列表.csv', filteredUsers.value as any)
  await recordSystemOperationApi({ module: '用户管理', action: 'export', content: '导出用户列表' })
  await queryLogs()
}
</script>

<template>
  <div class="system-page">
    <div class="system-header">
      <div>
        <h2>系统管理</h2>
        <p>用户、组织、角色权限、业务主数据和安全日志统一维护</p>
      </div>
      <a-button :icon="h(ReloadOutlined)" @click="loadAll">
        刷新
      </a-button>
    </div>

    <a-row :gutter="[12, 12]" class="stat-row">
      <a-col v-for="item in stats" :key="item.label" :xs="12" :sm="8" :md="4">
        <a-card size="small">
          <div class="stat-value">
            {{ item.value }}
          </div>
          <div class="stat-label">
            {{ item.label }}
          </div>
        </a-card>
      </a-col>
    </a-row>

    <div class="system-section-stack">
      <a-card v-if="activeSection === 'users'" title="用户管理" :bordered="false" class="system-section-card">
        <a-space class="toolbar" wrap>
          <a-input-search v-model:value="userKeyword" placeholder="搜索姓名/手机/部门/岗位" allow-clear style="width: 260px" @search="queryUsers" />
          <a-button type="primary" :icon="h(PlusOutlined)" @click="openModal('user')">
            新增用户
          </a-button>
          <a-button :icon="h(DownloadOutlined)" @click="exportUsers">
            导出
          </a-button>
        </a-space>
        <div class="user-org-layout">
          <aside class="user-org-panel" aria-label="组织架构筛选">
            <div class="user-org-panel__header">
              <div>
                <strong>组织架构</strong>
                <span>人员数据实时同步</span>
              </div>
              <a-button v-if="selectedUserOrgKeys.length" type="link" size="small" @click="selectedUserOrgKeys = []">
                清除
              </a-button>
            </div>
            <a-tree
              v-model:selected-keys="selectedUserOrgKeys"
              v-model:expanded-keys="expandedUserOrgKeys"
              :tree-data="userOrgTree"
              block-node
            >
              <template #title="node">
                <span class="user-org-tree-title">
                  <span>{{ node.title }}</span>
                  <span class="user-org-tree-count">{{ node.memberCount }}</span>
                </span>
              </template>
            </a-tree>
          </aside>
          <section class="user-list-panel" :aria-label="selectedUserOrg ? `${selectedUserOrg.name}用户列表` : '全部用户列表'">
            <div class="user-list-summary">
              <span>
                <strong>{{ selectedUserOrg?.name || '全部组织' }}</strong>
                <template v-if="selectedUserOrg"> · {{ orgTypeLabel(selectedUserOrg.type) }}</template>
              </span>
              <span>显示 {{ filteredUsers.length }} / {{ users.length }} 人</span>
            </div>
            <a-table :loading="loading" :columns="userTableColumns" :data-source="filteredUsers" row-key="id" size="middle" :scroll="{ x: userTableScrollX }">
              <template #emptyText>
                <a-empty :description="userKeyword || selectedUserOrg ? '当前筛选下暂无用户' : '暂无用户'" />
              </template>
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'roles'">
                  <a-space wrap>
                    <a-tag v-for="role in record.roles" :key="role" color="blue">
                      {{ roleLabel(role) }}
                    </a-tag>
                  </a-space>
                </template>
                <template v-else-if="column.dataIndex === 'status'">
                  <a-tag :color="statusColor(record.status)">
                    {{ statusLabel(record.status) }}
                  </a-tag>
                </template>
                <template v-else-if="column.dataIndex === 'action'">
                  <a-space>
                    <a @click="openModal('user', record)">编辑</a>
                    <a-popconfirm
                      :title="record.status === 'enabled' ? '确认禁用该用户？' : '确认启用该用户？'"
                      :description="record.status === 'enabled' ? '禁用后该账号将立即无法登录，但历史业务记录会保留。' : '启用后该账号将恢复登录和所属角色权限。'"
                      @confirm="toggleUser(record)"
                    >
                      <a>{{ record.status === 'enabled' ? '禁用' : '启用' }}</a>
                    </a-popconfirm>
                    <a @click="openPasswordModal(record)">重置密码</a>
                    <a-popconfirm title="确认删除该用户？" description="删除后账号无法恢复，历史业务记录仍保留操作人名称。" ok-type="danger" @confirm="removeRecord('user', record)">
                      <a class="danger-link">删除</a>
                    </a-popconfirm>
                  </a-space>
                </template>
                <template v-else-if="column.dataIndex === 'mobile'">
                  {{ maskMobile(record.mobile) }}
                </template>
                <template v-else-if="column.dataIndex === 'lastLoginAt'">
                  {{ formatDisplayDate(record.lastLoginAt) }}
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
          </section>
        </div>
      </a-card>

      <a-card v-if="activeSection === 'org'" title="组织架构" :bordered="false" class="system-section-card">
        <a-space class="toolbar" wrap>
          <a-button type="primary" :icon="h(PlusOutlined)" @click="openModal('org')">
            新增组织
          </a-button>
        </a-space>
        <div class="organization-sync-layout">
          <aside class="user-org-panel" aria-label="组织架构">
            <div class="user-org-panel__header">
              <div>
                <strong>组织树</strong>
                <span>与用户管理实时同步</span>
              </div>
            </div>
            <a-tree
              v-model:selected-keys="selectedOrganizationKeys"
              v-model:expanded-keys="expandedUserOrgKeys"
              :tree-data="userOrgTree"
              block-node
            >
              <template #title="node">
                <span class="user-org-tree-title">
                  <span>{{ node.title }}</span>
                  <span class="user-org-tree-count">{{ node.memberCount }}</span>
                </span>
              </template>
            </a-tree>
          </aside>

          <section v-if="selectedOrganization" class="organization-detail">
            <header class="organization-detail__header">
              <div>
                <h3>{{ selectedOrganization.name }}</h3>
                <p>{{ orgTypeLabel(selectedOrganization.type) }} / {{ selectedOrganization.code }} / {{ selectedOrganizationMembers.length }} 人</p>
              </div>
              <a-space>
                <a-button @click="openModal('org', selectedOrganization)">
                  编辑
                </a-button>
                <a-button
                  v-if="selectedOrganization.type !== 'company'"
                  type="primary"
                  @click="selectedOrganization.type === 'post' ? openAddPostMember(selectedOrganization) : openAddMember(selectedOrganization)"
                >
                  添加成员
                </a-button>
              </a-space>
            </header>

            <a-descriptions :column="2" bordered size="small">
              <a-descriptions-item label="类型">
                {{ orgTypeLabel(selectedOrganization.type) }}
              </a-descriptions-item>
              <a-descriptions-item label="状态">
                <a-tag :color="statusColor(selectedOrganization.status)">
                  {{ statusLabel(selectedOrganization.status) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="负责人">
                {{ selectedOrganization.leaderName || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="下级节点">
                {{ selectedOrganizationChildren.length }}
              </a-descriptions-item>
            </a-descriptions>

            <div class="organization-detail__section">
              <h4>下级组织</h4>
              <div v-if="selectedOrganizationChildren.length" class="organization-child-list">
                <button
                  v-for="child in selectedOrganizationChildren"
                  :key="getOrganizationTreeKey(child)"
                  type="button"
                  class="organization-child-item"
                  @click="selectedOrganizationKeys = [getOrganizationTreeKey(child)]"
                >
                  <strong>{{ child.name }}</strong>
                  <span>{{ orgTypeLabel(child.type) }} / {{ getOrganizationMemberCount(child) }} 人</span>
                </button>
              </div>
              <a-empty v-else description="暂无下级组织" :image-style="{ height: '48px' }" />
            </div>

            <div class="organization-detail__section">
              <h4>成员</h4>
              <a-table
                :columns="userTableColumns.filter(column => !['mobile', 'wecomUserId', 'lastLoginAt', 'action'].includes(String(column.dataIndex)))"
                :data-source="selectedOrganizationMembers"
                row-key="id"
                size="small"
                :pagination="false"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'roles'">
                    <a-tag v-for="role in record.roles" :key="role" color="blue">
                      {{ roleLabel(role) }}
                    </a-tag>
                  </template>
                  <template v-else-if="column.dataIndex === 'status'">
                    <a-tag :color="statusColor(record.status)">
                      {{ statusLabel(record.status) }}
                    </a-tag>
                  </template>
                </template>
              </a-table>
            </div>
          </section>
        </div>
      </a-card>

      <a-card v-if="activeSection === 'roles'" title="角色权限" :bordered="false" class="system-section-card">
        <a-space class="toolbar" wrap>
          <a-button type="primary" :icon="h(PlusOutlined)" @click="openModal('role')">
            新增角色
          </a-button>
        </a-space>
        <a-table :loading="loading" :columns="roleTableColumns" :data-source="roles" row-key="id" size="middle" :scroll="{ x: roleTableScrollX }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'dataScope'">
              {{ dataScopeLabel(record.dataScope) }}
            </template>
            <template v-else-if="column.dataIndex === 'menuPermissions'">
              <a-space wrap>
                <a-tag v-for="item in record.menuPermissions" :key="item">
                  {{ menuPermissionLabel(item) }}
                </a-tag>
              </a-space>
            </template>
            <template v-else-if="column.dataIndex === 'buttonPermissions'">
              <a-space wrap>
                <a-tag v-for="item in record.buttonPermissions" :key="item" color="purple">
                  {{ buttonPermissionLabel(item) }}
                </a-tag>
              </a-space>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-tag :color="statusColor(record.status)">
                {{ statusLabel(record.status) }}
              </a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'action'">
              <a-space>
                <a @click="openModal('role', record)">编辑</a>
                <a-popconfirm title="确认删除该角色？" ok-type="danger" @confirm="removeRecord('role', record)">
                  <a class="danger-link">删除</a>
                </a-popconfirm>
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
      </a-card>

      <a-card v-if="activeSection === 'dicts'" title="字典与业务主数据" :bordered="false" class="system-section-card">
        <a-space class="toolbar" wrap>
          <a-select v-model:value="dictType" allow-clear placeholder="选择数据类型" style="width: 220px" :options="dictionaryTypeSelectOptions" @change="queryDicts" />
          <a-button type="primary" :icon="h(PlusOutlined)" @click="openModal('dict')">
            新增字典
          </a-button>
        </a-space>
        <a-table :loading="loading" :columns="dictTableColumns" :data-source="dictionaries" row-key="id" size="middle" :scroll="{ x: dictTableScrollX }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'status'">
              <a-tag :color="statusColor(record.status)">
                {{ statusLabel(record.status) }}
              </a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'action'">
              <a-space>
                <a @click="openModal('dict', record)">编辑</a>
                <a-popconfirm v-if="!isProtectedDictionary(record as DictionaryItem)" title="确认删除该字典项？" ok-type="danger" @confirm="removeRecord('dict', record)">
                  <a class="danger-link">删除</a>
                </a-popconfirm>
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
      </a-card>

      <a-card v-if="activeSection === 'logs'" title="安全日志" :bordered="false" class="system-section-card">
        <a-space class="toolbar" wrap>
          <a-input-search v-model:value="logKeyword" placeholder="搜索账号/模块/内容/操作人" allow-clear style="width: 260px" @search="queryLogs" />
          <a-select v-model:value="logAction" allow-clear placeholder="操作类型" style="width: 160px" @change="queryLogs">
            <a-select-option value="create">
              新增
            </a-select-option>
            <a-select-option value="update">
              修改
            </a-select-option>
            <a-select-option value="delete">
              删除
            </a-select-option>
            <a-select-option value="approve">
              审批
            </a-select-option>
            <a-select-option value="export">
              导出
            </a-select-option>
          </a-select>
          <a-button :icon="h(DownloadOutlined)" @click="exportOperationLogs">
            导出操作日志
          </a-button>
        </a-space>
        <div class="log-section-stack">
          <a-card size="small" title="操作日志" :bordered="false" class="log-section-card">
            <a-table :columns="operationLogTableColumns" :data-source="operationLogs" row-key="id" size="middle" :scroll="{ x: operationLogTableScrollX }">
              <template #bodyCell="{ column, record }">
                <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                  <span class="cell-ellipsis">
                    {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                  </span>
                </a-tooltip>
              </template>
            </a-table>
          </a-card>
          <a-card size="small" title="登录日志" :bordered="false" class="log-section-card">
            <a-table :columns="loginLogTableColumns" :data-source="loginLogs" row-key="id" size="middle" :scroll="{ x: loginLogTableScrollX }">
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'status'">
                  <a-tag :color="record.status === 'success' ? 'green' : record.status === 'logout' ? 'blue' : 'red'">
                    {{ record.status === 'success' ? '成功' : record.status === 'logout' ? '退出' : '失败' }}
                  </a-tag>
                </template>
                <template v-else-if="column.dataIndex === 'ip'">
                  {{ maskIp(record.ip) }}
                </template>
                <template v-else-if="column.dataIndex === 'userAgent'">
                  {{ formatUserAgent(record.userAgent) }}
                </template>
                <template v-else-if="column.dataIndex === 'createdAt'">
                  {{ formatDisplayDate(record.createdAt) }}
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
        </div>
      </a-card>
    </div>

    <a-modal v-model:open="modalOpen" :title="modalTitle" width="720px" :mask-closable="false" :closable="!modalSaving" :keyboard="!modalSaving" :confirm-loading="modalSaving" :cancel-button-props="{ disabled: modalSaving }" ok-text="保存" cancel-text="取消" @ok="submitModal">
      <a-form :model="formModel" layout="vertical">
        <template v-if="modalType === 'user'">
          <a-row :gutter="12">
            <a-col v-if="!formModel.fromOrgAdd" :xs="24" :md="12">
              <a-form-item label="用户名" required>
                <a-input v-model:value="formModel.username" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="姓名" required>
                <a-input v-model:value="formModel.nickname" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="手机" required>
                <a-input v-model:value="formModel.mobile" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="邮箱">
                <a-input v-model:value="formModel.email" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="企业微信 UserID">
                <a-input v-model:value="formModel.wecomUserId" placeholder="通常由企业微信同步自动绑定" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="公司">
                <a-select v-model:value="formModel.companyId" :options="companyOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="部门" required>
                <a-select
                  v-model:value="formModel.deptId"
                  :options="deptOptions"
                  allow-clear
                  placeholder="请从组织架构选择部门"
                  @change="syncUserDepartment"
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="岗位">
                <a-select
                  v-model:value="formModel.postId"
                  :options="userPostOptions"
                  allow-clear
                  placeholder="请选择所属部门的岗位"
                  @change="syncUserPost"
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="上级">
                <a-select v-model:value="formModel.leaderId" allow-clear :options="userOptions" @change="syncLeaderName" />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="角色">
                <a-select v-model:value="formModel.roleIds" mode="multiple" :options="roleOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="状态">
                <a-radio-group v-model:value="formModel.status" :options="statusOptions" />
              </a-form-item>
            </a-col>
            <a-col v-if="!formModel.id" :xs="24" :md="12">
              <a-form-item label="初始密码">
                <a-input-password v-model:value="formModel.password" />
              </a-form-item>
            </a-col>
          </a-row>
        </template>

        <template v-else-if="modalType === 'org'">
          <a-row :gutter="12">
            <a-col :xs="24" :md="12">
              <a-form-item label="类型">
                <a-select v-model:value="formModel.type" :options="orgTypeOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="上级">
                <a-tree-select v-model:value="formModel.parentId" allow-clear :tree-data="orgTree" tree-node-label-prop="name" :field-names="{ label: 'name', value: 'id', children: 'children' }" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="名称" required>
                <a-input v-model:value="formModel.name" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="编码" required>
                <a-input v-model:value="formModel.code" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="负责人">
                <a-select v-model:value="formModel.leaderId" allow-clear :options="userOptions" @change="syncLeaderName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="排序">
                <business-input-number v-model:value="formModel.sortNo" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="备注">
                <a-textarea v-model:value="formModel.remark" :rows="3" />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="状态">
                <a-radio-group v-model:value="formModel.status" :options="statusOptions" />
              </a-form-item>
            </a-col>
          </a-row>
        </template>

        <template v-else-if="modalType === 'role'">
          <a-row :gutter="12">
            <a-col :span="24">
              <a-form-item label="角色模板" extra="选择模板后仍可继续调整权限">
                <a-select allow-clear placeholder="请选择角色模板" :options="roleTemplates" @change="applyRoleTemplate" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="角色名称" required>
                <a-input v-model:value="formModel.name" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="角色编码" required>
                <a-input v-model:value="formModel.code" />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="菜单权限">
                <a-tree v-model:checked-keys="formModel.menuPermissions" checkable default-expand-all :tree-data="menuPermissionTree" />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="按钮权限">
                <a-checkbox-group v-model:value="formModel.buttonPermissions" :options="buttonPermissionOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="数据权限">
                <a-select v-model:value="formModel.dataScope" :options="dataScopeOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="状态">
                <a-radio-group v-model:value="formModel.status" :options="statusOptions" />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="备注">
                <a-textarea v-model:value="formModel.remark" :rows="3" />
              </a-form-item>
            </a-col>
          </a-row>
        </template>

        <template v-else>
          <a-row :gutter="12">
            <a-col :xs="24" :md="12">
              <a-form-item label="字典类型">
                <a-select v-model:value="formModel.type" :options="dictionaryTypeSelectOptions" @change="syncDictTypeName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="类型名称">
                <a-input v-model:value="formModel.typeName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="标签" required>
                <a-input v-model:value="formModel.label" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="值" required>
                <a-input v-model:value="formModel.value" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="排序">
                <business-input-number v-model:value="formModel.sortNo" style="width: 100%" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="状态">
                <a-radio-group v-model:value="formModel.status" :options="statusOptions" />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="备注">
                <a-textarea v-model:value="formModel.remark" :rows="3" />
              </a-form-item>
            </a-col>
          </a-row>
        </template>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="passwordModalOpen"
      title="重置密码"
      width="440px"
      :mask-closable="false"
      :confirm-loading="passwordSubmitting"
      :closable="!passwordSubmitting"
      :keyboard="!passwordSubmitting"
      :cancel-button-props="{ disabled: passwordSubmitting }"
      :ok-button-props="{ disabled: !passwordFormValid }"
      ok-text="确认修改"
      cancel-text="取消"
      @ok="submitPasswordReset"
    >
      <a-form :model="passwordForm" layout="vertical">
        <a-alert
          :message="`正在为 ${passwordTarget?.nickname || '-'} 修改登录密码`"
          type="info"
          show-icon
          class="password-reset-alert"
        />
        <a-form-item label="新密码" required extra="6–64 个字符">
          <a-input-password
            v-model:value="passwordForm.password"
            :maxlength="64"
            autocomplete="new-password"
            placeholder="请输入新密码"
          />
        </a-form-item>
        <a-form-item
          label="确认新密码"
          required
          :validate-status="passwordForm.confirmPassword && passwordForm.password !== passwordForm.confirmPassword ? 'error' : undefined"
          :help="passwordForm.confirmPassword && passwordForm.password !== passwordForm.confirmPassword ? '两次输入的密码不一致' : undefined"
        >
          <a-input-password
            v-model:value="passwordForm.confirmPassword"
            :maxlength="64"
            autocomplete="new-password"
            placeholder="请再次输入新密码"
            @press-enter="submitPasswordReset"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.system-page {
  padding: 16px 0 0;
}

.password-reset-alert {
  margin-bottom: 16px;
}

.system-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding: 18px 20px;
  background: var(--admin-surface);
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  box-shadow: var(--admin-shadow-card);
}

.system-header h2 {
  margin: 0;
  color: var(--admin-text);
  font-size: 21px;
  font-weight: 650;
}

.system-header p {
  margin: 4px 0 0;
  color: var(--admin-muted);
}

.stat-row {
  margin-bottom: 16px;

  :deep(.ant-card) {
    height: 100%;
  }
}

.stat-value {
  color: var(--admin-text);
  font-size: 23px;
  font-weight: 650;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  margin-top: 6px;
  color: var(--admin-muted);
  font-size: 13px;
  font-weight: 500;
}

.system-section-stack,
.log-section-stack {
  display: grid;
  gap: 16px;
}

.system-section-card {
  :deep(.ant-card-head) {
    min-height: 48px;
  }
}

.user-org-layout {
  display: grid;
  grid-template-columns: minmax(210px, 250px) minmax(0, 1fr);
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
}

.user-org-panel {
  min-width: 0;
  padding: 12px;
  background: var(--admin-surface-muted);
  border-right: 1px solid var(--admin-border-subtle);
}

.user-org-panel__header,
.user-list-summary,
.user-org-tree-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.user-org-panel__header {
  min-height: 42px;
  padding: 0 4px 10px;
  border-bottom: 1px solid var(--admin-border-subtle);
}

.user-org-panel__header > div {
  display: grid;
  gap: 2px;
}

.user-org-panel__header strong,
.user-list-summary strong {
  color: var(--admin-text);
  font-weight: 650;
}

.user-org-panel__header span,
.user-list-summary {
  color: var(--admin-muted);
  font-size: 12px;
}

.user-org-panel :deep(.ant-tree) {
  margin-top: 8px;
  background: transparent;
}

.user-org-panel :deep(.ant-tree-node-content-wrapper) {
  min-width: 0;
}

.user-org-tree-title {
  width: 100%;
  min-width: 0;
}

.user-org-tree-title > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-org-tree-count {
  min-width: 22px;
  padding: 0 6px;
  color: var(--admin-text-secondary);
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  background: var(--admin-surface);
  border-radius: 10px;
}

.user-list-panel {
  min-width: 0;
}

.user-list-summary {
  min-height: 43px;
  padding: 0 12px;
  border-bottom: 1px solid var(--admin-border-subtle);
}

.log-section-card {
  background: #f8fafc;
}

.organization-sync-layout {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  min-height: 560px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  overflow: hidden;
}

.organization-sync-layout .user-org-panel {
  max-height: none;
  overflow: auto;
}

.organization-detail {
  min-width: 0;
  padding: 20px;
}

.organization-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.organization-detail__header h3,
.organization-detail__section h4 {
  margin: 0;
  color: var(--admin-text);
}

.organization-detail__header p {
  margin: 4px 0 0;
  color: var(--admin-muted);
  font-size: 13px;
}

.organization-detail__section {
  margin-top: 20px;
}

.organization-detail__section h4 {
  margin-bottom: 10px;
  font-size: 14px;
}

.organization-child-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.organization-child-item {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: 6px;
  background: #fff;
  color: var(--admin-text);
  cursor: pointer;
  text-align: left;
}

.organization-child-item:hover {
  border-color: #60a5fa;
  background: #eff6ff;
}

.organization-child-item span {
  color: var(--admin-muted);
  font-size: 12px;
}

.toolbar {
  width: 100%;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--admin-border-subtle);
}

.danger-link {
  color: var(--admin-danger);
}

@media (max-width: 640px) {
  .system-page {
    padding: 0;
  }

  .system-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .user-org-layout {
    grid-template-columns: 1fr;
  }

  .organization-sync-layout {
    grid-template-columns: 1fr;
  }

  .organization-detail {
    padding: 14px;
  }

  .organization-detail__header {
    flex-direction: column;
  }

  .organization-sync-layout .user-org-panel {
    border-right: 0;
    border-bottom: 1px solid var(--admin-border-subtle);
  }

  .user-org-panel {
    max-height: 260px;
    overflow: auto;
    border-right: 0;
    border-bottom: 1px solid var(--admin-border-subtle);
  }

  .toolbar {
    :deep(.ant-input-search),
    :deep(.ant-select),
    :deep(.ant-btn) {
      width: 100% !important;
    }
  }
}
</style>

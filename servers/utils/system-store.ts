import type mysql from 'mysql2/promise'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import { businessDictionaryDefaultKeySet, businessDictionaryDefaults } from '../../shared/business-dictionaries'
import { deleteDictionaryRecord, listDictionaryRecords, saveDictionaryRecord } from '../repositories/system/dictionary-repository'
import { deleteOrganizationRecord, listOrganizationRecords, saveOrganizationRecord } from '../repositories/system/organization-repository'
import { deleteRoleRecord, saveRoleRecord } from '../repositories/system/role-repository'
import { withOperator } from '../repositories/system/types'
import { changeUserStatus, deleteUserRecord, listUserRecords, resetUserCredential, toPublicUser } from '../repositories/system/user-repository'
import { resolveUserOrganizations } from '../services/system/user-organization-service'
import { resolveJsonDataFile } from './data-paths'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'
import { repairMojibake } from './text-repair'

export type SystemStatus = 'enabled' | 'disabled'
export type DataScope = 'all' | 'company' | 'department' | 'self'

export interface SystemUser {
  id: number
  username: string
  nickname: string
  mobile: string
  wecomUserId?: string
  wecomDepartmentId?: string
  email?: string
  companyId: string
  companyName: string
  deptId: string
  deptName: string
  postId: string
  postName: string
  leaderId?: number
  leaderName?: string
  roleIds: string[]
  roles: string[]
  status: SystemStatus
  passwordSalt: string
  passwordHash: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationNode {
  id: string
  parentId?: string
  type: 'company' | 'department' | 'post'
  name: string
  code: string
  leaderId?: number
  leaderName?: string
  sortNo: number
  status: SystemStatus
  remark?: string
}

export interface RoleRecord {
  id: string
  code: string
  name: string
  dataScope: DataScope
  menuPermissions: string[]
  buttonPermissions: string[]
  status: SystemStatus
  remark?: string
}

export interface DictionaryItem {
  id: string
  type: string
  typeName: string
  label: string
  value: string
  sortNo: number
  status: SystemStatus
  remark?: string
}

export interface LoginLog {
  id: string
  username: string
  nickname?: string
  ip: string
  userAgent?: string
  status: 'success' | 'failed' | 'logout'
  message: string
  createdAt: string
}

export interface OperationLog {
  id: string
  module: string
  action: 'create' | 'update' | 'delete' | 'approve' | 'export' | 'disable' | 'reset-password' | 'login' | 'logout'
  content: string
  operatorId?: number
  operatorName?: string
  targetId?: string | number
  createdAt: string
}

interface SystemState {
  users: SystemUser[]
  organizations: OrganizationNode[]
  roles: RoleRecord[]
  dictionaries: DictionaryItem[]
  loginLogs: LoginLog[]
  operationLogs: OperationLog[]
}

interface SessionRecord {
  token: string
  userId: number
  username: string
  user?: SystemUser
  createdAt: string
  expiresAt: number
}

interface DbSystemUserRow {
  id: number
  username: string
  nickname: string
  mobile: string | null
  wecom_user_id: string | null
  wecom_department_id: string | null
  email: string | null
  company_id: number | null
  company_name: string | null
  dept_id: number | null
  dept_name: string | null
  post_id: number | null
  post_name: string | null
  leader_user_id: number | null
  leader_name: string | null
  status: SystemStatus
  password_salt: string
  password_hash: string
  last_login_at: string | null
  created_at: string
  updated_at: string
  role_codes: string | null
  role_ids: string | null
}

interface DbOrganizationRow {
  id: number
  parent_id: number | null
  type: 'company' | 'department' | 'post'
  name: string
  code: string
  leader_user_id: number | null
  leader_name: string | null
  sort_no: number
  status: SystemStatus
}

interface DbRoleRow {
  id: number
  code: string
  name: string
  data_scope: DataScope
  status: SystemStatus
  remark: string | null
  menu_permissions: string | null
  button_permissions: string | null
}

interface DbDictionaryRow {
  id: number
  type: string
  type_name: string
  label: string
  value: string
  sort_no: number
  status: SystemStatus
  remark: string | null
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const dataFile = resolveJsonDataFile('system.json')
const globalStore = globalThis as any
const LEGACY_ADMIN_PASSWORD_HASH = '852c4d3cff346ac3987f0cd7994edbe850bec6e6091ecbe56b5aecd7645dd592'

function now() {
  return DATE_TIME_FORMAT.format(new Date()).replace(/\//g, '-')
}

function nextId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function hashPassword(password: string, salt: string) {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex')
}

function createPassword(password: string) {
  const salt = randomBytes(8).toString('hex')
  return {
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
  }
}

function withPassword(user: Omit<SystemUser, 'passwordSalt' | 'passwordHash'>, password: string): SystemUser {
  return {
    ...user,
    ...createPassword(password),
  }
}

const defaultState: SystemState = {
  organizations: [
    { id: 'company-main', type: 'company', name: '青海诚捷运输有限公司', code: 'COMP001', leaderId: 1, leaderName: '超级管理员', sortNo: 1, status: 'enabled' },
    { id: 'management', parentId: 'company-main', type: 'department', name: '总经办', code: 'DEPT001', leaderId: 5, leaderName: '总经理', sortNo: 10, status: 'enabled' },
    { id: 'finance', parentId: 'management', type: 'department', name: '人事财务部', code: 'DEPT002', leaderId: 3, leaderName: '财务经理', sortNo: 20, status: 'enabled' },
    { id: 'transport', parentId: 'management', type: 'department', name: '运输管理部', code: 'DEPT003', leaderId: 4, leaderName: '部门负责人', sortNo: 30, status: 'enabled' },
    { id: 'admin', parentId: 'management', type: 'department', name: '酒店管理部', code: 'DEPT004', leaderId: 1, leaderName: '超级管理员', sortNo: 40, status: 'enabled' },
    { id: 'post-admin', parentId: 'admin', type: 'post', name: '酒店岗位', code: 'POST001', sortNo: 1, status: 'enabled' },
    { id: 'post-finance', parentId: 'finance', type: 'post', name: '财务会计', code: 'POST002', sortNo: 2, status: 'enabled' },
    { id: 'post-approver', parentId: 'transport', type: 'post', name: '审批负责人', code: 'POST003', sortNo: 3, status: 'enabled' },
    { id: 'post-driver', parentId: 'transport', type: 'post', name: '驾驶员', code: 'POST004', sortNo: 4, status: 'enabled' },
  ],
  roles: [
    { id: 'role-admin', code: 'ADMIN', name: '管理员', dataScope: 'all', menuPermissions: ['*'], buttonPermissions: ['*'], status: 'enabled', remark: '拥有全部菜单、按钮和数据权限' },
    { id: 'role-user', code: 'USER', name: '普通员工', dataScope: 'self', menuPermissions: ['/dashboard/workplace', '/oa-approval/center', '/transport/orders'], buttonPermissions: ['view', 'create'], status: 'enabled' },
    { id: 'role-finance', code: 'FINANCE_MANAGER', name: '财务', dataScope: 'company', menuPermissions: ['/transport/fees', '/oa-approval/center'], buttonPermissions: ['view', 'create', 'update', 'export', 'approve'], status: 'enabled' },
    { id: 'role-approver', code: 'APPROVER', name: '审批人', dataScope: 'department', menuPermissions: ['/oa-approval/center', '/oa-approval/vehicle'], buttonPermissions: ['view', 'approve', 'reject'], status: 'enabled' },
    { id: 'role-leader', code: 'DEPT_LEADER', name: '部门负责人', dataScope: 'department', menuPermissions: ['/dashboard/workplace', '/oa-approval/center', '/transport'], buttonPermissions: ['view', 'create', 'update', 'approve', 'export'], status: 'enabled' },
  ],
  users: [
    withPassword({ id: 1, username: 'admin', nickname: '超级管理员', mobile: '13800000001', email: 'admin@example.com', companyId: 'company-main', companyName: '青海诚捷运输有限公司', deptId: 'admin', deptName: '酒店管理部', postId: 'post-admin', postName: '酒店岗位', roleIds: ['role-admin'], roles: ['ADMIN'], status: 'enabled', createdAt: '2026-07-01 09:00:00', updatedAt: '2026-07-01 09:00:00' }, 'admin'),
    withPassword({ id: 2, username: 'user', nickname: '普通用户', mobile: '13800000002', email: 'user@example.com', companyId: 'company-main', companyName: '青海诚捷运输有限公司', deptId: 'transport', deptName: '运输管理部', postId: 'post-driver', postName: '驾驶员', leaderId: 4, leaderName: '部门负责人', roleIds: ['role-user'], roles: ['USER'], status: 'enabled', createdAt: '2026-07-01 09:10:00', updatedAt: '2026-07-01 09:10:00' }, 'user'),
    withPassword({ id: 3, username: 'finance_manager', nickname: '财务经理', mobile: '13800000003', email: 'finance@example.com', companyId: 'company-main', companyName: '青海诚捷运输有限公司', deptId: 'finance', deptName: '人事财务部', postId: 'post-finance', postName: '财务会计', leaderId: 5, leaderName: '总经理', roleIds: ['role-finance'], roles: ['FINANCE_MANAGER'], status: 'enabled', createdAt: '2026-07-01 09:20:00', updatedAt: '2026-07-01 09:20:00' }, 'finance123'),
    withPassword({ id: 4, username: 'dept_leader', nickname: '部门负责人', mobile: '13800000004', email: 'leader@example.com', companyId: 'company-main', companyName: '青海诚捷运输有限公司', deptId: 'transport', deptName: '运输管理部', postId: 'post-approver', postName: '审批负责人', leaderId: 5, leaderName: '总经理', roleIds: ['role-leader', 'role-approver'], roles: ['DEPT_LEADER', 'APPROVER'], status: 'enabled', createdAt: '2026-07-01 09:30:00', updatedAt: '2026-07-01 09:30:00' }, 'leader123'),
    withPassword({ id: 5, username: 'general_manager', nickname: '总经理', mobile: '13800000005', email: 'gm@example.com', companyId: 'company-main', companyName: '青海诚捷运输有限公司', deptId: 'management', deptName: '总经办', postId: 'post-approver', postName: '审批负责人', roleIds: ['role-approver'], roles: ['APPROVER'], status: 'enabled', createdAt: '2026-07-01 09:40:00', updatedAt: '2026-07-01 09:40:00' }, 'gm123'),
  ],
  dictionaries: [
    { id: 'dict-fee-1', type: 'fee_type', typeName: '费用类型', label: '保险费', value: 'insurance', sortNo: 1, status: 'enabled' },
    { id: 'dict-fee-2', type: 'fee_type', typeName: '费用类型', label: '年审费', value: 'annual_check', sortNo: 2, status: 'enabled' },
    { id: 'dict-approval-1', type: 'approval_status', typeName: '审批状态', label: '草稿', value: 'draft', sortNo: 1, status: 'enabled' },
    { id: 'dict-approval-2', type: 'approval_status', typeName: '审批状态', label: '审批中', value: 'approving', sortNo: 2, status: 'enabled' },
    { id: 'dict-approval-3', type: 'approval_status', typeName: '审批状态', label: '已通过', value: 'approved', sortNo: 3, status: 'enabled' },
    { id: 'dict-vehicle-1', type: 'vehicle_status', typeName: '车辆状态', label: '正常', value: 'normal', sortNo: 1, status: 'enabled' },
    { id: 'dict-vehicle-2', type: 'vehicle_status', typeName: '车辆状态', label: '维修中', value: 'repairing', sortNo: 2, status: 'enabled' },
    { id: 'dict-license-1', type: 'license_type', typeName: '证照类型', label: '行驶证', value: 'driving_permit', sortNo: 1, status: 'enabled' },
    { id: 'dict-license-2', type: 'license_type', typeName: '证照类型', label: '营运证', value: 'transport_permit', sortNo: 2, status: 'enabled' },
    { id: 'dict-pay-1', type: 'payment_method', typeName: '支付方式', label: '银行转账', value: 'bank_transfer', sortNo: 1, status: 'enabled' },
    { id: 'dict-pay-2', type: 'payment_method', typeName: '支付方式', label: '现金', value: 'cash', sortNo: 2, status: 'enabled' },
  ],
  loginLogs: [],
  operationLogs: [],
}

const emptyState: SystemState = {
  users: [],
  organizations: [],
  roles: [],
  dictionaries: [],
  loginLogs: [],
  operationLogs: [],
}

function readDataFile() {
  if (isDatabaseRequired())
    return undefined
  if (!existsSync(dataFile))
    return undefined
  try {
    return JSON.parse(readFileSync(dataFile, 'utf-8')) as SystemState
  }
  catch {
    return undefined
  }
}

function ensureState(): SystemState {
  if (!globalStore.__systemMockState)
    globalStore.__systemMockState = readDataFile() ?? (isDatabaseRequired() ? emptyState : defaultState)
  if (!globalStore.__systemMockSessions)
    globalStore.__systemMockSessions = new Map<string, SessionRecord>()
  const state = globalStore.__systemMockState
  for (const item of businessDictionaryDefaults) {
    if (!state.dictionaries.some(existing => existing.type === item.type && existing.value === item.value)) {
      state.dictionaries.push({
        ...item,
        id: `business-${item.type}-${item.sortNo}`,
      })
    }
  }
  return state
}

function persist() {
  const state = ensureState()
  if (!getMysqlPool()) {
    mkdirSync(dirname(dataFile), { recursive: true })
    writeFileSync(dataFile, JSON.stringify(state, null, 2))
  }
}

const publicUser = toPublicUser

function reportAsyncSideEffect(name: string, error: unknown) {
  console.error(`[system-store] ${name} failed`, error)
}

function normalizeUserRoles(user: SystemUser) {
  const state = ensureState()
  const roles = state.roles.filter(role => user.roleIds.includes(role.id) && role.status === 'enabled')
  user.roles = roles.map(role => role.code)
}

function toDbDateTime(value?: string | null) {
  return value ? String(value).replace(/\//g, '-').trim() : undefined
}

function splitCsv(value?: string | null) {
  return String(value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function mapDbUser(row: DbSystemUserRow): SystemUser {
  return {
    id: row.id,
    username: row.username,
    nickname: String(repairMojibake(row.nickname)),
    mobile: row.mobile || '',
    wecomUserId: row.wecom_user_id || undefined,
    wecomDepartmentId: row.wecom_department_id || undefined,
    email: row.email || undefined,
    companyId: row.company_id ? String(row.company_id) : '',
    companyName: String(repairMojibake(row.company_name || '')),
    deptId: row.dept_id ? String(row.dept_id) : '',
    deptName: String(repairMojibake(row.dept_name || '')),
    postId: row.post_id ? String(row.post_id) : '',
    postName: String(repairMojibake(row.post_name || '')),
    leaderId: row.leader_user_id || undefined,
    leaderName: row.leader_name ? String(repairMojibake(row.leader_name)) : undefined,
    roleIds: splitCsv(row.role_ids),
    roles: splitCsv(row.role_codes),
    status: row.status,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    lastLoginAt: toDbDateTime(row.last_login_at),
    createdAt: toDbDateTime(row.created_at) || now(),
    updatedAt: toDbDateTime(row.updated_at) || now(),
  }
}

function mapDbOrganization(row: DbOrganizationRow): OrganizationNode {
  return {
    id: String(row.id),
    parentId: row.parent_id ? String(row.parent_id) : undefined,
    type: row.type,
    name: String(repairMojibake(row.name)),
    code: row.code,
    leaderId: row.leader_user_id || undefined,
    leaderName: row.leader_name ? String(repairMojibake(row.leader_name)) : undefined,
    sortNo: row.sort_no,
    status: row.status,
  }
}

function mapDbRole(row: DbRoleRow): RoleRecord {
  return {
    id: String(row.id),
    code: row.code,
    name: row.name,
    dataScope: row.data_scope,
    menuPermissions: splitCsv(row.menu_permissions),
    buttonPermissions: splitCsv(row.button_permissions),
    status: row.status,
    remark: row.remark || undefined,
  }
}

function mapDbDictionary(row: DbDictionaryRow): DictionaryItem {
  return {
    id: String(row.id),
    type: String(repairMojibake(row.type)),
    typeName: String(repairMojibake(row.type_name)),
    label: String(repairMojibake(row.label)),
    value: String(repairMojibake(row.value)),
    sortNo: row.sort_no,
    status: row.status,
    remark: row.remark ? String(repairMojibake(row.remark)) : undefined,
  }
}

async function listUsersFromDb(query: any = {}) {
  const db = getMysqlPool()
  if (!db)
    return undefined

  const keyword = String(query.keyword ?? '').trim().toLowerCase()
  const deptId = String(query.deptId ?? '')
  const status = String(query.status ?? '')
  const conditions = ['1=1']
  const params: any[] = []

  if (keyword) {
    conditions.push('(LOWER(u.username) LIKE ? OR LOWER(u.nickname) LIKE ? OR LOWER(IFNULL(u.mobile, "")) LIKE ? OR LOWER(IFNULL(d.name, "")) LIKE ? OR LOWER(IFNULL(p.name, "")) LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  if (deptId) {
    conditions.push('u.dept_id = ?')
    params.push(Number(deptId))
  }
  if (status) {
    conditions.push('u.status = ?')
    params.push(status)
  }

  const [rows] = await db.query<DbSystemUserRow[]>(`
    SELECT
      u.id,
      u.username,
      u.nickname,
      u.mobile,
      u.wecom_user_id,
      u.wecom_department_id,
      u.email,
      u.company_id,
      c.name AS company_name,
      u.dept_id,
      d.name AS dept_name,
      u.post_id,
      p.name AS post_name,
      u.leader_user_id,
      lu.nickname AS leader_name,
      u.status,
      u.password_salt,
      u.password_hash,
      u.last_login_at,
      u.created_at,
      u.updated_at,
      GROUP_CONCAT(DISTINCT r.code ORDER BY r.id SEPARATOR ',') AS role_codes,
      GROUP_CONCAT(DISTINCT CAST(r.id AS CHAR) ORDER BY r.id SEPARATOR ',') AS role_ids
    FROM sys_user u
    LEFT JOIN sys_company c ON c.id = u.company_id
    LEFT JOIN sys_department d ON d.id = u.dept_id
    LEFT JOIN sys_post p ON p.id = u.post_id
    LEFT JOIN sys_user lu ON lu.id = u.leader_user_id
    LEFT JOIN sys_user_role ur ON ur.user_id = u.id
    LEFT JOIN sys_role r ON r.id = ur.role_id AND r.status = 'enabled'
    WHERE ${conditions.join(' AND ')}
    GROUP BY u.id
    ORDER BY u.id DESC
  `, params)

  return rows.map(row => publicUser(mapDbUser(row)))
}

async function getUserByUsernameFromDb(username: string) {
  const db = getMysqlPool()
  if (!db)
    return undefined

  const [rows] = await db.query<DbSystemUserRow[]>(`
    SELECT
      u.id,
      u.username,
      u.nickname,
      u.mobile,
      u.wecom_user_id,
      u.wecom_department_id,
      u.email,
      u.company_id,
      c.name AS company_name,
      u.dept_id,
      d.name AS dept_name,
      u.post_id,
      p.name AS post_name,
      u.leader_user_id,
      lu.nickname AS leader_name,
      u.status,
      u.password_salt,
      u.password_hash,
      u.last_login_at,
      u.created_at,
      u.updated_at,
      GROUP_CONCAT(DISTINCT r.code ORDER BY r.id SEPARATOR ',') AS role_codes,
      GROUP_CONCAT(DISTINCT CAST(r.id AS CHAR) ORDER BY r.id SEPARATOR ',') AS role_ids
    FROM sys_user u
    LEFT JOIN sys_company c ON c.id = u.company_id
    LEFT JOIN sys_department d ON d.id = u.dept_id
    LEFT JOIN sys_post p ON p.id = u.post_id
    LEFT JOIN sys_user lu ON lu.id = u.leader_user_id
    LEFT JOIN sys_user_role ur ON ur.user_id = u.id
    LEFT JOIN sys_role r ON r.id = ur.role_id AND r.status = 'enabled'
    WHERE u.username = ?
    GROUP BY u.id
    LIMIT 1
  `, [username])

  if (username === 'admin' && (!rows[0] || rows[0].password_hash === LEGACY_ADMIN_PASSWORD_HASH)) {
    const password = String(process.env.ADMIN_INITIAL_PASSWORD || '')
    if (password.length < 12 || ['admin', '123456', 'password'].includes(password.toLowerCase()))
      throw new Error('管理员尚未安全初始化，请配置至少12位的 ADMIN_INITIAL_PASSWORD')
    const passwordData = createPassword(password)
    await withMysqlTransaction(db, async (connection) => {
      if (rows[0]) {
        await connection.execute('UPDATE sys_user SET password_salt = ?, password_hash = ?, updated_at = NOW() WHERE id = ?', [passwordData.passwordSalt, passwordData.passwordHash, rows[0].id])
      }
      else {
        await connection.execute(`
          INSERT INTO sys_user (username, nickname, mobile, email, password_salt, password_hash, company_id, dept_id, post_id, status, created_at, updated_at)
          VALUES ('admin', '超级管理员', NULL, NULL, ?, ?, 1, 4, 1, 'enabled', NOW(), NOW())
        `, [passwordData.passwordSalt, passwordData.passwordHash])
      }
      const [adminRows] = await connection.query<Array<{ id: number }>>('SELECT id FROM sys_user WHERE username = ? LIMIT 1', ['admin'])
      const [roleRows] = await connection.query<Array<{ id: number }>>('SELECT id FROM sys_role WHERE code = ? AND status = ? LIMIT 1', ['ADMIN', 'enabled'])
      if (!adminRows[0] || !roleRows[0])
        throw new Error('管理员或 ADMIN 角色初始化失败')
      await connection.execute('INSERT IGNORE INTO sys_user_role (user_id, role_id) VALUES (?, ?)', [adminRows[0].id, roleRows[0].id])
    })
    return getUserByUsernameFromDb(username)
  }

  return rows[0] ? mapDbUser(rows[0]) : undefined
}

async function loadUsersFromDb() {
  const db = getMysqlPool()
  if (!db)
    return undefined

  const [rows] = await db.query<DbSystemUserRow[]>(`
    SELECT
      u.id,
      u.username,
      u.nickname,
      u.mobile,
      u.wecom_user_id,
      u.wecom_department_id,
      u.email,
      u.company_id,
      c.name AS company_name,
      u.dept_id,
      d.name AS dept_name,
      u.post_id,
      p.name AS post_name,
      u.leader_user_id,
      lu.nickname AS leader_name,
      u.status,
      u.password_salt,
      u.password_hash,
      u.last_login_at,
      u.created_at,
      u.updated_at,
      GROUP_CONCAT(DISTINCT r.code ORDER BY r.id SEPARATOR ',') AS role_codes,
      GROUP_CONCAT(DISTINCT CAST(r.id AS CHAR) ORDER BY r.id SEPARATOR ',') AS role_ids
    FROM sys_user u
    LEFT JOIN sys_company c ON c.id = u.company_id
    LEFT JOIN sys_department d ON d.id = u.dept_id
    LEFT JOIN sys_post p ON p.id = u.post_id
    LEFT JOIN sys_user lu ON lu.id = u.leader_user_id
    LEFT JOIN sys_user_role ur ON ur.user_id = u.id
    LEFT JOIN sys_role r ON r.id = ur.role_id AND r.status = 'enabled'
    GROUP BY u.id
    ORDER BY u.id DESC
  `)

  return rows.map(mapDbUser)
}

async function listOrganizationsFromDb() {
  const db = getMysqlPool()
  if (!db)
    return undefined

  const [companyRows] = await db.query<DbOrganizationRow[]>(`
    SELECT c.id, NULL AS parent_id, 'company' AS type, c.name, c.code, NULL AS leader_user_id, NULL AS leader_name, 0 AS sort_no, c.status
    FROM sys_company c
    ORDER BY c.id ASC
  `)
  const [deptRows] = await db.query<DbOrganizationRow[]>(`
    SELECT d.id, COALESCE(d.parent_id, d.company_id) AS parent_id, 'department' AS type, d.name, d.code, d.leader_user_id, u.nickname AS leader_name, d.sort_no, d.status
    FROM sys_department d
    LEFT JOIN sys_user u ON u.id = d.leader_user_id
    ORDER BY d.sort_no ASC, d.id ASC
  `)
  const [postRows] = await db.query<DbOrganizationRow[]>(`
    SELECT p.id, p.dept_id AS parent_id, 'post' AS type, p.name, p.code, NULL AS leader_user_id, NULL AS leader_name, p.sort_no, p.status
    FROM sys_post p
    ORDER BY p.sort_no ASC, p.id ASC
  `)

  return [...companyRows, ...deptRows, ...postRows].map(mapDbOrganization).sort((a, b) => a.sortNo - b.sortNo)
}

async function listRolesFromDb() {
  const db = getMysqlPool()
  if (!db)
    return undefined

  const [rows] = await db.query<DbRoleRow[]>(`
    SELECT
      r.id,
      r.code,
      r.name,
      r.data_scope,
      r.status,
      r.remark,
      GROUP_CONCAT(DISTINCT m.path ORDER BY m.id SEPARATOR ',') AS menu_permissions,
      GROUP_CONCAT(DISTINCT rb.button_code ORDER BY rb.button_code SEPARATOR ',') AS button_permissions
    FROM sys_role r
    LEFT JOIN sys_role_menu rm ON rm.role_id = r.id
    LEFT JOIN sys_menu m ON m.id = rm.menu_id
    LEFT JOIN sys_role_button rb ON rb.role_id = r.id
    GROUP BY r.id
    ORDER BY r.id ASC
  `)

  return rows.map(mapDbRole)
}

async function listDictionariesFromDb(query: any = {}) {
  const db = getMysqlPool()
  if (!db)
    return undefined

  await ensureBusinessDictionariesInDb(db)

  const type = String(query.type ?? '')
  const conditions = ['1=1']
  const params: any[] = []
  if (type) {
    conditions.push('type = ?')
    params.push(type)
  }

  const [rows] = await db.query<DbDictionaryRow[]>(`
    SELECT id, type, type_name, label, value, sort_no, status, remark
    FROM sys_dict
    WHERE ${conditions.join(' AND ')}
    ORDER BY sort_no ASC, id ASC
  `, params)

  return rows.map(mapDbDictionary)
}

let seededBusinessDictionaryDb: mysql.Pool | undefined

async function ensureBusinessDictionariesInDb(db: mysql.Pool) {
  if (seededBusinessDictionaryDb === db)
    return
  const placeholders = businessDictionaryDefaults.map(() => '(?, ?, ?, ?, ?, ?, ?, NOW(), NOW())').join(', ')
  const params = businessDictionaryDefaults.flatMap(item => [item.type, item.typeName, item.label, item.value, item.sortNo, item.status, item.remark])
  await db.execute(`
    INSERT IGNORE INTO sys_dict (type, type_name, label, value, sort_no, status, remark, created_at, updated_at)
    VALUES ${placeholders}
  `, params)
  seededBusinessDictionaryDb = db
}

async function hydrateSystemStateFromDb() {
  const db = getMysqlPool()
  if (!db)
    return ensureState()

  const state = ensureState()
  const [users, organizations, roles, dictionaries] = await Promise.all([
    loadUsersFromDb(),
    listOrganizationsFromDb(),
    listRolesFromDb(),
    listDictionariesFromDb(),
  ])

  if (users)
    state.users = users
  if (organizations)
    state.organizations = organizations
  if (roles)
    state.roles = roles
  if (dictionaries)
    state.dictionaries = dictionaries
  return state
}

async function saveUserToDb(payload: Partial<SystemUser> & { password?: string }) {
  const db = getMysqlPool()
  if (!db)
    return undefined

  const userId = payload.id ? Number(payload.id) : undefined
  const passwordData = payload.password ? createPassword(payload.password) : undefined

  if (userId) {
    return withMysqlTransaction(db, async (connection) => {
      await connection.execute(
        `UPDATE sys_user
       SET username = ?, nickname = ?, mobile = ?, email = ?, wecom_user_id = ?, wecom_department_id = ?, company_id = ?, dept_id = ?, post_id = ?, leader_user_id = ?, status = ?,
           password_salt = COALESCE(?, password_salt), password_hash = COALESCE(?, password_hash), updated_at = NOW()
       WHERE id = ?`,
        [
          String(payload.username ?? ''),
          String(payload.nickname ?? ''),
          String(payload.mobile ?? ''),
          payload.email || null,
          payload.wecomUserId || null,
          payload.wecomDepartmentId || null,
          payload.companyId ? Number(payload.companyId) : null,
          payload.deptId ? Number(payload.deptId) : null,
          payload.postId ? Number(payload.postId) : null,
          payload.leaderId || null,
          payload.status ?? 'enabled',
          passwordData?.passwordSalt || null,
          passwordData?.passwordHash || null,
          userId,
        ],
      )
      await connection.execute('DELETE FROM sys_user_role WHERE user_id = ?', [userId])
      for (const roleId of payload.roleIds ?? [])
        await connection.execute('INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)', [userId, Number(roleId)])
      return userId
    })
  }

  const newPasswordData = passwordData || createPassword('123456')
  return withMysqlTransaction(db, async (connection) => {
    const [result] = await connection.execute<mysql.ResultSetHeader>(
      `INSERT INTO sys_user (username, nickname, mobile, email, wecom_user_id, wecom_department_id, password_salt, password_hash, company_id, dept_id, post_id, leader_user_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        String(payload.username ?? ''),
        String(payload.nickname ?? ''),
        String(payload.mobile ?? ''),
        payload.email || null,
        payload.wecomUserId || null,
        payload.wecomDepartmentId || null,
        newPasswordData.passwordSalt,
        newPasswordData.passwordHash,
        payload.companyId ? Number(payload.companyId) : null,
        payload.deptId ? Number(payload.deptId) : null,
        payload.postId ? Number(payload.postId) : null,
        payload.leaderId || null,
        payload.status ?? 'enabled',
      ],
    )
    const insertedId = Number(result.insertId)
    for (const roleId of payload.roleIds ?? [])
      await connection.execute('INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)', [insertedId, Number(roleId)])
    return insertedId
  })
}

async function saveOrganizationToDb(payload: Partial<OrganizationNode>) {
  const db = getMysqlPool()
  if (!db)
    return undefined

  const numericId = payload.id ? Number(payload.id) : undefined
  if (payload.type === 'company') {
    if (numericId) {
      await db.execute('UPDATE sys_company SET code = ?, name = ?, status = ?, updated_at = NOW() WHERE id = ?', [String(payload.code ?? ''), String(payload.name ?? ''), payload.status ?? 'enabled', numericId])
      return numericId
    }
    const [result] = await db.execute<mysql.ResultSetHeader>('INSERT INTO sys_company (code, name, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [String(payload.code ?? ''), String(payload.name ?? ''), payload.status ?? 'enabled'])
    return Number(result.insertId)
  }

  if (payload.type === 'post') {
    if (numericId) {
      await db.execute('UPDATE sys_post SET dept_id = ?, code = ?, name = ?, sort_no = ?, status = ?, updated_at = NOW() WHERE id = ?', [payload.parentId ? Number(payload.parentId) : 0, String(payload.code ?? ''), String(payload.name ?? ''), Number(payload.sortNo ?? 0), payload.status ?? 'enabled', numericId])
      return numericId
    }
    const [result] = await db.execute<mysql.ResultSetHeader>('INSERT INTO sys_post (dept_id, code, name, sort_no, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())', [payload.parentId ? Number(payload.parentId) : 0, String(payload.code ?? ''), String(payload.name ?? ''), Number(payload.sortNo ?? 0), payload.status ?? 'enabled'])
    return Number(result.insertId)
  }

  if (numericId) {
    await db.execute('UPDATE sys_department SET parent_id = ?, code = ?, name = ?, leader_user_id = ?, sort_no = ?, status = ?, updated_at = NOW() WHERE id = ?', [payload.parentId ? Number(payload.parentId) : null, String(payload.code ?? ''), String(payload.name ?? ''), payload.leaderId || null, Number(payload.sortNo ?? 0), payload.status ?? 'enabled', numericId])
    return numericId
  }
  const [result] = await db.execute<mysql.ResultSetHeader>('INSERT INTO sys_department (company_id, parent_id, code, name, leader_user_id, sort_no, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())', [1, payload.parentId ? Number(payload.parentId) : null, String(payload.code ?? ''), String(payload.name ?? ''), payload.leaderId || null, Number(payload.sortNo ?? 0), payload.status ?? 'enabled'])
  return Number(result.insertId)
}

async function deleteOrganizationFromDb(id: string) {
  const db = getMysqlPool()
  if (!db)
    return false
  const numericId = Number(id)
  if (!numericId)
    return false
  await withMysqlTransaction(db, async (connection) => {
    await connection.execute('DELETE FROM sys_post WHERE id = ?', [numericId])
    await connection.execute('DELETE FROM sys_department WHERE id = ?', [numericId])
    await connection.execute('DELETE FROM sys_company WHERE id = ?', [numericId])
  })
  return true
}

async function saveRoleToDb(payload: Partial<RoleRecord>) {
  const db = getMysqlPool()
  if (!db)
    return undefined
  return withMysqlTransaction(db, async (connection) => {
    let roleId = payload.id ? Number(payload.id) : undefined
    if (roleId) {
      await connection.execute('UPDATE sys_role SET code = ?, name = ?, data_scope = ?, status = ?, remark = ?, updated_at = NOW() WHERE id = ?', [String(payload.code ?? ''), String(payload.name ?? ''), payload.dataScope ?? 'self', payload.status ?? 'enabled', payload.remark || null, roleId])
      await connection.execute('DELETE FROM sys_role_menu WHERE role_id = ?', [roleId])
      await connection.execute('DELETE FROM sys_role_button WHERE role_id = ?', [roleId])
    }
    else {
      const [result] = await connection.execute<mysql.ResultSetHeader>('INSERT INTO sys_role (code, name, data_scope, status, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())', [String(payload.code ?? ''), String(payload.name ?? ''), payload.dataScope ?? 'self', payload.status ?? 'enabled', payload.remark || null])
      roleId = Number(result.insertId)
    }
    for (const path of payload.menuPermissions ?? []) {
      const [rows] = await connection.query<Array<{ id: number }>>('SELECT id FROM sys_menu WHERE path = ? LIMIT 1', [path])
      if (rows[0])
        await connection.execute('INSERT INTO sys_role_menu (role_id, menu_id) VALUES (?, ?)', [roleId, rows[0].id])
    }
    for (const buttonCode of payload.buttonPermissions ?? [])
      await connection.execute('INSERT INTO sys_role_button (role_id, button_code) VALUES (?, ?)', [roleId, buttonCode])
    return roleId
  })
}

async function deleteRoleFromDb(id: string) {
  const db = getMysqlPool()
  if (!db)
    return false
  const numericId = Number(id)
  if (!numericId)
    return false
  await withMysqlTransaction(db, async (connection) => {
    await connection.execute('DELETE FROM sys_user_role WHERE role_id = ?', [numericId])
    await connection.execute('DELETE FROM sys_role_menu WHERE role_id = ?', [numericId])
    await connection.execute('DELETE FROM sys_role_button WHERE role_id = ?', [numericId])
    await connection.execute('DELETE FROM sys_role WHERE id = ?', [numericId])
  })
  return true
}

async function saveDictionaryToDb(payload: Partial<DictionaryItem>) {
  const db = getMysqlPool()
  if (!db)
    return undefined
  const numericId = payload.id ? Number(payload.id) : undefined
  if (numericId) {
    await db.execute('UPDATE sys_dict SET type = ?, type_name = ?, label = ?, value = ?, sort_no = ?, status = ?, remark = ?, updated_at = NOW() WHERE id = ?', [String(payload.type ?? ''), String(payload.typeName ?? ''), String(payload.label ?? ''), String(payload.value ?? ''), Number(payload.sortNo ?? 0), payload.status ?? 'enabled', payload.remark || null, numericId])
    return numericId
  }
  const [result] = await db.execute<mysql.ResultSetHeader>('INSERT INTO sys_dict (type, type_name, label, value, sort_no, status, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())', [String(payload.type ?? ''), String(payload.typeName ?? ''), String(payload.label ?? ''), String(payload.value ?? ''), Number(payload.sortNo ?? 0), payload.status ?? 'enabled', payload.remark || null])
  return Number(result.insertId)
}

async function deleteDictionaryFromDb(id: string) {
  const db = getMysqlPool()
  if (!db)
    return false
  const numericId = Number(id)
  if (!numericId)
    return false
  await db.execute('DELETE FROM sys_dict WHERE id = ?', [numericId])
  return true
}

async function updateUserLastLoginToDb(userId: number, value: string) {
  const db = getMysqlPool()
  if (!db)
    return
  await db.execute('UPDATE sys_user SET last_login_at = ?, updated_at = NOW() WHERE id = ?', [value, userId])
}

async function insertLoginLogToDb(payload: LoginLog) {
  const db = getMysqlPool()
  if (!db)
    return
  await db.execute(`
    INSERT INTO sys_login_log (username, nickname, ip, user_agent, status, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [payload.username, payload.nickname || null, payload.ip || null, payload.userAgent || null, payload.status, payload.message || null, payload.createdAt])
}

async function insertOperationLogToDb(payload: OperationLog) {
  const db = getMysqlPool()
  if (!db)
    return
  await db.execute(`
    INSERT INTO sys_operation_log (module, action, content, operator_id, operator_name, target_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    payload.module,
    payload.action,
    payload.content,
    payload.operatorId || null,
    payload.operatorName || null,
    payload.targetId == null ? null : String(payload.targetId),
    payload.createdAt,
  ])
}

function currentOperator(token?: string) {
  // systemStore owns token lookup; this helper is only called after the store object is initialized.
  // eslint-disable-next-line ts/no-use-before-define
  return token ? systemStore.getUserByToken(token) : undefined
}

export const systemStore = {
  now,
  hashPassword,
  async listUsers(query: any = {}) {
    const dbUsers = await listUsersFromDb(query)
    if (dbUsers)
      return dbUsers

    return listUserRecords(ensureState().users, query)
  },
  async getUserByUsername(username: string) {
    const dbUser = await getUserByUsernameFromDb(username)
    if (dbUser || isDatabaseRequired())
      return dbUser

    return ensureState().users.find(item => item.username === username)
  },
  getUserByToken(token?: string | null) {
    if (!token)
      return undefined
    const sessions = globalStore.__systemMockSessions as Map<string, SessionRecord> | undefined
    const session = sessions?.get(token)
    if (session && session.expiresAt > Date.now())
      return session.user || (isDatabaseRequired() ? undefined : ensureState().users.find(item => item.id === session.userId))
    if (session)
      sessions?.delete(token)
    return undefined
  },
  async validateLogin(username: string, password: string, meta: { ip?: string, userAgent?: string }) {
    const user = await this.getUserByUsername(username)
    if (!user) {
      this.addLoginLog({ username, ip: meta.ip, userAgent: meta.userAgent, status: 'failed', message: '用户不存在' })
      return { ok: false, message: '用户名或密码错误' }
    }
    if (user.status === 'disabled') {
      this.addLoginLog({ username, nickname: user.nickname, ip: meta.ip, userAgent: meta.userAgent, status: 'failed', message: '用户已禁用' })
      return { ok: false, message: '用户已禁用' }
    }
    if (hashPassword(password, user.passwordSalt) !== user.passwordHash) {
      this.addLoginLog({ username, nickname: user.nickname, ip: meta.ip, userAgent: meta.userAgent, status: 'failed', message: '密码错误' })
      return { ok: false, message: '用户名或密码错误' }
    }
    const token = randomBytes(24).toString('hex')
    const sessions = globalStore.__systemMockSessions as Map<string, SessionRecord>
    sessions.set(token, { token, userId: user.id, username: user.username, user, createdAt: now(), expiresAt: Date.now() + 8 * 60 * 60 * 1000 })
    user.lastLoginAt = now()
    user.updatedAt = now()
    try {
      await updateUserLastLoginToDb(user.id, user.lastLoginAt)
    }
    catch (error) {
      reportAsyncSideEffect('update last login', error)
    }
    this.addLoginLog({ username, nickname: user.nickname, ip: meta.ip, userAgent: meta.userAgent, status: 'success', message: '登录成功' })
    this.addOperationLog({ module: '登录安全', action: 'login', content: `${user.nickname} 登录系统`, operatorId: user.id, operatorName: user.nickname })
    persist()
    return { ok: true, token, user: publicUser(user) }
  },
  logout(token?: string | null, meta: { ip?: string, userAgent?: string } = {}) {
    const user = this.getUserByToken(token)
    const sessions = globalStore.__systemMockSessions as Map<string, SessionRecord> | undefined
    if (token)
      sessions?.delete(token)
    if (user) {
      this.addLoginLog({ username: user.username, nickname: user.nickname, ip: meta.ip, userAgent: meta.userAgent, status: 'logout', message: '退出登录' })
      this.addOperationLog({ module: '登录安全', action: 'logout', content: `${user.nickname} 退出系统`, operatorId: user.id, operatorName: user.nickname })
      persist()
    }
  },
  async saveUser(payload: Partial<SystemUser> & { password?: string }, token?: string) {
    const state = await hydrateSystemStateFromDb()
    const operator = currentOperator(token)
    let user = payload.id ? state.users.find(item => item.id === Number(payload.id)) : undefined
    if (payload.id && !user)
      throw new Error('用户不存在')
    const username = String(payload.username ?? user?.username ?? '').trim()
    if (!username)
      throw new Error('用户名不能为空')
    if (state.users.some(item => item.id !== user?.id && item.username === username))
      throw new Error('用户名已存在')
    const time = now()
    const { company, dept, post } = await resolveUserOrganizations(state, payload, {
      nextId: type => nextId(type),
      saveOrganization: saveOrganizationToDb,
      recordOperation: operation => this.addOperationLog(withOperator(operation, operator)),
    })
    if (!user) {
      const password = payload.password || '123456'
      user = withPassword({
        id: Math.max(0, ...state.users.map(item => item.id)) + 1,
        username,
        nickname: String(payload.nickname ?? ''),
        mobile: String(payload.mobile ?? ''),
        wecomUserId: payload.wecomUserId,
        wecomDepartmentId: payload.wecomDepartmentId,
        email: payload.email,
        companyId: String(company?.id ?? ''),
        companyName: String(company?.name ?? ''),
        deptId: String(dept?.id ?? ''),
        deptName: String(dept?.name ?? ''),
        postId: String(post?.id ?? ''),
        postName: String(post?.name ?? ''),
        leaderId: payload.leaderId,
        leaderName: payload.leaderName,
        roleIds: payload.roleIds ?? [],
        roles: [],
        status: payload.status ?? 'enabled',
        createdAt: time,
        updatedAt: time,
      }, password)
      normalizeUserRoles(user)
      state.users.unshift(user)
      this.addOperationLog({ module: '用户管理', action: 'create', content: `新增用户 ${user.nickname}`, operatorId: operator?.id, operatorName: operator?.nickname, targetId: user.id })
    }
    else {
      const updatesPostAssignment = Object.prototype.hasOwnProperty.call(payload, 'postId')
        || Object.prototype.hasOwnProperty.call(payload, 'postName')
      Object.assign(user, payload, {
        username,
        companyId: String(company?.id ?? user.companyId),
        companyName: String(company?.name ?? user.companyName),
        deptId: String(dept?.id ?? user.deptId),
        deptName: String(dept?.name ?? user.deptName),
        postId: updatesPostAssignment ? String(post?.id ?? '') : user.postId,
        postName: updatesPostAssignment ? String(post?.name ?? '') : user.postName,
        updatedAt: time,
      })
      normalizeUserRoles(user)
      this.addOperationLog({ module: '用户管理', action: 'update', content: `编辑用户 ${user.nickname}`, operatorId: operator?.id, operatorName: operator?.nickname, targetId: user.id })
    }
    // A locally assigned id is only for the JSON backend. Passing it to the
    // MySQL adapter would turn a create into an UPDATE against a missing row.
    const dbUserId = await saveUserToDb({
      ...user,
      id: payload.id ? user.id : undefined,
      password: payload.password,
    })
    if (dbUserId && !payload.id)
      user.id = dbUserId
    persist()
    return publicUser(user)
  },
  async bindWecomIdentity(input: {
    wecomUserId: string
    mobile?: string
    nickname?: string
    wecomDepartmentId?: string
    deptName?: string
  }) {
    const state = await hydrateSystemStateFromDb()
    const wecomUserId = String(input.wecomUserId || '').trim()
    if (!wecomUserId)
      throw new Error('企业微信 UserID 不能为空')

    const mobile = String(input.mobile || '').replace(/\D/g, '')
    const user = state.users.find(item => item.wecomUserId === wecomUserId)
      || (mobile ? state.users.find(item => String(item.mobile || '').replace(/\D/g, '') === mobile) : undefined)
    if (!user) {
      const userRole = state.roles.find(item => item.code === 'USER' && item.status === 'enabled')
      const username = `wecom_${createHash('sha1').update(wecomUserId).digest('hex').slice(0, 16)}`
      return await this.saveUser({
        username,
        nickname: String(input.nickname || wecomUserId),
        mobile,
        wecomUserId,
        wecomDepartmentId: String(input.wecomDepartmentId || ''),
        deptName: String(input.deptName || '待匹配部门'),
        roleIds: userRole ? [userRole.id] : [],
        status: 'enabled',
        password: randomBytes(24).toString('base64url'),
      })
    }

    const duplicate = state.users.find(item => item.id !== user.id && item.wecomUserId === wecomUserId)
    if (duplicate)
      throw new Error(`企业微信账号已绑定系统用户 ${duplicate.nickname}`)

    const deptName = String(input.deptName || '').trim()
    const department = deptName
      ? state.organizations.find(item => item.type === 'department' && item.name === deptName && item.status === 'enabled')
      : undefined
    return await this.saveUser({
      ...user,
      nickname: String(input.nickname || user.nickname),
      mobile: mobile || user.mobile,
      wecomUserId,
      wecomDepartmentId: String(input.wecomDepartmentId || ''),
      deptId: department?.id,
      deptName: deptName || user.deptName,
    })
  },
  async disableUser(id: number, status: SystemStatus, token?: string) {
    const state = await hydrateSystemStateFromDb()
    const operator = currentOperator(token)
    const { user, operation } = changeUserStatus(state.users, id, status, now())
    this.addOperationLog(withOperator(operation, operator))
    await saveUserToDb(user)
    persist()
    return publicUser(user)
  },
  async resetPassword(id: number, password: string, token?: string) {
    const state = await hydrateSystemStateFromDb()
    const operator = currentOperator(token)
    const { user, operation } = resetUserCredential(state.users, id, password, now(), createPassword)
    this.addOperationLog(withOperator(operation, operator))
    await saveUserToDb({ ...user, password })
    persist()
    return true
  },
  async deleteUser(id: number, token?: string) {
    const state = await hydrateSystemStateFromDb()
    const operator = currentOperator(token)
    const { operation } = deleteUserRecord(state.users, id)
    this.addOperationLog(withOperator(operation, operator))
    const db = getMysqlPool()
    if (db) {
      await withMysqlTransaction(db, async (connection) => {
        await connection.execute('DELETE FROM sys_user_role WHERE user_id = ?', [id])
        await connection.execute('DELETE FROM sys_user WHERE id = ?', [id])
      })
    }
    persist()
  },
  async listOrganizations() {
    const dbOrganizations = await listOrganizationsFromDb()
    if (dbOrganizations)
      return dbOrganizations

    return listOrganizationRecords(ensureState().organizations)
  },
  async saveOrganization(payload: Partial<OrganizationNode>, token?: string) {
    const state = await hydrateSystemStateFromDb()
    const operator = currentOperator(token)
    const { item, operation } = saveOrganizationRecord(state.organizations, payload, type => nextId(type))
    this.addOperationLog(withOperator(operation, operator))
    const dbId = await saveOrganizationToDb(item)
    if (dbId)
      item.id = String(dbId)
    persist()
    return item
  },
  async deleteOrganization(id: string, token?: string) {
    const state = await hydrateSystemStateFromDb()
    const operator = currentOperator(token)
    const { operation } = deleteOrganizationRecord(state.organizations, id)
    this.addOperationLog(withOperator(operation, operator))
    await deleteOrganizationFromDb(id)
    persist()
  },
  async listRoles() {
    const dbRoles = await listRolesFromDb()
    if (dbRoles)
      return dbRoles

    return ensureState().roles
  },
  async saveRole(payload: Partial<RoleRecord>, token?: string) {
    const state = await hydrateSystemStateFromDb()
    const operator = currentOperator(token)
    const { role, operation } = saveRoleRecord(state.roles, state.users, payload, () => nextId('role'))
    this.addOperationLog(withOperator(operation, operator))
    const dbId = await saveRoleToDb(role)
    if (dbId)
      role.id = String(dbId)
    persist()
    return role
  },
  async deleteRole(id: string, token?: string) {
    const state = await hydrateSystemStateFromDb()
    const operator = currentOperator(token)
    const { operation } = deleteRoleRecord(state.roles, state.users, id)
    this.addOperationLog(withOperator(operation, operator))
    await deleteRoleFromDb(id)
    persist()
  },
  async listDictionaries(query: any = {}) {
    const dbDictionaries = await listDictionariesFromDb(query)
    if (dbDictionaries)
      return dbDictionaries

    const type = String(query.type ?? '')
    return listDictionaryRecords(ensureState().dictionaries, type)
  },
  async saveDictionary(payload: Partial<DictionaryItem>, token?: string) {
    const state = await hydrateSystemStateFromDb()
    const operator = currentOperator(token)
    const { item, operation } = saveDictionaryRecord(state.dictionaries, payload, () => nextId('dict'))
    this.addOperationLog(withOperator(operation, operator))
    const dbId = await saveDictionaryToDb(item)
    if (dbId)
      item.id = String(dbId)
    persist()
    return item
  },
  async deleteDictionary(id: string, token?: string) {
    const state = await hydrateSystemStateFromDb()
    const operator = currentOperator(token)
    const target = state.dictionaries.find(item => item.id === id)
    if (target && businessDictionaryDefaultKeySet.has(`${target.type}::${target.value}`))
      throw new Error('系统内置业务主数据不能删除，请改为停用')
    const { operation } = deleteDictionaryRecord(state.dictionaries, id)
    this.addOperationLog(withOperator(operation, operator))
    await deleteDictionaryFromDb(id)
    persist()
  },
  listLoginLogs(query: any = {}) {
    const keyword = String(query.keyword ?? '').trim().toLowerCase()
    return ensureState().loginLogs.filter(item => !keyword || [item.username, item.nickname, item.message].some(value => String(value ?? '').toLowerCase().includes(keyword)))
  },
  listOperationLogs(query: any = {}) {
    const keyword = String(query.keyword ?? '').trim().toLowerCase()
    const action = String(query.action ?? '')
    return ensureState().operationLogs.filter(item => (!keyword || [item.module, item.content, item.operatorName].some(value => String(value ?? '').toLowerCase().includes(keyword))) && (!action || item.action === action))
  },
  addLoginLog(payload: Omit<LoginLog, 'id' | 'createdAt'>) {
    const record = {
      id: nextId('login'),
      ip: payload.ip || '127.0.0.1',
      createdAt: now(),
      ...payload,
    }
    ensureState().loginLogs.unshift(record)
    ensureState().loginLogs = ensureState().loginLogs.slice(0, 200)
    void insertLoginLogToDb(record).catch(error => reportAsyncSideEffect('insert login log', error))
  },
  addOperationLog(payload: Omit<OperationLog, 'id' | 'createdAt'>) {
    const record = {
      id: nextId('op'),
      createdAt: now(),
      ...payload,
    }
    ensureState().operationLogs.unshift(record)
    ensureState().operationLogs = ensureState().operationLogs.slice(0, 300)
    void insertOperationLogToDb(record).catch(error => reportAsyncSideEffect('insert operation log', error))
  },
}

ensureState()

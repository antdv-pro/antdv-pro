import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { systemStore } from './system-store'

const fsMocks = vi.hoisted(() => ({ writeFileSync: vi.fn(), mkdirSync: vi.fn() }))
vi.mock('node:fs', () => ({ existsSync: () => false, readFileSync: vi.fn(), writeFileSync: fsMocks.writeFileSync, mkdirSync: fsMocks.mkdirSync }))
vi.mock('./mysql', () => ({ getMysqlPool: () => undefined, isDatabaseRequired: () => false }))

describe('system store memory backend', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters users without exposing password material', async () => {
    const users = await systemStore.listUsers({ keyword: '财务', deptId: 'finance', status: 'enabled' })
    expect(users).toHaveLength(1)
    expect(users[0]).toMatchObject({ username: 'finance_manager', roles: ['FINANCE_MANAGER'] })
    expect(users[0]).not.toHaveProperty('passwordHash')
    expect(users[0]).not.toHaveProperty('passwordSalt')
  })

  it('rejects forged base64 tokens and accepts only real login sessions', async () => {
    expect(systemStore.getUserByToken(Buffer.from('admin').toString('base64'))).toBeUndefined()
    await expect(systemStore.validateLogin('missing', 'x', { ip: '127.0.0.1' })).resolves.toMatchObject({ ok: false })
    await expect(systemStore.validateLogin('admin', 'wrong', {})).resolves.toMatchObject({ ok: false, message: '用户名或密码错误' })
    const result = await systemStore.validateLogin('admin', 'admin', { ip: '127.0.0.1', userAgent: 'vitest' })
    expect(result).toMatchObject({ ok: true, user: { username: 'admin' } })
    expect(systemStore.getUserByToken(result.token)).toMatchObject({ username: 'admin' })
    systemStore.logout(result.token)
    expect(systemStore.getUserByToken(result.token)).toBeUndefined()
  })

  it('enforces required and unique usernames consistently with MySQL', async () => {
    await expect(systemStore.saveUser({ nickname: '无账号' })).rejects.toThrow('用户名不能为空')
    await expect(systemStore.saveUser({ username: 'admin', nickname: '重复管理员' })).rejects.toThrow('用户名已存在')
    await expect(systemStore.saveUser({ id: 999999, username: 'missing', nickname: '不存在' })).rejects.toThrow('用户不存在')
  })

  it('creates a user, derives role names and supports password reset and disable', async () => {
    const suffix = Date.now()
    const username = `tester_${suffix}`
    const created = await systemStore.saveUser({
      username,
      nickname: '测试用户',
      mobile: '13900000000',
      deptId: 'transport',
      postName: `测试岗位${suffix}`,
      roleIds: ['role-user'],
      password: 'old-password',
      status: 'enabled',
    })
    expect(created).toMatchObject({ username, roles: ['USER'], deptName: '运输管理部', postName: `测试岗位${suffix}` })
    expect(await systemStore.validateLogin(username, 'old-password', {})).toMatchObject({ ok: true })
    await systemStore.resetPassword(created.id, 'new-password')
    expect(await systemStore.validateLogin(username, 'old-password', {})).toMatchObject({ ok: false })
    expect(await systemStore.validateLogin(username, 'new-password', {})).toMatchObject({ ok: true })
    await expect(systemStore.resetPassword(created.id, '12345')).rejects.toThrow('密码长度必须为 6–64 个字符')
    await systemStore.disableUser(created.id, 'disabled')
    expect(await systemStore.validateLogin(username, 'new-password', {})).toMatchObject({ ok: false, message: '用户已禁用' })
    await systemStore.disableUser(created.id, 'enabled')
    await systemStore.deleteUser(created.id)
    expect((await systemStore.listUsers()).some(item => item.id === created.id)).toBe(false)
  })

  it('creates custom departments and scopes same-name posts to the selected department', async () => {
    const suffix = Date.now()
    const departmentName = `自定义部门${suffix}`
    const created = await systemStore.saveUser({
      username: `custom_org_${suffix}`,
      nickname: '自定义组织用户',
      mobile: '13900000001',
      companyId: 'company-main',
      deptName: departmentName,
      postName: '部门专员',
      roleIds: ['role-user'],
      status: 'enabled',
    })

    expect(created).toMatchObject({ companyName: '青海诚捷运输有限公司', deptName: departmentName, postName: '部门专员' })
    const department = (await systemStore.listOrganizations()).find(item => item.type === 'department' && item.name === departmentName)
    const post = (await systemStore.listOrganizations()).find(item => item.type === 'post' && item.name === '部门专员' && item.parentId === department?.id)
    expect(department).toBeTruthy()
    expect(post).toBeTruthy()
    await systemStore.deleteUser(created.id)
  })

  it('clears a stale post when a user changes department without selecting a new post', async () => {
    const suffix = Date.now()
    const created = await systemStore.saveUser({
      username: `change_department_${suffix}`,
      nickname: '部门变更测试',
      mobile: '13900000009',
      deptId: 'transport',
      postId: 'post-driver',
      roleIds: ['role-user'],
      status: 'enabled',
    })
    const updated = await systemStore.saveUser({
      ...created,
      deptId: 'finance',
      deptName: '人事财务部',
      postId: undefined,
      postName: '',
    })
    expect(updated).toMatchObject({ deptName: '人事财务部', postId: '', postName: '' })
    await systemStore.deleteUser(created.id)
  })

  it('binds a WeCom identity by mobile and derives its department', async () => {
    const bound = await systemStore.bindWecomIdentity({
      wecomUserId: 'wecom-finance-manager',
      mobile: '13800000003',
      nickname: '财务经理',
      wecomDepartmentId: '2002',
      deptName: '人事财务部',
    })
    expect(bound).toMatchObject({
      username: 'finance_manager',
      wecomUserId: 'wecom-finance-manager',
      wecomDepartmentId: '2002',
      deptName: '人事财务部',
    })
  })

  it('creates a bound organization user when the WeCom mobile is new', async () => {
    const wecomUserId = `new-wecom-${Date.now()}`
    const created = await systemStore.bindWecomIdentity({
      wecomUserId,
      mobile: '13799990000',
      nickname: '企业微信新员工',
      wecomDepartmentId: '3003',
      deptName: '运输管理部',
    })
    expect(created).toMatchObject({ wecomUserId, nickname: '企业微信新员工', deptName: '运输管理部', roles: ['USER'] })
    await systemStore.deleteUser(created!.id)
  })

  it('protects parent organizations and supports leaf lifecycle', async () => {
    await expect(systemStore.deleteOrganization('company-main')).rejects.toThrow('存在下级组织')
    const item = await systemStore.saveOrganization({ type: 'department', parentId: 'management', name: '测试部门', code: `TEST${Date.now()}` })
    expect((await systemStore.listOrganizations()).some(org => org.id === item.id)).toBe(true)
    await systemStore.deleteOrganization(item.id)
    expect((await systemStore.listOrganizations()).some(org => org.id === item.id)).toBe(false)
  })

  it('protects assigned roles and supports unassigned role lifecycle', async () => {
    await expect(systemStore.deleteRole('role-admin')).rejects.toThrow('已有用户绑定该角色')
    const role = await systemStore.saveRole({ code: `TEST_${Date.now()}`, name: '测试角色', dataScope: 'self', menuPermissions: ['/test'], buttonPermissions: ['view'] })
    expect((await systemStore.listRoles()).some(item => item.id === role.id)).toBe(true)
    await systemStore.deleteRole(role.id)
    expect((await systemStore.listRoles()).some(item => item.id === role.id)).toBe(false)
  })

  it('provides centralized business dictionaries and protects built-in values', async () => {
    const carriers = await systemStore.listDictionaries({ type: 'trade_carrier' })
    expect(carriers.map(item => item.value)).toEqual(['诚捷', '诚域', '诺锐', '外协车队'])
    await expect(systemStore.deleteDictionary(carriers[0].id)).rejects.toThrow('系统内置业务主数据不能删除，请改为停用')
  })

  it('creates, filters, updates and deletes dictionary entries', async () => {
    const item = await systemStore.saveDictionary({ type: 'test_type', typeName: '测试类型', label: '启用', value: 'enabled', sortNo: 1 })
    expect(await systemStore.listDictionaries({ type: 'test_type' })).toEqual([item])
    const updated = await systemStore.saveDictionary({ ...item, label: '已启用' })
    expect(updated.label).toBe('已启用')
    await systemStore.deleteDictionary(item.id)
    expect(await systemStore.listDictionaries({ type: 'test_type' })).toEqual([])
  })

  it('records and filters login and operation audit logs', () => {
    systemStore.addLoginLog({ username: 'audit-user', ip: '127.0.0.1', status: 'failed', message: '审计测试' })
    systemStore.addOperationLog({ module: '测试模块', action: 'export', content: '导出审计测试', operatorName: '审计员' })
    expect(systemStore.listLoginLogs({ keyword: '审计测试' })[0]).toMatchObject({ username: 'audit-user' })
    expect(systemStore.listOperationLogs({ keyword: '审计员', action: 'export' })[0]).toMatchObject({ module: '测试模块' })
    expect(systemStore.listOperationLogs({ action: 'delete' }).some(item => item.content === '导出审计测试')).toBe(false)
  })
})

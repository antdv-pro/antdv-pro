import { describe, expect, it } from 'vitest'
import { deleteDictionaryRecord, listDictionaryRecords, saveDictionaryRecord } from './dictionary-repository'
import { deleteOrganizationRecord, listOrganizationRecords, saveOrganizationRecord } from './organization-repository'
import { deleteRoleRecord, saveRoleRecord } from './role-repository'
import { changeUserStatus, deleteUserRecord, listUserRecords, resetUserCredential } from './user-repository'

describe('system domain repositories', () => {
  const user = (overrides: Record<string, any> = {}) => ({
    id: 1,
    username: 'zhangsan',
    nickname: '张三',
    mobile: '13800000000',
    companyId: 'C1',
    companyName: '公司',
    deptId: 'D1',
    deptName: '运输部',
    postId: 'P1',
    postName: '司机',
    roleIds: [],
    roles: [],
    status: 'enabled',
    passwordSalt: 'salt',
    passwordHash: 'hash',
    createdAt: '2026-07-01',
    updatedAt: '2026-07-01',
    ...overrides,
  })

  it('filters users and strips password credentials from public records', () => {
    const users: any[] = [user(), user({ id: 2, username: 'lisi', nickname: '李四', deptId: 'D2', status: 'disabled' })]
    const result = listUserRecords(users, { keyword: '张', deptId: 'D1', status: 'enabled' })
    expect(result).toEqual([expect.objectContaining({ id: 1, nickname: '张三' })])
    expect(result[0]).not.toHaveProperty('passwordHash')
    expect(result[0]).not.toHaveProperty('passwordSalt')
  })

  it('changes status and deletes users with audit operations', () => {
    const users: any[] = [user()]
    const changed = changeUserStatus(users, 1, 'disabled', '2026-07-18')
    expect(changed.user).toMatchObject({ status: 'disabled', updatedAt: '2026-07-18' })
    expect(changed.operation).toMatchObject({ action: 'disable', targetId: 1 })
    expect(deleteUserRecord(users, 1).operation.action).toBe('delete')
    expect(users).toEqual([])
  })

  it('validates password length and injects credential generation', () => {
    const users: any[] = [user()]
    expect(() => resetUserCredential(users, 1, '123', '2026-07-18', () => ({ passwordSalt: '', passwordHash: '' }))).toThrow('6–64')
    const reset = resetUserCredential(users, 1, '123456', '2026-07-18', password => ({ passwordSalt: `salt:${password}`, passwordHash: 'new-hash' }))
    expect(reset.user).toMatchObject({ passwordSalt: 'salt:123456', passwordHash: 'new-hash' })
    expect(reset.operation.action).toBe('reset-password')
  })

  it('sorts organizations and creates type-aware audit operations', () => {
    const items: any[] = [
      { id: 'D2', type: 'department', name: '二部', sortNo: 2 },
      { id: 'D1', type: 'department', name: '一部', sortNo: 1 },
    ]
    expect(listOrganizationRecords(items).map(item => item.id)).toEqual(['D1', 'D2'])
    expect(items.map(item => item.id)).toEqual(['D2', 'D1'])
    const created = saveOrganizationRecord(items, { type: 'post', name: '调度员', code: 'POST1' }, () => 'P1')
    expect(created.item).toMatchObject({ id: 'P1', type: 'post', status: 'enabled' })
    expect(created.operation.content).toBe('新增岗位 调度员')
  })

  it('prevents deleting an organization that has children', () => {
    const items: any[] = [
      { id: 'ROOT', type: 'company', name: '公司', sortNo: 1 },
      { id: 'DEPT', parentId: 'ROOT', type: 'department', name: '部门', sortNo: 2 },
    ]
    expect(() => deleteOrganizationRecord(items, 'ROOT')).toThrow('存在下级组织')
    expect(deleteOrganizationRecord(items, 'DEPT').operation).toMatchObject({ action: 'delete', targetId: 'DEPT' })
  })

  it('creates and updates roles while refreshing user role codes', () => {
    const roles: any[] = []
    const users: any[] = [{ id: 1, roleIds: ['R1'], roles: [] }]
    const created = saveRoleRecord(roles, users, { code: 'USER', name: '用户' }, () => 'R1')
    expect(created.role).toMatchObject({ id: 'R1', code: 'USER', dataScope: 'self' })
    expect(created.operation.action).toBe('create')
    const updated = saveRoleRecord(roles, users, { id: 'R1', code: 'STAFF', name: '员工' }, () => 'unused')
    expect(updated.operation.action).toBe('update')
    expect(users[0].roles).toEqual(['STAFF'])
  })

  it('prevents deletion of a role assigned to a user', () => {
    const roles: any[] = [{ id: 'R1', code: 'USER', name: '用户' }]
    expect(() => deleteRoleRecord(roles, [{ roleIds: ['R1'] } as any], 'R1')).toThrow('已有用户绑定该角色')
    expect(deleteRoleRecord(roles, [], 'R1').operation.action).toBe('delete')
  })

  it('filters and sorts dictionaries without mutating their membership', () => {
    const items: any[] = [
      { id: 'D2', type: 'status', sortNo: 2 },
      { id: 'D1', type: 'status', sortNo: 1 },
      { id: 'D3', type: 'other', sortNo: 1 },
    ]
    expect(listDictionaryRecords(items, 'status').map(item => item.id)).toEqual(['D1', 'D2'])
    expect(items).toHaveLength(3)
  })

  it('creates, updates and deletes dictionary records with audit operations', () => {
    const items: any[] = []
    const created = saveDictionaryRecord(items, { type: 'status', typeName: '状态', label: '启用', value: 'enabled' }, () => 'D1')
    expect(created.item).toMatchObject({ id: 'D1', sortNo: 1, status: 'enabled' })
    expect(created.operation.action).toBe('create')
    expect(saveDictionaryRecord(items, { id: 'D1', label: '正常' }, () => 'unused').operation.action).toBe('update')
    expect(deleteDictionaryRecord(items, 'D1').operation).toMatchObject({ action: 'delete', targetId: 'D1' })
    expect(items).toEqual([])
  })
})

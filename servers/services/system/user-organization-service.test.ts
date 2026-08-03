import { describe, expect, it, vi } from 'vitest'
import { resolveUserOrganizations } from './user-organization-service'

describe('user organization application service', () => {
  it('reuses existing company, department and post', async () => {
    const state: any = { organizations: [
      { id: 'C1', type: 'company', name: '公司' },
      { id: 'D1', parentId: 'C1', type: 'department', name: '运输部' },
      { id: 'P1', parentId: 'D1', type: 'post', name: '司机' },
    ] }
    const saveOrganization = vi.fn()
    const recordOperation = vi.fn()
    const result = await resolveUserOrganizations(state, { companyId: 'C1', deptName: '运输部', postName: '司机' }, {
      nextId: type => type,
      saveOrganization,
      recordOperation,
    })
    expect(result).toMatchObject({ company: { id: 'C1' }, dept: { id: 'D1' }, post: { id: 'P1' } })
    expect(saveOrganization).not.toHaveBeenCalled()
    expect(recordOperation).not.toHaveBeenCalled()
  })

  it('creates department before post and applies database ids', async () => {
    const state: any = { organizations: [{ id: 'C1', type: 'company', name: '公司' }] }
    const saveOrganization = vi.fn()
      .mockResolvedValueOnce('101')
      .mockResolvedValueOnce('202')
    const recordOperation = vi.fn()
    const result = await resolveUserOrganizations(state, { deptName: '调度部', postName: '调度员' }, {
      nextId: type => `local-${type}`,
      saveOrganization,
      recordOperation,
    })
    expect(result.dept).toMatchObject({ id: '101', parentId: 'C1', code: 'DEPT001' })
    expect(result.post).toMatchObject({ id: '202', parentId: '101', code: 'POST001' })
    expect(saveOrganization.mock.calls.map(call => call[0].type)).toEqual(['department', 'post'])
    expect(recordOperation.mock.calls.map(call => call[0].content)).toEqual(['新增部门 调度部', '新增岗位 调度员'])
  })

  it('uses the organization name bound by department id instead of a stale user name', async () => {
    const state: any = { organizations: [
      { id: 'C1', type: 'company', name: '公司' },
      { id: 'D1', parentId: 'C1', type: 'department', name: '组织架构部门' },
    ] }
    const result = await resolveUserOrganizations(state, { companyId: 'C1', deptId: 'D1', deptName: '用户旧部门名' }, {
      nextId: type => type,
      saveOrganization: vi.fn(),
      recordOperation: vi.fn(),
    })
    expect(result.dept?.name).toBe('组织架构部门')
  })

  it('does not reuse a post that belongs to another department', async () => {
    const state: any = { organizations: [
      { id: 'C1', type: 'company', name: '公司' },
      { id: 'D1', parentId: 'C1', type: 'department', name: '运输部' },
      { id: 'D2', parentId: 'C1', type: 'department', name: '酒店部' },
      { id: 'P1', parentId: 'D1', type: 'post', name: '监控员' },
      { id: 'P2', parentId: 'D2', type: 'post', name: '监控员' },
    ] }
    const result = await resolveUserOrganizations(state, { companyId: 'C1', deptId: 'D2', postId: 'P1', postName: '监控员' }, {
      nextId: type => type,
      saveOrganization: vi.fn(),
      recordOperation: vi.fn(),
    })
    expect(result.post?.id).toBe('P2')
  })
})

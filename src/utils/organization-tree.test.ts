import type { OrganizationNode } from '~@/api/system'
import { describe, expect, it } from 'vitest'
import { buildOrganizationTree } from './organization-tree'

describe('buildOrganizationTree', () => {
  it('keeps organization types isolated when numeric ids collide', () => {
    const organizations: OrganizationNode[] = [
      { id: '1', type: 'company', name: 'Company', code: 'C1', sortNo: 1, status: 'enabled' },
      { id: '2', parentId: '1', type: 'department', name: 'Department', code: 'D1', sortNo: 1, status: 'enabled' },
      { id: '2', parentId: '2', type: 'post', name: 'Post', code: 'P1', sortNo: 1, status: 'enabled' },
    ]

    const tree = buildOrganizationTree(organizations, () => 0)

    expect(tree[0].key).toBe('company:1')
    expect(tree[0].children[0].key).toBe('department:2')
    expect(tree[0].children[0].children[0].key).toBe('post:2')
    expect(tree[0].children[0].children[0].children).toEqual([])
  })

  it('uses the parent type instead of attaching a post to another post with the same id', () => {
    const organizations: OrganizationNode[] = [
      { id: '1', type: 'company', name: 'Company', code: 'C1', sortNo: 1, status: 'enabled' },
      { id: '7', parentId: '1', type: 'department', name: 'Department', code: 'D1', sortNo: 1, status: 'enabled' },
      { id: '7', parentId: '7', type: 'post', name: 'Post', code: 'P1', sortNo: 1, status: 'enabled' },
    ]

    expect(() => buildOrganizationTree(organizations, () => 0)).not.toThrow()
    expect(buildOrganizationTree(organizations, () => 0)[0].children[0].children).toHaveLength(1)
  })

  it('supports departments nested below another department', () => {
    const organizations: OrganizationNode[] = [
      { id: '1', type: 'company', name: 'Company', code: 'C1', sortNo: 1, status: 'enabled' },
      { id: '10', parentId: '1', type: 'department', name: 'Management', code: 'D1', sortNo: 1, status: 'enabled' },
      { id: '20', parentId: '10', type: 'department', name: 'Finance', code: 'D2', sortNo: 1, status: 'enabled' },
    ]

    const tree = buildOrganizationTree(organizations, () => 0)
    expect(tree[0].children[0].children[0]).toMatchObject({ key: 'department:20', name: 'Finance' })
  })
})

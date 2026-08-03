import { describe, expect, it } from 'vitest'
import { getRecordPermission } from './record-permission'

const creator = { id: 7, roles: [] }

describe('getRecordPermission', () => {
  it('lets backend permissions override local rules', () => {
    expect(getRecordPermission({ status: 'approved', permissions: { edit: true } }, creator, 'edit')).toEqual({ allowed: true, reason: undefined })
    expect(getRecordPermission({ status: 'draft', createdBy: 7, permissions: { edit: { allowed: false, reason: '只读' } } }, creator, 'edit')).toEqual({ allowed: false, reason: '只读' })
  })

  it('allows creators to edit and delete editable status aliases', () => {
    expect(getRecordPermission({ status: '草稿', createdBy: '7' }, creator, 'edit').allowed).toBe(true)
    expect(getRecordPermission({ approvalStatus: '已驳回', applicantId: 7 }, creator, 'delete').allowed).toBe(true)
  })

  it('keeps locked records immutable, including for administrators', () => {
    const admin = { id: 1, roles: ['ADMIN'] }
    expect(getRecordPermission({ status: 'approved' }, admin, 'edit').allowed).toBe(false)
    expect(getRecordPermission({ isImported: true }, admin, 'delete').allowed).toBe(false)
  })

  it('allows assigned auditors and audit roles only for pending records', () => {
    expect(getRecordPermission({ status: '审批中', approverId: 7 }, creator, 'audit').allowed).toBe(true)
    expect(getRecordPermission({ status: 'pending' }, { id: 8, roles: ['FINANCE_MANAGER'] }, 'audit').allowed).toBe(true)
    expect(getRecordPermission({ status: 'draft', approverId: 7 }, creator, 'audit').allowed).toBe(false)
  })

  it('restricts revoke, void and import confirmation by status and identity', () => {
    expect(getRecordPermission({ status: 'pending', creatorId: 7 }, creator, 'revoke').allowed).toBe(true)
    expect(getRecordPermission({ status: 'pending' }, creator, 'void').allowed).toBe(false)
    expect(getRecordPermission({ importStatus: '待确认' }, { id: 8, roles: ['DEPT_LEADER'] }, 'confirmImport').allowed).toBe(true)
    expect(getRecordPermission({ importStatus: 'completed', createdBy: 7 }, creator, 'confirmImport').allowed).toBe(false)
  })
})

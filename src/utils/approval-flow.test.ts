import { describe, expect, it } from 'vitest'
import { buildApprovalFlowGroups } from './approval-flow'

describe('approval flow view model', () => {
  it('uses enterprise WeChat approvers instead of local placeholder nodes', () => {
    const groups = buildApprovalFlowGroups({
      instance: {
        formSnapshot: {
          approvalFlow: [{
            status: 'APPROVED',
            approvers: [
              { userId: 'han', name: '韩鹏', status: 'APPROVED', actedAt: '2026-07-24T06:40:00.000Z' },
              { userId: 'tao', name: '陶世梅', status: 'APPROVED', actedAt: '2026-07-24T06:40:00.000Z' },
              { userId: 'fan', name: '范承栋', status: 'APPROVED', actedAt: '2026-07-24T08:33:00.000Z' },
            ],
          }],
        },
      },
      nodes: [{ id: 'admin', name: '管理员审批', status: 'PENDING', approverIds: [1] }],
      tasks: [{ nodeId: 'admin', assigneeId: 1, assigneeName: '超级管理员', status: 'PENDING' }],
    })

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ title: '审批人', status: 'APPROVED' })
    expect(groups[0].approvers.map(item => item.name)).toEqual(['韩鹏', '陶世梅', '范承栋'])
  })

  it('shows local task assignees under their approval node', () => {
    const groups = buildApprovalFlowGroups({
      instance: { formSnapshot: {} },
      nodes: [{ id: 'manager', name: '部门负责人审批', status: 'PENDING', approverIds: [4] }],
      tasks: [{ nodeId: 'manager', assigneeId: 4, assigneeName: '王经理', status: 'PENDING' }],
    })

    expect(groups[0]).toMatchObject({ title: '部门负责人审批' })
    expect(groups[0].approvers[0]).toMatchObject({ name: '王经理', status: 'PENDING' })
  })

  it('resolves configured approvers for future local nodes without tasks', () => {
    const groups = buildApprovalFlowGroups({
      nodes: [{ id: 'finance', name: '财务复核', status: 'PENDING', approverIds: [3, 5] }],
      tasks: [],
    }, userId => ({ 3: '赵会计', 5: '总经理' })[Number(userId)] || String(userId))

    expect(groups[0].approvers.map(item => item.name)).toEqual(['赵会计', '总经理'])
  })
})

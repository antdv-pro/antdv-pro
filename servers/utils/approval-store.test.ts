import { beforeEach, describe, expect, it, vi } from 'vitest'

import { approvalStore } from './approval-store'

const users = [
  { id: 1, nickname: '管理员' },
  { id: 2, nickname: '申请人' },
  { id: 3, nickname: '财务经理' },
  { id: 4, nickname: '部门负责人' },
  { id: 5, nickname: '总经理' },
]
vi.mock('./mysql', () => ({ getMysqlPool: () => undefined, isDatabaseRequired: () => false }))
vi.mock('./system-store', () => ({ systemStore: { listUsers: vi.fn(async () => users) } }))

function submit(overrides: Record<string, any> = {}) {
  return approvalStore.submit({
    businessType: 'expense',
    businessId: 'expense-1',
    businessNo: 'EXP-1',
    title: '费用报销',
    applicantId: 2,
    applicantName: '申请人',
    amount: 100,
    formData: { reason: '差旅' },
    ccUserIds: [3],
    ...overrides,
  })
}

describe('approval store workflow', () => {
  beforeEach(async () => {
    await approvalStore.resetForTest()
  })

  it('submits an approval with tasks, logs, cc and business linkage', async () => {
    const detail = await submit()
    expect(detail.instance).toMatchObject({ status: 'PENDING', businessStatus: 'APPROVAL_PENDING', currentNodeName: '部门负责人审批' })
    expect(detail.tasks).toHaveLength(1)
    expect(detail.tasks[0]).toMatchObject({ assigneeId: 4, status: 'PENDING' })
    expect(detail.logs.map(item => item.action)).toEqual(['CC', 'SUBMIT'])
    expect(detail.ccs[0]).toMatchObject({ userId: 3, read: false })
    expect(detail.business).toMatchObject({ businessStatus: 'APPROVAL_PENDING', approvalInstanceId: detail.instance.id })
    await expect(approvalStore.getByBusiness('expense', 'expense-1')).resolves.toMatchObject({ instance: { id: detail.instance.id } })
  })

  it('prevents a second active workflow for the same business record', async () => {
    await submit()
    await expect(submit()).rejects.toThrow('已存在审批中流程')
    expect(await approvalStore.listInstances()).toHaveLength(1)
  })

  it('moves through both approval nodes and completes once', async () => {
    const submitted = await submit()
    await expect(approvalStore.approve({ taskId: submitted.tasks[0].id, operatorId: 9, operatorName: '越权用户' })).rejects.toThrow('仅当前审批人')
    const first = await approvalStore.approve({ taskId: submitted.tasks[0].id, operatorId: 4, operatorName: '部门负责人', comment: '同意' })
    expect(first.instance.status).toBe('APPROVING')
    const financeTask = first.tasks.find(item => item.status === 'PENDING')!
    expect(financeTask.assigneeId).toBe(3)
    const completed = await approvalStore.approve({ taskId: financeTask.id, operatorId: 3, operatorName: '财务经理' })
    expect(completed.instance).toMatchObject({ status: 'APPROVED', businessStatus: 'APPROVAL_APPROVED', currentNodeId: undefined })
    expect(completed.business).toMatchObject({ businessStatus: 'APPROVAL_APPROVED' })
    await expect(approvalStore.approve({ taskId: financeTask.id, operatorId: 3, operatorName: '财务经理' })).rejects.toThrow('当前任务不可审批')
  })

  it('rejects an approval and cancels all remaining tasks', async () => {
    const submitted = await submit()
    const rejected = await approvalStore.reject({ taskId: submitted.tasks[0].id, operatorId: 4, operatorName: '部门负责人', comment: '资料不全' })
    expect(rejected.instance).toMatchObject({ status: 'REJECTED', businessStatus: 'APPROVAL_REJECTED' })
    expect(rejected.tasks.every(item => item.status !== 'PENDING')).toBe(true)
    expect(rejected.logs.at(-1)).toMatchObject({ action: 'REJECT', comment: '资料不全' })
  })

  it('applies an external approval status to the instance and business record', async () => {
    const submitted = await submit()
    const latestFlow = [{ status: 'APPROVED', approvers: [{ userId: 'HanPeng', name: '韩鹏', status: 'APPROVED' }] }]
    const result = await approvalStore.applyExternalStatus(submitted.instance.id, 'APPROVED', '企业微信', 'SP-20260713', {
      source: '企业微信',
      approvalFlow: latestFlow,
    })

    expect(result.instance).toMatchObject({
      status: 'APPROVED',
      businessStatus: 'APPROVAL_APPROVED',
      formSnapshot: { source: '企业微信', approvalFlow: latestFlow },
      payload: { source: '企业微信', approvalFlow: latestFlow },
    })
    expect(result.tasks.every(task => task.status !== 'PENDING')).toBe(true)
    expect(result.logs.at(-1)).toMatchObject({ action: 'EXTERNAL_SYNC', operatorName: '企业微信' })
    expect(await approvalStore.listBusinessRecords()).toContainEqual(expect.objectContaining({
      approvalInstanceId: submitted.instance.id,
      approvalStatus: 'APPROVED',
      businessStatus: 'APPROVAL_APPROVED',
    }))
  })

  it('upserts an external approval idempotently without creating local tasks', async () => {
    const payload = {
      externalKey: '202607150001',
      approvalType: '酒店费用',
      businessType: 'wecom_abc123',
      businessNo: '202607150001',
      title: '酒店6月份员工工资',
      applicantId: 'FanChengDong',
      applicantName: '范承栋',
      amount: 36223.33,
      status: 'APPROVED' as const,
      submittedAt: '2026-07-15T05:51:00.000Z',
      completedAt: '2026-07-15T06:30:00.000Z',
      formData: { source: '企业微信', wecomSpNo: '202607150001', wecomTemplateName: '费用' },
    }
    const created = await approvalStore.upsertExternal(payload)
    const updated = await approvalStore.upsertExternal({ ...payload, title: '酒店6月份员工工资（已同步）' })

    expect(created.instance.id).toBe(updated.instance.id)
    expect(updated.instance).toMatchObject({ code: '202607150001', status: 'APPROVED', title: '酒店6月份员工工资（已同步）' })
    expect(updated.tasks).toEqual([])
    expect(await approvalStore.listInstances()).toHaveLength(1)
  })

  it('keeps an archived external approval hidden after later WeCom syncs', async () => {
    const payload = {
      externalKey: '202607150099',
      approvalType: '费用',
      businessType: 'wecom_archived',
      businessNo: '202607150099',
      title: '重复费用',
      applicantId: 'wecom-user',
      applicantName: '企业微信用户',
      status: 'APPROVED' as const,
      submittedAt: '2026-07-15T05:51:00.000Z',
      formData: { source: '企业微信' },
    }
    const created = await approvalStore.upsertExternal(payload)
    await approvalStore.archive(created.instance.id, 1, '管理员', '重复记录')
    await approvalStore.upsertExternal({ ...payload, title: '重复费用（再次同步）' })
    expect(await approvalStore.listInstances()).toEqual([])
    expect(await approvalStore.listInstances({ includeArchived: true })).toEqual([
      expect.objectContaining({ title: '重复费用（再次同步）', payload: expect.objectContaining({ archivedBy: '管理员' }) }),
    ])
  })

  it('allows only the applicant to revoke an active approval', async () => {
    const submitted = await submit()
    await expect(approvalStore.revoke(submitted.instance.id, 3, '其他用户')).rejects.toThrow('仅申请人可撤回')
    const revoked = await approvalStore.revoke(submitted.instance.id, 2, '申请人', '取消申请')
    expect(revoked.instance).toMatchObject({ status: 'REVOKED', businessStatus: 'APPROVAL_REVOKED' })
    expect(revoked.tasks[0].status).toBe('CANCELED')
    await expect(approvalStore.revoke(submitted.instance.id, 2, '申请人')).rejects.toThrow('当前审批不可撤回')
  })

  it('archives an approval and hides it from active lists', async () => {
    const submitted = await submit()
    const archived = await approvalStore.archive(submitted.instance.id, 1, '管理员', '重复申请')
    expect(archived.instance).toMatchObject({ status: 'REVOKED', payload: { archivedBy: '管理员', archiveReason: '重复申请' } })
    expect(archived.logs.at(-1)).toMatchObject({ action: 'ARCHIVE', operatorName: '管理员' })
    expect(await approvalStore.listInstances()).toEqual([])
    expect(await approvalStore.listInstances({ includeArchived: true })).toHaveLength(1)
  })

  it('validates both transfer operator and destination user', async () => {
    const submitted = await submit()
    const taskId = submitted.tasks[0].id
    await expect(approvalStore.transfer({ taskId, operatorId: 3, operatorName: '财务经理', toUserId: 5, toUserName: '总经理' })).rejects.toThrow('仅当前审批人')
    await expect(approvalStore.transfer({ taskId, operatorId: 4, operatorName: '部门负责人', toUserId: 999, toUserName: '不存在' })).rejects.toThrow('转交人员必须来自组织架构')
    const transferred = await approvalStore.transfer({ taskId, operatorId: 4, operatorName: '部门负责人', toUserId: 5, toUserName: '总经理' })
    expect(transferred.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: taskId, status: 'TRANSFERRED' }),
      expect.objectContaining({ assigneeId: 5, status: 'PENDING' }),
    ]))
    expect(transferred.logs.at(-1)).toMatchObject({ action: 'TRANSFER', fromUserId: 4, toUserId: 5 })
  })

  it('queries todo, done, submitted, cc and period-filtered records', async () => {
    const submitted = await submit()
    expect(await approvalStore.listTodo(4)).toHaveLength(1)
    expect(await approvalStore.listSubmitted(2)).toHaveLength(1)
    expect(await approvalStore.listCc(3)).toHaveLength(1)
    await approvalStore.reject({ taskId: submitted.tasks[0].id, operatorId: 4, operatorName: '部门负责人' })
    expect(await approvalStore.listDone(4)).toHaveLength(1)
    expect(await approvalStore.listInstances({ status: 'REJECTED', businessType: 'expense' })).toHaveLength(1)
    expect(await approvalStore.listInstances({ startDate: '2999-01-01', endDate: '2999-02-01' })).toEqual([])
    expect(await approvalStore.listBusinessRecords({ startDate: '2999-01-01', endDate: '2999-02-01' })).toEqual([])
  })

  it('validates template users, cc users and missing business templates', async () => {
    await expect(approvalStore.createTemplate({ name: '空节点', businessTypes: ['custom'], nodes: [{ id: '', name: '节点', order: 1, approverType: 'USER', approverIds: [] }] })).rejects.toThrow('至少选择一名审批人员')
    await expect(submit({ businessId: 'x', ccUserIds: [999] })).rejects.toThrow('抄送人员必须来自组织架构')
    await expect(submit({ businessType: 'unsupported', businessId: 'y' })).rejects.toThrow('未找到适用于 unsupported')
  })
})

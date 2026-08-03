export interface ApprovalFlowPerson {
  key: string
  userId: string | number
  name: string
  status: string
  actedAt?: string
  comment?: string
}

export interface ApprovalFlowGroup {
  key: string
  title: string
  status: string
  approvers: ApprovalFlowPerson[]
}

interface ApprovalDetailLike {
  instance?: {
    formSnapshot?: Record<string, any>
    payload?: Record<string, any>
  }
  nodes?: Array<Record<string, any>>
  tasks?: Array<Record<string, any>>
}

function personKey(prefix: string, userId: string | number, index: number) {
  return `${prefix}-${String(userId || 'unknown')}-${index}`
}

export function buildApprovalFlowGroups(
  detail: ApprovalDetailLike | undefined,
  resolveUserName: (userId: string | number) => string = userId => String(userId),
): ApprovalFlowGroup[] {
  if (!detail)
    return []

  const storedExternalFlow = detail.instance?.formSnapshot?.approvalFlow ?? detail.instance?.payload?.approvalFlow
  const externalFlow = Array.isArray(storedExternalFlow)
    ? storedExternalFlow
    : []
  const externalGroups = externalFlow.map((flow: any, flowIndex: number) => {
    const approvers = (Array.isArray(flow?.approvers) ? flow.approvers : [])
      .map((approver: any, approverIndex: number) => {
        const userId = approver?.userId ?? ''
        return {
          key: personKey(`external-${flowIndex}`, userId, approverIndex),
          userId,
          name: String(approver?.name || userId || '未知审批人'),
          status: String(approver?.status || flow?.status || 'PENDING'),
          actedAt: approver?.actedAt,
          comment: approver?.comment,
        }
      })
    return {
      key: `external-${flowIndex}`,
      title: externalFlow.length > 1 ? `审批人 ${flowIndex + 1}` : '审批人',
      status: String(flow?.status || approvers[0]?.status || 'PENDING'),
      approvers,
    }
  }).filter(group => group.approvers.length)

  // Enterprise WeChat is the source of truth for externally initiated approvals.
  if (externalGroups.length)
    return externalGroups

  const tasks = Array.isArray(detail.tasks) ? detail.tasks : []
  return (Array.isArray(detail.nodes) ? detail.nodes : []).map((node: any, nodeIndex: number) => {
    const nodeTasks = tasks.filter(task => String(task?.nodeId) === String(node?.id))
    const approvers = nodeTasks.length
      ? nodeTasks.map((task, taskIndex) => ({
          key: personKey(`local-${node?.id || nodeIndex}`, task?.assigneeId, taskIndex),
          userId: task?.assigneeId,
          name: String(task?.assigneeName || resolveUserName(task?.assigneeId) || '未知审批人'),
          status: String(task?.status || node?.status || 'PENDING'),
          actedAt: task?.actedAt,
          comment: task?.comment,
        }))
      : (Array.isArray(node?.approverIds) ? node.approverIds : []).map((userId: string | number, approverIndex: number) => ({
          key: personKey(`local-${node?.id || nodeIndex}`, userId, approverIndex),
          userId,
          name: resolveUserName(userId) || String(userId),
          status: String(node?.status || 'PENDING'),
        }))

    return {
      key: String(node?.id || `local-${nodeIndex}`),
      title: String(node?.name || `审批节点 ${nodeIndex + 1}`),
      status: String(node?.status || approvers[0]?.status || 'PENDING'),
      approvers,
    }
  }).filter(group => group.approvers.length)
}

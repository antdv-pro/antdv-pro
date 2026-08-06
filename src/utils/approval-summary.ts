export interface DepartmentApprovalAmountSummary {
  departmentName: string
  amount: number
  count: number
}

const pendingApprovalStatuses = new Set(['PENDING', 'APPROVING'])

function normalizeApprovalRecord(record: Record<string, any>) {
  return record.instance ?? record
}

export function getApprovalAmount(record: Record<string, any>) {
  const approval = normalizeApprovalRecord(record)
  const candidates = [
    approval.amount,
    approval.formSnapshot?.amount,
    approval.payload?.amount,
    approval.formData?.amount,
  ]

  for (const value of candidates) {
    if (value == null || value === '')
      continue
    const amount = Number(value)
    if (Number.isFinite(amount))
      return amount
  }
  return 0
}

export function isPendingApproval(record: Record<string, any>) {
  const approval = normalizeApprovalRecord(record)
  return pendingApprovalStatuses.has(String(approval.status ?? approval.approvalStatus ?? ''))
}

export function calculatePendingApprovalAmount(records: Array<Record<string, any>>) {
  return records
    .filter(isPendingApproval)
    .reduce((total, record) => total + getApprovalAmount(record), 0)
}

export function summarizePendingApprovalAmountsByDepartment(
  records: Array<Record<string, any>>,
): DepartmentApprovalAmountSummary[] {
  const summaries = new Map<string, DepartmentApprovalAmountSummary>()

  records.filter(isPendingApproval).forEach((record) => {
    const approval = normalizeApprovalRecord(record)
    const departmentName = String(
      approval.deptName
      ?? approval.formSnapshot?.departmentName
      ?? approval.payload?.departmentName
      ?? '',
    ).trim() || '未分配部门'
    const current = summaries.get(departmentName) ?? { departmentName, amount: 0, count: 0 }
    current.amount += getApprovalAmount(approval)
    current.count += 1
    summaries.set(departmentName, current)
  })

  return Array.from(summaries.values()).sort((a, b) =>
    b.amount - a.amount || a.departmentName.localeCompare(b.departmentName, 'zh-CN'),
  )
}

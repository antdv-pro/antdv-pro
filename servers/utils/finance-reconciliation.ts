import type { ApprovalInstance } from './approval-store'
import { approvalFinancePolicy, approvalOaModuleKey } from '../../shared/approval-business-catalog'
import { approvalStore } from './approval-store'
import { oaModuleStore, updateApprovalRecord } from './oa-module-store'

export interface FinanceReconciliationItem {
  approvalId: string
  approvalCode: string
  businessType: string
  title: string
  amount: number
  target: string
}

function hasFinanceResult(instance: ApprovalInstance, modules: Record<string, Array<Record<string, any>>>) {
  const policy = approvalFinancePolicy(instance.businessType)
  if (['CREATE_PAYABLE', 'CREATE_RECEIVABLE'].includes(policy.action))
    return modules.receivable.some(row => row.sourceApprovalId === instance.id)
  if (policy.action === 'REGISTER_RECEIPT')
    return modules.cash.some(row => row.sourceApprovalId === instance.id)
  const moduleKey = approvalOaModuleKey(instance.businessType)
  return moduleKey ? modules[moduleKey].some(row => row.approvalInstanceId === instance.id || String(row.id) === String(instance.businessId)) : true
}

function targetLabel(instance: ApprovalInstance) {
  const policy = approvalFinancePolicy(instance.businessType)
  if (policy.action === 'CREATE_PAYABLE')
    return '应付台账'
  if (policy.action === 'CREATE_RECEIVABLE')
    return '应收台账'
  if (policy.action === 'REGISTER_RECEIPT')
    return '来款流水'
  return approvalOaModuleKey(instance.businessType) === 'salary' ? '工资台账' : '业务台账'
}

export async function inspectFinanceReconciliation() {
  const [instances, state] = await Promise.all([
    approvalStore.listInstances({ status: 'APPROVED', includeArchived: true }),
    oaModuleStore.getState(),
  ])
  const missing = instances
    .filter(instance => approvalFinancePolicy(instance.businessType).action !== 'NONE' || Boolean(approvalOaModuleKey(instance.businessType)))
    .filter(instance => !hasFinanceResult(instance, state.modules))
    .map<FinanceReconciliationItem>(instance => ({
      approvalId: instance.id,
      approvalCode: instance.code,
      businessType: instance.businessType,
      title: instance.title,
      amount: Number(instance.amount || 0),
      target: targetLabel(instance),
    }))
  return { approvedCount: instances.length, missingCount: missing.length, missing }
}

export async function reconcileApprovedFinanceRecords() {
  const before = await inspectFinanceReconciliation()
  const instances = await approvalStore.listInstances({ status: 'APPROVED', includeArchived: true })
  const missingIds = new Set(before.missing.map(item => item.approvalId))
  for (const instance of instances.filter(item => missingIds.has(item.id)))
    await updateApprovalRecord(instance, '已确认')
  const after = await inspectFinanceReconciliation()
  return { ...after, repairedCount: before.missingCount - after.missingCount, repaired: before.missing }
}

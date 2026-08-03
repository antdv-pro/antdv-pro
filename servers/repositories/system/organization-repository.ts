import type { OrganizationNode } from '../../utils/system-store'
import type { AuditOperation } from './types'

function organizationTypeName(type: OrganizationNode['type']) {
  return type === 'company' ? '公司' : type === 'department' ? '部门' : '岗位'
}

export function listOrganizationRecords(items: OrganizationNode[]) {
  return [...items].sort((a, b) => a.sortNo - b.sortNo)
}

export function saveOrganizationRecord(items: OrganizationNode[], payload: Partial<OrganizationNode>, nextId: (type: OrganizationNode['type']) => string) {
  let item = payload.id ? items.find(record => record.id === payload.id) : undefined
  let operation: AuditOperation
  if (!item) {
    const type = payload.type ?? 'department'
    item = {
      id: nextId(type),
      parentId: payload.parentId,
      type,
      name: String(payload.name ?? ''),
      code: String(payload.code ?? ''),
      leaderId: payload.leaderId,
      leaderName: payload.leaderName,
      sortNo: Number(payload.sortNo ?? items.length + 1),
      status: payload.status ?? 'enabled',
      remark: payload.remark,
    }
    items.push(item)
    operation = { module: '组织架构', action: 'create', content: `新增${organizationTypeName(item.type)} ${item.name}`, targetId: item.id }
  }
  else {
    Object.assign(item, payload)
    operation = { module: '组织架构', action: 'update', content: `编辑组织 ${item.name}`, targetId: item.id }
  }
  return { item, operation }
}

export function deleteOrganizationRecord(items: OrganizationNode[], id: string) {
  const index = items.findIndex(item => item.id === id)
  if (index < 0)
    throw new Error('组织不存在')
  if (items.some(item => item.parentId === id))
    throw new Error('存在下级组织，不能删除')
  const [item] = items.splice(index, 1)
  return {
    item,
    operation: { module: '组织架构', action: 'delete', content: `删除组织 ${item.name}`, targetId: item.id } satisfies AuditOperation,
  }
}

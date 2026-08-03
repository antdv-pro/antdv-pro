import type { OrganizationNode } from '~@/api/system'

export interface OrganizationTreeNode extends OrganizationNode {
  key: string
  title: string
  memberCount: number
  children: OrganizationTreeNode[]
}

export function getOrganizationTreeKey(item: Pick<OrganizationNode, 'id' | 'type'>) {
  return `${item.type}:${item.id}`
}

export function buildOrganizationTree(
  list: OrganizationNode[],
  getMemberCount: (item: OrganizationNode) => number,
): OrganizationTreeNode[] {
  const nodesByParent = new Map<string, OrganizationNode[]>()

  for (const item of list) {
    const parentKey = getExpectedParentKey(item, list)
    const siblings = nodesByParent.get(parentKey) || []
    siblings.push(item)
    nodesByParent.set(parentKey, siblings)
  }

  const buildChildren = (parentKey: string): OrganizationTreeNode[] => (nodesByParent.get(parentKey) || [])
    .sort((a, b) => a.sortNo - b.sortNo)
    .map(item => ({
      ...item,
      key: getOrganizationTreeKey(item),
      title: item.name,
      memberCount: getMemberCount(item),
      children: buildChildren(getOrganizationTreeKey(item)),
    }))

  return buildChildren('root')
}

function getExpectedParentKey(item: OrganizationNode, list: OrganizationNode[]) {
  if (item.type === 'company' || !item.parentId)
    return 'root'
  if (item.type === 'post')
    return `department:${item.parentId}`
  const hasDepartmentParent = list.some(parent =>
    parent.type === 'department'
    && String(parent.id) === String(item.parentId)
    && String(parent.id) !== String(item.id),
  )
  return `${hasDepartmentParent ? 'department' : 'company'}:${item.parentId}`
}

import type { AuditOperation } from '../../repositories/system/types'
import type { OrganizationNode, SystemUser } from '../../utils/system-store'

interface OrganizationState {
  organizations: OrganizationNode[]
}

export async function resolveUserOrganizations(
  state: OrganizationState,
  payload: Partial<SystemUser>,
  dependencies: {
    nextId: (type: 'department' | 'post') => string
    saveOrganization: (organization: OrganizationNode) => Promise<string | undefined>
    recordOperation: (operation: AuditOperation) => void
  },
) {
  const company = state.organizations.find(item => String(item.id) === String(payload.companyId ?? ''))
    || state.organizations.find(item => item.type === 'company')

  let dept = state.organizations.find(item =>
    item.type === 'department' && String(item.id) === String(payload.deptId ?? ''),
  )
  const inputDeptName = String(payload.deptName ?? '').trim()
  if (!dept && inputDeptName) {
    dept = state.organizations.find(item => item.type === 'department' && item.name === inputDeptName)
    if (!dept) {
      dept = {
        id: dependencies.nextId('department'),
        parentId: String(company?.id ?? ''),
        type: 'department',
        name: inputDeptName,
        code: `DEPT${String(state.organizations.filter(item => item.type === 'department').length + 1).padStart(3, '0')}`,
        sortNo: state.organizations.length + 1,
        status: 'enabled',
        remark: '用户保存时自动创建',
      }
      state.organizations.push(dept)
      const dbId = await dependencies.saveOrganization(dept)
      if (dbId)
        dept.id = String(dbId)
      dependencies.recordOperation({ module: '组织架构', action: 'create', content: `新增部门 ${dept.name}`, targetId: dept.id })
    }
  }

  let post = state.organizations.find(item =>
    item.type === 'post'
    && String(item.id) === String(payload.postId ?? '')
    && String(item.parentId) === String(dept?.id ?? ''),
  )
  const inputPostName = String(payload.postName ?? '').trim()
  if (!post && inputPostName) {
    post = state.organizations.find(item => item.type === 'post' && item.parentId === dept?.id && item.name === inputPostName)
    if (!post) {
      post = {
        id: dependencies.nextId('post'),
        parentId: String(dept?.id ?? company?.id ?? ''),
        type: 'post',
        name: inputPostName,
        code: `POST${String(state.organizations.filter(item => item.type === 'post').length + 1).padStart(3, '0')}`,
        sortNo: state.organizations.length + 1,
        status: 'enabled',
        remark: '用户保存时自动创建',
      }
      state.organizations.push(post)
      const dbId = await dependencies.saveOrganization(post)
      if (dbId)
        post.id = String(dbId)
      dependencies.recordOperation({ module: '组织架构', action: 'create', content: `新增岗位 ${post.name}`, targetId: post.id })
    }
  }

  return { company, dept, post }
}

import type { ApprovalTemplate } from './types'
import { approvalStore } from '../../utils/approval-store'

export const approvalTemplateRepository = {
  list: () => approvalStore.listTemplates(),
  create: (input: Pick<ApprovalTemplate, 'name' | 'businessTypes' | 'nodes'>) => approvalStore.createTemplate(input),
}

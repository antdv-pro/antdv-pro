import { approvalTemplateRepository } from '../../repositories/approval/template-repository'

export const approvalTemplateService = {
  list: () => approvalTemplateRepository.list(),
  create: (input: Parameters<typeof approvalTemplateRepository.create>[0]) => approvalTemplateRepository.create(input),
}

import type { OaModuleState, OaStatePartition } from '../../utils/oa-module-store'
import { oaModuleStore } from '../../utils/oa-module-store'

export const approvalOaStateService = {
  get: () => oaModuleStore.getState(),
  replace: (input: Partial<OaModuleState>) => oaModuleStore.replaceState(input),
  replacePartition: (partition: OaStatePartition, rows: unknown, revision: number) => oaModuleStore.replacePartition(partition, rows, revision),
}

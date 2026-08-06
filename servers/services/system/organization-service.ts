import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { systemStore } from '../../utils/system-store'

export const systemOrganizationService = {
  list: () => systemStore.listOrganizations(),
  save: (event: H3Event, payload: Record<string, unknown>) => systemStore.saveOrganization(payload, getRequestHeader(event, 'Authorization')),
  remove: (event: H3Event, id: string) => systemStore.deleteOrganization(id, getRequestHeader(event, 'Authorization')),
}

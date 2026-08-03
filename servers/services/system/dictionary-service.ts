import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { systemStore } from '../../utils/system-store'

export const systemDictionaryService = {
  list: (query: Record<string, unknown>) => systemStore.listDictionaries(query),
  save: (event: H3Event, payload: Record<string, unknown>) => systemStore.saveDictionary(payload, getRequestHeader(event, 'Authorization')),
  remove: (event: H3Event, id: string) => systemStore.deleteDictionary(id, getRequestHeader(event, 'Authorization')),
}

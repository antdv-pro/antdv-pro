import type { DictionaryItem } from './models'

export function getSystemDictionariesApi(params?: { type?: string }) {
  return useGet<DictionaryItem[]>('/system/dicts', params)
}

export function saveSystemDictionaryApi(data: Partial<DictionaryItem>) {
  return usePost<DictionaryItem, Partial<DictionaryItem>>('/system/dicts/save', data)
}

export function deleteSystemDictionaryApi(id: string) {
  return useDelete(`/system/dicts/${id}`)
}

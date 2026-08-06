import type { DictionaryItem } from '~@/api/system'
import { getSystemDictionariesApi } from '~@/api/system'
import { businessDictionaryDefaults, defaultBusinessDictionaryValues } from '../../shared/business-dictionaries'

const dictionaryItems = shallowRef<DictionaryItem[]>([])
const dictionaryLoading = ref(false)
let loaded = false
let pendingRequest: Promise<void> | undefined

export async function loadBusinessDictionaries(force = false) {
  if (loaded && !force)
    return
  if (pendingRequest)
    return pendingRequest

  pendingRequest = (async () => {
    dictionaryLoading.value = true
    try {
      const result = await getSystemDictionariesApi()
      if (result.code !== 200)
        throw new Error(result.msg || '业务主数据加载失败')
      dictionaryItems.value = (result.data || []).filter(item => item.status === 'enabled')
      loaded = true
    }
    catch {
      dictionaryItems.value = businessDictionaryDefaults as DictionaryItem[]
    }
    finally {
      dictionaryLoading.value = false
      pendingRequest = undefined
    }
  })()
  return pendingRequest
}

export function invalidateBusinessDictionaries() {
  loaded = false
}

export function useBusinessDictionaries() {
  function values(type: string) {
    const configured = dictionaryItems.value
      .filter(item => item.type === type && item.status === 'enabled')
      .sort((a, b) => a.sortNo - b.sortNo)
      .map(item => item.value)
    return configured.length ? configured : defaultBusinessDictionaryValues(type)
  }

  function options(type: string) {
    const configured = dictionaryItems.value
      .filter(item => item.type === type && item.status === 'enabled')
      .sort((a, b) => a.sortNo - b.sortNo)
      .map(item => ({ label: item.label, value: item.value }))
    return configured.length
      ? configured
      : defaultBusinessDictionaryValues(type).map(value => ({ label: value, value }))
  }

  function setting(type: string, label: string, fallback: string) {
    return dictionaryItems.value.find(item => item.type === type && item.label === label && item.status === 'enabled')?.value || fallback
  }

  return {
    loading: readonly(dictionaryLoading),
    values,
    options,
    setting,
    load: loadBusinessDictionaries,
  }
}

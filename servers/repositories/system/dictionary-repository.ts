import type { DictionaryItem } from '../../utils/system-store'
import type { AuditOperation } from './types'

export function listDictionaryRecords(items: DictionaryItem[], type = '') {
  return items.filter(item => !type || item.type === type).sort((a, b) => a.sortNo - b.sortNo)
}

export function saveDictionaryRecord(items: DictionaryItem[], payload: Partial<DictionaryItem>, nextId: () => string) {
  let item = payload.id ? items.find(record => record.id === payload.id) : undefined
  let operation: AuditOperation
  if (!item) {
    item = {
      id: nextId(),
      type: String(payload.type ?? ''),
      typeName: String(payload.typeName ?? ''),
      label: String(payload.label ?? ''),
      value: String(payload.value ?? ''),
      sortNo: Number(payload.sortNo ?? items.length + 1),
      status: payload.status ?? 'enabled',
      remark: payload.remark,
    }
    items.push(item)
    operation = { module: '系统字典', action: 'create', content: `新增字典 ${item.typeName}-${item.label}`, targetId: item.id }
  }
  else {
    Object.assign(item, payload)
    operation = { module: '系统字典', action: 'update', content: `编辑字典 ${item.typeName}-${item.label}`, targetId: item.id }
  }
  return { item, operation }
}

export function deleteDictionaryRecord(items: DictionaryItem[], id: string) {
  const index = items.findIndex(item => item.id === id)
  if (index < 0)
    throw new Error('字典不存在')
  const [item] = items.splice(index, 1)
  return {
    item,
    operation: { module: '系统字典', action: 'delete', content: `删除字典 ${item.typeName}-${item.label}`, targetId: item.id } satisfies AuditOperation,
  }
}

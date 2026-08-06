import type { ImportConfirmState } from '~@/types/import'
import { createImportConfirmState } from '~@/utils/import-progress'

export type TransportImportKind = 'order' | 'fuel' | 'etc' | 'base'

export function useTransportImportState() {
  const batchFilePickerKind = ref<'fuel' | 'etc'>('etc')
  return {
    importPreview: reactive<ImportConfirmState>(createImportConfirmState()),
    pendingImportApply: shallowRef<(rows: Array<Record<string, string>>) => void | Promise<void>>(),
    pendingImportPersist: ref(true),
    batchFilePickerOpen: ref(false),
    batchFilePickerKind,
    batchSelectedFiles: ref<File[]>([]),
    batchFilePickerTitle: computed(() => batchFilePickerKind.value === 'fuel' ? '选择油卡记录文件' : '选择ETC费用发票明细文件'),
  }
}

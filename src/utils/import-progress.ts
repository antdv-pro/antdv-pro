import type { ImportConfirmState, ImportStatus, ImportTableColumn } from '~@/types/import'

export function getImportStatusText(status: ImportStatus) {
  const statusMap: Record<ImportStatus, string> = {
    idle: '待解析',
    parsing: '解析中',
    pending: '待确认',
    importing: '导入中',
    completed: '导入完成',
    failed: '导入失败',
  }
  return statusMap[status]
}

export function formatImportFileSize(size?: number) {
  if (!size)
    return '-'
  if (size < 1024)
    return `${size} B`
  if (size < 1024 * 1024)
    return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

export function createImportConfirmState(): ImportConfirmState {
  return {
    open: false,
    title: '导入确认',
    fileName: '',
    fileSize: 0,
    fileSizeText: '-',
    summaryNo: '',
    totalRecords: 0,
    validRecords: 0,
    errorRecords: 0,
    duplicateRecords: 0,
    pendingCreate: 0,
    pendingUpdate: 0,
    status: 'idle',
    statusText: getImportStatusText('idle'),
    canConfirm: false,
    errorDetails: [],
    duplicateDetails: [],
    previewRows: [],
    selectedRowKeys: [],
    columns: [],
    progress: 0,
    processedRecords: 0,
    successCount: 0,
    failedCount: 0,
  }
}

export function setImportParsingState(
  state: ImportConfirmState,
  options: {
    title: string
    fileName: string
    fileSize?: number
    columns?: ImportTableColumn[]
  },
) {
  Object.assign(state, createImportConfirmState(), {
    open: true,
    title: options.title,
    fileName: options.fileName,
    fileSize: options.fileSize ?? 0,
    fileSizeText: formatImportFileSize(options.fileSize),
    status: 'parsing',
    statusText: getImportStatusText('parsing'),
    columns: options.columns ?? [],
  })
}

export function setImportPendingState(
  state: ImportConfirmState,
  options: {
    title: string
    fileName: string
    fileSize?: number
    rows: Array<Record<string, unknown>>
    columns: ImportTableColumn[]
    errorDetails?: string[]
    duplicateDetails?: string[]
    summaryNo?: string
  },
) {
  const errorDetails = options.errorDetails ?? []
  const duplicateDetails = options.duplicateDetails ?? []
  const validRecords = options.rows.length
  const status: ImportStatus = errorDetails.length && !validRecords ? 'failed' : 'pending'

  Object.assign(state, {
    open: true,
    title: options.title,
    fileName: options.fileName,
    fileSize: options.fileSize ?? 0,
    fileSizeText: formatImportFileSize(options.fileSize),
    totalRecords: validRecords + errorDetails.length,
    validRecords,
    errorRecords: errorDetails.length,
    duplicateRecords: duplicateDetails.length,
    pendingCreate: validRecords,
    pendingUpdate: 0,
    status,
    statusText: getImportStatusText(status),
    canConfirm: status === 'pending' && validRecords > 0,
    errorDetails,
    duplicateDetails,
    summaryNo: options.summaryNo ?? '',
    previewRows: options.rows,
    selectedRowKeys: options.rows.map((row, index) => String(row.code ?? `import-row-${index}`)),
    columns: options.columns,
    progress: 0,
    processedRecords: 0,
    successCount: 0,
    failedCount: 0,
  })
}

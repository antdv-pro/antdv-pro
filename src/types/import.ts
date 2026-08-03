export type ImportStatus = 'idle' | 'parsing' | 'pending' | 'importing' | 'completed' | 'failed'

export interface ImportTableColumn {
  title: string
  dataIndex: string
  width?: number
  align?: 'left' | 'center' | 'right'
}

export interface ImportConfirmState {
  open: boolean
  title: string
  fileName: string
  fileSize: number
  fileSizeText: string
  summaryNo?: string
  totalRecords: number
  validRecords: number
  errorRecords: number
  duplicateRecords: number
  pendingCreate: number
  pendingUpdate: number
  status: ImportStatus
  statusText: string
  canConfirm: boolean
  errorDetails: string[]
  duplicateDetails: string[]
  previewRows: Array<Record<string, unknown>>
  selectedRowKeys: Array<string | number>
  columns: ImportTableColumn[]
  progress: number
  processedRecords: number
  successCount: number
  failedCount: number
}

import { describe, expect, it } from 'vitest'
import { createImportConfirmState, formatImportFileSize, getImportStatusText, setImportParsingState, setImportPendingState } from './import-progress'

describe('import progress', () => {
  it('formats statuses and file sizes', () => {
    expect(getImportStatusText('completed')).toBe('导入完成')
    expect(formatImportFileSize()).toBe('-')
    expect(formatImportFileSize(512)).toBe('512 B')
    expect(formatImportFileSize(1536)).toBe('1.5 KB')
    expect(formatImportFileSize(2 * 1024 * 1024)).toBe('2.00 MB')
  })

  it('resets stale state when parsing starts', () => {
    const state = createImportConfirmState()
    state.successCount = 9
    setImportParsingState(state, { title: '车辆导入', fileName: 'cars.xlsx', fileSize: 2048 })
    expect(state).toMatchObject({ open: true, title: '车辆导入', fileName: 'cars.xlsx', fileSizeText: '2.0 KB', status: 'parsing', successCount: 0 })
  })

  it('builds a confirmable pending summary with stable row keys', () => {
    const state = createImportConfirmState()
    setImportPendingState(state, {
      title: '导入',
      fileName: 'data.xlsx',
      rows: [{ code: 'A' }, { name: 'B' }],
      columns: [],
      duplicateDetails: ['A 已存在'],
      errorDetails: ['第 3 行错误'],
      summaryNo: '26617903020500031627',
    })
    expect(state).toMatchObject({ totalRecords: 3, validRecords: 2, errorRecords: 1, duplicateRecords: 1, pendingCreate: 2, pendingUpdate: 0, status: 'pending', canConfirm: true, summaryNo: '26617903020500031627' })
    expect(state.selectedRowKeys).toEqual(['A', 'import-row-1'])
  })

  it('marks an import failed when every row is invalid', () => {
    const state = createImportConfirmState()
    setImportPendingState(state, { title: '导入', fileName: 'bad.xlsx', rows: [], columns: [], errorDetails: ['格式错误'] })
    expect(state).toMatchObject({ status: 'failed', canConfirm: false, totalRecords: 1 })
  })
})

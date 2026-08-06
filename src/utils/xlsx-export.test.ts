import { describe, expect, it } from 'vitest'
import { createWorkbook } from './xlsx-export'

describe('xlsx export utility', () => {
  it('creates named sheets in one workbook', () => {
    const workbook = createWorkbook([
      { name: '筛选条件', rows: [{ 状态: '启用' }] },
      { name: '数据', rows: [{ 编号: 1 }] },
    ])
    expect(workbook.SheetNames).toEqual(['筛选条件', '数据'])
    expect(workbook.Sheets['筛选条件']?.A2?.v).toBe('启用')
    expect(workbook.Sheets['数据']?.A2?.v).toBe(1)
  })

  it('rejects a workbook without sheets', () => {
    expect(() => createWorkbook([])).toThrow('至少需要一个工作表')
  })
})

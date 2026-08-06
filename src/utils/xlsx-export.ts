import * as XLSX from 'xlsx'

export interface WorkbookSheet {
  name: string
  rows: Array<Record<string, unknown>>
}

export function createWorkbook(sheets: WorkbookSheet[]) {
  if (!sheets.length)
    throw new Error('导出工作簿至少需要一个工作表')
  const workbook = XLSX.utils.book_new()
  sheets.forEach((sheet) => {
    const name = String(sheet.name || 'Sheet').slice(0, 31)
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet.rows), name)
  })
  return workbook
}

export function downloadWorkbook(filename: string, sheets: WorkbookSheet[]) {
  const workbook = createWorkbook(sheets)
  XLSX.writeFile(workbook, filename)
}

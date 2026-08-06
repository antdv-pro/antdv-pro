import type { RegulatoryFeePayload } from '~@/api/transport/fees'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

export interface RegulatoryFeeImportRow extends RegulatoryFeePayload {
  rowNumber: number
}

export interface RegulatoryFeeImportResult {
  records: RegulatoryFeeImportRow[]
  errors: string[]
}

const aliases = {
  feeType: ['规费类型', '费用类型', 'feeType'],
  plateNo: ['车号', '车牌号', 'plateNo'],
  trailerNo: ['挂号', '挂车号', 'trailerNo'],
  area: ['所在区域', '区域', 'area'],
  totalAmount: ['单项总费用', '总费用', '金额', 'totalAmount'],
  validStartDate: ['有效期开始日期', '开始日期', 'validStartDate'],
  validEndDate: ['有效期截止日期', '截止日期', 'validEndDate'],
  remark: ['备注', 'remark'],
} as const

function getCell(row: Record<string, unknown>, names: readonly string[]) {
  const key = Object.keys(row).find(item => names.includes(item.trim()))
  return key ? row[key] : ''
}

function parseDate(value: unknown) {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed)
      return dayjs(`${parsed.y}-${parsed.m}-${parsed.d}`).format('YYYY-MM-DD')
  }
  const date = dayjs(String(value || '').trim())
  return date.isValid() ? date.format('YYYY-MM-DD') : ''
}

export function parseRegulatoryFeeWorkbook(workbook: XLSX.WorkBook, allowedFeeTypes: string[]): RegulatoryFeeImportResult {
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!worksheet)
    return { records: [], errors: ['未识别到可导入的工作表'] }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '', raw: true })
  const records: RegulatoryFeeImportRow[] = []
  const errors: string[] = []
  const importedKeys = new Map<string, number>()

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const feeType = String(getCell(row, aliases.feeType)).trim()
    const plateNo = String(getCell(row, aliases.plateNo)).trim().replace('.', '·')
    const totalAmount = Number(getCell(row, aliases.totalAmount))
    const validStartDate = parseDate(getCell(row, aliases.validStartDate))
    const validEndDate = parseDate(getCell(row, aliases.validEndDate))
    const rowErrors: string[] = []

    if (!feeType)
      rowErrors.push('规费类型为空')
    else if (!allowedFeeTypes.includes(feeType))
      rowErrors.push(`规费类型“${feeType}”不在可选范围内`)
    if (!plateNo)
      rowErrors.push('车号为空')
    if (!Number.isFinite(totalAmount) || totalAmount < 0)
      rowErrors.push('单项总费用必须为非负数')
    if (!validStartDate)
      rowErrors.push('有效期开始日期无效')
    if (!validEndDate)
      rowErrors.push('有效期截止日期无效')
    if (validStartDate && validEndDate && dayjs(validEndDate).isBefore(validStartDate, 'day'))
      rowErrors.push('截止日期早于开始日期')

    if (rowErrors.length) {
      errors.push(`第 ${rowNumber} 行：${rowErrors.join('；')}`)
      return
    }

    const record = {
      rowNumber,
      feeName: feeType,
      feeType,
      plateNo,
      trailerNo: String(getCell(row, aliases.trailerNo)).trim().replace('.', '·'),
      area: String(getCell(row, aliases.area)).trim(),
      totalAmount,
      validStartDate,
      validEndDate,
      remark: String(getCell(row, aliases.remark)).trim(),
    }
    const duplicateKey = [feeType, plateNo, record.trailerNo, validStartDate, validEndDate].join('\u0001')
    const firstRowNumber = importedKeys.get(duplicateKey)
    if (firstRowNumber) {
      errors.push(`第 ${rowNumber} 行：与第 ${firstRowNumber} 行重复，禁止导入`)
      return
    }
    importedKeys.set(duplicateKey, rowNumber)
    records.push(record)
  })

  if (!rows.length)
    errors.push('工作表中没有数据行')
  return { records, errors }
}

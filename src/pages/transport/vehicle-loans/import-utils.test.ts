import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import { getLoanApprovalAmount, parseVehicleLoanWorkbook } from './import-utils'

describe('parseVehicleLoanWorkbook', () => {
  it('imports contract details and yellow repayment rows', () => {
    const rows = [
      ['租赁合同号', 'C-001', null, null, '计息本金(元)', 100000],
      ['起息日', 46000, null, null, '租赁期限(月)', 2],
      ['车队', '诚捷'],
      ['主车车牌号', '青H12345/青H6789挂'],
      ['收款人名称', '一汽租赁有限公司'],
      ['序号', '应还款日期', '客户应还本金', '客户应还利息', null, '客户应还金额合计'],
      [1, 46030, 49000, 1000, null, 50000],
      [2, 46060, 49500, 500, null, 50000],
    ]
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    ;(sheet.A7 as any).s = { fgColor: { rgb: 'FFFFFF00' } }
    const summary = XLSX.utils.aoa_to_sheet([['序号'], [1], [2]])
    ;(summary.A2 as any).s = { fgColor: { rgb: 'FFFFFF00' } }
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, summary, '总表')
    XLSX.utils.book_append_sheet(workbook, sheet, '合同1')

    const [record] = parseVehicleLoanWorkbook(workbook, 10)
    expect(record).toMatchObject({ id: 10, contractNo: 'C-001', plateNo: '青H12345', trailerNo: '青H6789', loanAmount: 100000, monthlyPayment: 50000 })
    expect(record.payments).toHaveLength(1)
    expect(record.payments[0]).toMatchObject({ periodNo: 1, amount: 50000, principal: 49000, interest: 1000 })
    expect(getLoanApprovalAmount(record)).toBe(50000)
  })
})

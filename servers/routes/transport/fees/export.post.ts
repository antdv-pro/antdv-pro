import { defineEventHandler, readBody } from 'h3'
import { listRegulatoryFees } from '../../../utils/regulatory-fee-store'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER', 'DEPT_LEADER'])
  const body = await readBody(event)
  const data = await listRegulatoryFees({
    ...body,
    current: 1,
    pageSize: 10000,
  })

  return {
    code: 200,
    msg: '导出成功',
    data: data.records.map(record => ({
      feeType: record.feeType,
      plateNo: record.plateNo,
      trailerNo: record.trailerNo,
      area: record.area,
      totalAmount: record.totalAmount,
      validStartDate: record.validStartDate,
      validEndDate: record.validEndDate,
      validMonths: record.validMonths,
      monthlyAmortizedAmount: record.monthlyAmortizedAmount,
      status: record.status,
      remark: record.remark,
    })),
  }
})

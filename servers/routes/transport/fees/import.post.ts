import { defineEventHandler, readBody } from 'h3'
import { importRegulatoryFees } from '../../../utils/regulatory-fee-store'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  try {
    const body = await readBody(event)
    const records = await importRegulatoryFees(body?.records)
    return { code: 200, msg: '导入成功', data: { importedCount: records.length, records } }
  }
  catch (error: any) {
    return { code: 400, msg: error.message || '导入失败' }
  }
})

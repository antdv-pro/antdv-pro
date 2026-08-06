import { defineEventHandler, readBody } from 'h3'
import { billReconciliationStore } from '../../../../utils/bill-reconciliation-store'
import { requireAnyRole } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  try {
    const body = await readBody(event)
    return {
      code: 200,
      msg: '保存成功',
      data: await billReconciliationStore.save(body),
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error?.message || '保存失败',
    }
  }
})

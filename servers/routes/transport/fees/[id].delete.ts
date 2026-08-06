import { defineEventHandler } from 'h3'
import { deleteRegulatoryFee } from '../../../utils/regulatory-fee-store'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  try {
    const id = Number(event.context.params?.id)
    await deleteRegulatoryFee(id)

    return {
      code: 200,
      msg: '删除成功',
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error.message || '删除失败',
    }
  }
})

import { defineEventHandler, readBody } from 'h3'
import { updateRegulatoryFee } from '../../../utils/regulatory-fee-store'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  try {
    const id = Number(event.context.params?.id)
    const body = await readBody(event)

    return {
      code: 200,
      msg: '编辑成功',
      data: await updateRegulatoryFee(id, body),
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error.message || '编辑失败',
    }
  }
})

import { defineEventHandler, readBody } from 'h3'
import { createRegulatoryFee } from '../../../utils/regulatory-fee-store'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  try {
    const body = await readBody(event)
    return {
      code: 200,
      msg: '创建成功',
      data: await createRegulatoryFee(body),
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error.message || '创建失败',
    }
  }
})

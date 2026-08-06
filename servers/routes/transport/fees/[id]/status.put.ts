import { defineEventHandler, readBody } from 'h3'
import { changeRegulatoryFeeManualStatus } from '../../../../utils/regulatory-fee-store'
import { requireAnyRole } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  try {
    const id = Number(event.context.params?.id)
    const body = await readBody(event)

    return {
      code: 200,
      msg: '状态更新成功',
      data: await changeRegulatoryFeeManualStatus(id, body.manualStatus),
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error.message || '状态更新失败',
    }
  }
})

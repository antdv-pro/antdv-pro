import { defineEventHandler } from 'h3'
import { getRegulatoryFee } from '../../../utils/regulatory-fee-store'

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const data = await getRegulatoryFee(id)

  return data
    ? { code: 200, msg: '获取成功', data }
    : { code: 404, msg: '规费不存在' }
})

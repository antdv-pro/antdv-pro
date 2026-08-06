import { defineEventHandler, readBody } from 'h3'
import { summarizeRegulatoryFees } from '../../../utils/regulatory-fee-store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return {
    code: 200,
    msg: '获取成功',
    data: await summarizeRegulatoryFees(body),
  }
})

import { defineEventHandler } from 'h3'
import { billReconciliationStore } from '../../../../utils/bill-reconciliation-store'

export default defineEventHandler(async () => {
  return {
    code: 200,
    msg: '获取成功',
    data: await billReconciliationStore.list(),
  }
})

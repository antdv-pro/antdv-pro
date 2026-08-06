import { defineEventHandler, readBody } from 'h3'
import { systemLogService } from '../../../services/system/log-service'
import { asBadRequest, fail, ok } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'
import { tradeOrderStore } from '../../../utils/trade-order-store'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
  try {
    const body = await readBody(event)
    const before = await tradeOrderStore.list()
    const beforeCodes = new Set(before.map(item => item.code))
    const data = body && ('upsert' in body || 'deleteCodes' in body)
      ? await tradeOrderStore.applyChanges(body)
      : await tradeOrderStore.replace(body?.rows ?? body)
    const upsert = Array.isArray(body?.upsert) ? body.upsert : []
    const deleted = Array.isArray(body?.deleteCodes) ? body.deleteCodes.map(String) : []
    for (const row of upsert) {
      const code = String(row?.code || '')
      if (!code)
        continue
      systemLogService.record(event, {
        module: '贸易订单',
        action: beforeCodes.has(code) ? 'update' : 'create',
        content: `${beforeCodes.has(code) ? '修改' : '新增'}贸易订单 ${code}`,
        targetId: code,
      })
    }
    for (const code of deleted) {
      systemLogService.record(event, { module: '贸易订单', action: 'delete', content: `删除贸易订单 ${code}`, targetId: code })
    }
    if (!upsert.length && !deleted.length)
      systemLogService.record(event, { module: '贸易订单', action: 'update', content: '批量更新贸易订单' })
    return ok(data, '保存成功')
  }
  catch (error: any) {
    return fail(event, asBadRequest(error), '贸易订单保存失败')
  }
})

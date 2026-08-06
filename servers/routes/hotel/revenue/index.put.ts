import { defineEventHandler, readBody } from 'h3'
import { systemLogService } from '../../../services/system/log-service'
import { hotelRevenueStore } from '../../../utils/hotel-revenue-store'
import { badRequest, fail, ok } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  const user = requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  try {
    const body = await readBody(event)
    const date = String(body?.date || '')
    if (!date)
      badRequest('date 不能为空')
    const before = await hotelRevenueStore.list(date, user.companyId)
    const beforeIds = new Set(before.map(item => item.id))
    const data = body && ('upsert' in body || 'deleteIds' in body)
      ? await hotelRevenueStore.applyChanges(date, body, user.companyId, user.deptId, user.id)
      : await hotelRevenueStore.replaceByDate(date, body?.rows ?? [], user.companyId, user.deptId, user.id)
    const upsert = Array.isArray(body?.upsert) ? body.upsert : []
    const deleted = Array.isArray(body?.deleteIds) ? body.deleteIds.map(String) : []
    for (const row of upsert) {
      const id = String(row?.id || '')
      if (!id)
        continue
      systemLogService.record(event, {
        module: '酒店流水',
        action: beforeIds.has(id) ? 'update' : 'create',
        content: `${beforeIds.has(id) ? '修改' : '新增'}酒店${row?.type || '营业'}流水 ${date} ${row?.amount || 0} 元`,
        targetId: id,
      })
    }
    for (const id of deleted)
      systemLogService.record(event, { module: '酒店流水', action: 'delete', content: `删除酒店流水 ${date} ${id}`, targetId: id })
    if (!upsert.length && !deleted.length)
      systemLogService.record(event, { module: '酒店流水', action: 'update', content: `批量更新酒店流水 ${date}` })
    return ok(data, '保存成功')
  }
  catch (error: any) {
    return fail(event, error, '酒店营收保存失败')
  }
})

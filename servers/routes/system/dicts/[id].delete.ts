import { defineEventHandler } from 'h3'
import { systemDictionaryService } from '../../../services/system/dictionary-service'

export default defineEventHandler(async (event) => {
  try {
    await systemDictionaryService.remove(event, String(event.context.params?.id))
    return { code: 200, msg: '删除成功' }
  }
  catch (error: any) {
    event.res.status = 400
    return { code: 400, msg: error?.message || '删除失败' }
  }
})

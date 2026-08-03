import { defineEventHandler, getQuery } from 'h3'
import { systemDictionaryService } from '../../../services/system/dictionary-service'

export default defineEventHandler(async (event) => {
  return { code: 200, msg: '获取成功', data: await systemDictionaryService.list(getQuery(event)) }
})

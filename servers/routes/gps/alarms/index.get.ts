import { defineEventHandler, getQuery } from 'h3'
import { gpsAlarmService } from '../../../services/gps/alarm-service'
import { getTrustedAccessQuery } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  return {
    code: 200,
    msg: '获取成功',
    data: await gpsAlarmService.list({ ...getQuery(event), ...getTrustedAccessQuery(event) }),
  }
})

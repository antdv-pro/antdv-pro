import { defineEventHandler } from 'h3'
import { requireAuthenticatedUser } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAuthenticatedUser(event)
  return { code: 400, msg: '审批单请在企业微信填写并发起，管理系统仅同步展示审批进度和结果' }
})

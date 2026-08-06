import { getQuery } from 'h3'
import { approvalTaskService } from '../../../services/approval/task-service'
import { defineApprovalHandler } from '../../../utils/approval-route'
import { getCurrentUserId } from '../../../utils/current-user'

export default defineApprovalHandler('tasks/todo', async (event) => {
  const query = getQuery(event)
  const userId = getCurrentUserId(event)
  return {
    code: 200,
    msg: '获取成功',
    data: userId ? await approvalTaskService.listTodo(userId, query) : [],
  }
})

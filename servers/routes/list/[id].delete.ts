import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  const id = event.context.params?.id as any
  if (typeof id !== 'number') {
    event.res.status = 403
    return {
      code: 403,
      msg: '删除失败',
    }
  }
  return {
    code: 200,
    msg: '删除成功',
  }
})

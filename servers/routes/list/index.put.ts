import { defineEventHandler } from 'h3'

export default defineEventHandler(async (_event) => {
  return {
    code: 200,
    msg: '编辑成功',
  }
})

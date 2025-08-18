import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return {
    code: 200,
    msg: 'put',
  }
})

import { defineEventHandler } from 'h3'
import { runtimeConfig } from '../utils/runtime-config'

export default defineEventHandler(() => {
  return {
    code: 200,
    msg: 'ok',
    data: {
      env: runtimeConfig.app.nodeEnv,
      time: new Date().toISOString(),
    },
  }
})

import { defineEventHandler } from 'h3'
import { validateProductionConfig } from '../utils/runtime-config'
import { applySecurityHeaders, requireAuth } from '../utils/security'

let configChecked = false

export default defineEventHandler((event) => {
  if (!configChecked) {
    validateProductionConfig()
    configChecked = true
  }

  applySecurityHeaders(event)
  return requireAuth(event)
})

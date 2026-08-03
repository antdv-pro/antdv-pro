import type { EventHandler, H3Event } from 'h3'
import { defineEventHandler, getRequestURL } from 'h3'

function logApprovalError(event: H3Event, label: string, error: unknown) {
  const url = getRequestURL(event)
  const method = event.req.method || 'UNKNOWN'
  console.error(`[approval] ${label} failed: ${method} ${url.pathname}${url.search}`, error)
}

export function defineApprovalHandler<T>(label: string, handler: (event: H3Event) => T | Promise<T>): EventHandler {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event)
    }
    catch (error) {
      logApprovalError(event, label, error)
      throw error
    }
  })
}

export function logHandledApprovalError(event: H3Event, label: string, error: unknown) {
  logApprovalError(event, label, error)
}

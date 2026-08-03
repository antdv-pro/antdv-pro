import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import { systemStore } from './system-store'

export function getCurrentUser(event: H3Event) {
  const token = getRequestHeader(event, 'Authorization')
  return systemStore.getUserByToken(token)
}

export function getCurrentUserId(event: H3Event) {
  return getCurrentUser(event)?.id
}

import type { H3Event } from 'h3'
import { createError, getRequestHeader, getRequestURL, setHeader } from 'h3'
import { systemStore } from './system-store'

const publicPaths = [
  '/',
  '/login',
  '/logout',
  '/api/login',
  '/api/logout',
  '/401',
  '/403',
  '/500',
  '/healthz',
  '/api/healthz',
  '/api/readyz',
  '/approval/wecom/callback',
  '/api/approval/wecom/callback',
  '/approval/finance/payments/callback',
  '/api/approval/finance/payments/callback',
]

const publicPrefixes = [
  '/assets/',
  '/favicon',
]

export function applySecurityHeaders(event: H3Event) {
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'X-XSS-Protection', '1; mode=block')
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
}

export function isPublicPath(pathname: string) {
  return publicPaths.includes(pathname) || publicPrefixes.some(prefix => pathname.startsWith(prefix))
}

export function getAuthenticatedUser(event: H3Event) {
  const token = getRequestHeader(event, 'Authorization')
  if (!token)
    return undefined
  return systemStore.getUserByToken(token)
}

export function requireAuthenticatedUser(event: H3Event) {
  const user = getAuthenticatedUser(event)
  if (!user || user.status === 'disabled')
    throw createError({ statusCode: 401, statusMessage: '登录失效或无权访问' })
  return user
}

export function requireAnyRole(event: H3Event, allowedRoles: string[]) {
  const user = requireAuthenticatedUser(event)
  if (!user.roles.some(role => allowedRoles.includes(String(role))))
    throw createError({ statusCode: 403, statusMessage: '无权执行此操作' })
  return user
}

export function requireAdmin(event: H3Event) {
  return requireAnyRole(event, ['ADMIN'])
}

export function requireAuth(event: H3Event) {
  const pathname = getRequestURL(event).pathname
  if (isPublicPath(pathname))
    return undefined

  const user = getAuthenticatedUser(event)
  if (!user || user.status === 'disabled') {
    event.res.status = 401
    return {
      code: 401,
      msg: '登录失效或无权访问',
    }
  }
  if ((pathname.startsWith('/system/') || pathname.startsWith('/api/system/')) && !user.roles.includes('ADMIN')) {
    event.res.status = 403
    return {
      code: 403,
      msg: '无权访问系统管理接口',
    }
  }
  return undefined
}

export function getTrustedAccessQuery(event: H3Event) {
  const user = requireAuthenticatedUser(event)
  return {
    userId: user.id,
    role: user.roles.includes('ADMIN') ? 'ADMIN' : 'USER',
  }
}

export function sanitizeText(input: unknown) {
  return String(input ?? '')
    .replace(/[<>]/g, '')
    .trim()
}

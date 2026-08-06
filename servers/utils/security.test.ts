import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applySecurityHeaders, getAuthenticatedUser, getTrustedAccessQuery, isPublicPath, requireAdmin, requireAuth, requireAuthenticatedUser, sanitizeText } from './security'

const h3 = vi.hoisted(() => ({
  createError: vi.fn((input: any) => Object.assign(new Error(input.statusMessage), input)),
  getRequestHeader: vi.fn(),
  getRequestURL: vi.fn(),
  setHeader: vi.fn(),
}))
const getUserByToken = vi.hoisted(() => vi.fn())
vi.mock('h3', () => h3)
vi.mock('./system-store', () => ({ systemStore: { getUserByToken } }))

describe('server security', () => {
  beforeEach(() => vi.clearAllMocks())

  it('recognizes exact and prefixed public paths without overmatching', () => {
    expect(isPublicPath('/api/login')).toBe(true)
    expect(isPublicPath('/assets/app.js')).toBe(true)
    expect(isPublicPath('/api/login/private')).toBe(false)
  })

  it('sets the complete security header policy', () => {
    const event = {} as any
    applySecurityHeaders(event)
    expect(h3.setHeader).toHaveBeenCalledTimes(5)
    expect(h3.setHeader).toHaveBeenCalledWith(event, 'X-Frame-Options', 'SAMEORIGIN')
  })

  it('resolves tokens and rejects missing or disabled users', () => {
    const event = { res: { status: 200 } } as any
    h3.getRequestURL.mockReturnValue(new URL('http://localhost/api/private'))
    h3.getRequestHeader.mockReturnValue(undefined)
    expect(getAuthenticatedUser(event)).toBeUndefined()
    expect(requireAuth(event)).toMatchObject({ code: 401 })
    expect(event.res.status).toBe(401)

    h3.getRequestHeader.mockReturnValue('token')
    getUserByToken.mockReturnValue({ status: 'disabled' })
    expect(requireAuth(event)).toMatchObject({ code: 401 })
    getUserByToken.mockReturnValue({ status: 'active' })
    expect(requireAuth(event)).toBeUndefined()
  })

  it('bypasses authentication for public routes and sanitizes text', () => {
    h3.getRequestURL.mockReturnValue(new URL('http://localhost/healthz'))
    expect(requireAuth({ res: {} } as any)).toBeUndefined()
    expect(sanitizeText(' <b> hello </b> ')).toBe('b hello /b')
    expect(sanitizeText(null)).toBe('')
  })

  it('enforces system administration roles and derives trusted data scope', () => {
    const event = { res: { status: 200 } } as any
    h3.getRequestURL.mockReturnValue(new URL('http://localhost/api/system/users'))
    h3.getRequestHeader.mockReturnValue('token')
    getUserByToken.mockReturnValue({ id: 7, status: 'enabled', roles: ['USER'] })
    expect(requireAuth(event)).toEqual({ code: 403, msg: '无权访问系统管理接口' })
    expect(event.res.status).toBe(403)
    expect(() => requireAdmin(event)).toThrow('无权执行此操作')
    expect(getTrustedAccessQuery(event)).toEqual({ userId: 7, role: 'USER' })

    getUserByToken.mockReturnValue({ id: 1, status: 'enabled', roles: ['ADMIN'] })
    expect(requireAuth(event)).toBeUndefined()
    expect(requireAuthenticatedUser(event)).toMatchObject({ id: 1 })
    expect(getTrustedAccessQuery(event)).toEqual({ userId: 1, role: 'ADMIN' })
  })
})

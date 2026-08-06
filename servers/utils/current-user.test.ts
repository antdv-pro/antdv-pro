import { describe, expect, it, vi } from 'vitest'

import { getCurrentUser, getCurrentUserId } from './current-user'

const getRequestHeader = vi.hoisted(() => vi.fn())
const getUserByToken = vi.hoisted(() => vi.fn())
vi.mock('h3', () => ({ getRequestHeader }))
vi.mock('./system-store', () => ({ systemStore: { getUserByToken } }))

describe('current user', () => {
  it('loads the token user and never trusts fallback ids', () => {
    getRequestHeader.mockReturnValue('token')
    getUserByToken.mockReturnValue({ id: 42 })
    const event = {} as any
    expect(getCurrentUser(event)).toEqual({ id: 42 })
    expect(getCurrentUserId(event)).toBe(42)
    expect(getCurrentUserId(event)).toBe(42)
  })
})

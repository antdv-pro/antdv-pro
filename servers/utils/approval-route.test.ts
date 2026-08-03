import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defineApprovalHandler, logHandledApprovalError } from './approval-route'

const h3 = vi.hoisted(() => ({ getRequestURL: vi.fn(), defineEventHandler: vi.fn((handler: any) => handler) }))
vi.mock('h3', () => h3)

describe('approval route wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h3.getRequestURL.mockReturnValue(new URL('http://localhost/api/approval?id=1'))
  })

  it('returns successful handler results unchanged', async () => {
    const event = { req: { method: 'POST' } } as any
    const handler = defineApprovalHandler('submit', async () => ({ code: 200 })) as any
    await expect(handler(event)).resolves.toEqual({ code: 200 })
  })

  it('logs request context and rethrows failures', async () => {
    const error = new Error('db failed')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const event = { req: { method: 'PUT' } } as any
    const handler = defineApprovalHandler('approve', async () => {
      throw error
    }) as any
    await expect(handler(event)).rejects.toBe(error)
    expect(spy).toHaveBeenCalledWith('[approval] approve failed: PUT /api/approval?id=1', error)
    logHandledApprovalError({ req: {} } as any, 'handled', error)
    expect(spy).toHaveBeenLastCalledWith('[approval] handled failed: UNKNOWN /api/approval?id=1', error)
    spy.mockRestore()
  })
})

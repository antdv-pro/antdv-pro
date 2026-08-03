import { describe, expect, it, vi } from 'vitest'
import { badRequest, DomainError, fail, ok } from './http-response'

vi.mock('h3', () => ({
  createError: (input: unknown) => input,
  setResponseStatus: (event: any, status: number) => event.status = status,
}))

describe('http response contract', () => {
  it('creates a stable success envelope', () => {
    expect(ok({ id: 1 }, '保存成功')).toEqual({ code: 200, msg: '保存成功', data: { id: 1 } })
  })

  it('maps expected domain failures to an HTTP client status', () => {
    const event = {} as any
    expect(fail(event, new DomainError('输入无效'))).toEqual({ code: 400, msg: '输入无效' })
    expect(event.status).toBe(400)
  })

  it('does not expose unexpected internal errors', () => {
    const event = {} as any
    expect(fail(event, new Error('database password'), '保存失败')).toEqual({ code: 500, msg: '保存失败' })
    expect(event.status).toBe(500)
  })

  it('throws a typed bad request', () => {
    expect(() => badRequest('date 不能为空')).toThrowError(DomainError)
  })
})

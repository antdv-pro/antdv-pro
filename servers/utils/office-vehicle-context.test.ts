import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fail, getOperatorContext, ok } from './office-vehicle-context'

const h3 = vi.hoisted(() => ({ getRequestHeader: vi.fn(), getHeader: vi.fn(), getQuery: vi.fn(), createError: vi.fn((input: any) => new Error(input.statusMessage)) }))
const getUserByToken = vi.hoisted(() => vi.fn())
vi.mock('h3', () => h3)
vi.mock('./system-store', () => ({ systemStore: { getUserByToken } }))

describe('office vehicle context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h3.getRequestHeader.mockReturnValue('session-token')
    getUserByToken.mockReturnValue({ id: 7, nickname: '张三', deptId: '2', deptName: '行政部', roles: ['USER'], status: 'enabled' })
  })

  it('builds context only from the authenticated session', () => {
    expect(getOperatorContext({} as any)).toEqual({
      userId: 7,
      userName: '张三',
      deptId: '2',
      deptName: '行政部',
      roles: ['USER'],
    })
  })

  it('rejects requests without a valid session instead of granting defaults', () => {
    getUserByToken.mockReturnValue(undefined)
    expect(() => getOperatorContext({} as any)).toThrow('登录失效')
  })

  it('formats successful and failed route responses', () => {
    expect(ok([1], '完成')).toEqual({ code: 200, msg: '完成', data: [1] })
    expect(fail(new Error('失败'))).toEqual({ code: 400, msg: '失败' })
    expect(fail(null, '默认错误')).toEqual({ code: 400, msg: '默认错误' })
  })
})

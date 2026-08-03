import { describe, expect, it } from 'vitest'
import { assertTradeOrderTransition, nextTradeOrderStatus, tradeOrderMutationPermission } from './business-status-rules'

describe('business status rules', () => {
  it('allows only forward trade order transitions', () => {
    expect(nextTradeOrderStatus('待确认')).toBe('已确认')
    expect(nextTradeOrderStatus('已确认')).toBe('已结算')
    expect(nextTradeOrderStatus('已结算')).toBeUndefined()
    expect(() => assertTradeOrderTransition('待确认', '已确认')).not.toThrow()
    expect(() => assertTradeOrderTransition('已确认', '待确认')).toThrow('只能从“已确认”流转到“已结算”')
    expect(() => assertTradeOrderTransition('待确认', '已结算')).toThrow('只能从“待确认”流转到“已确认”')
  })

  it('locks settled trade orders', () => {
    expect(tradeOrderMutationPermission('已确认')).toEqual({ allowed: true })
    expect(tradeOrderMutationPermission('已结算')).toEqual({
      allowed: false,
      reason: '已结算订单已锁定，如需更正请先按财务流程冲销',
    })
  })
})

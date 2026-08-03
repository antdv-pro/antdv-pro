export const tradeOrderStatusFlow = ['待确认', '已确认', '已结算'] as const

export type TradeOrderStatus = typeof tradeOrderStatusFlow[number]

export interface BusinessActionPermission {
  allowed: boolean
  reason?: string
}

export function isTradeOrderStatus(value: unknown): value is TradeOrderStatus {
  return tradeOrderStatusFlow.includes(String(value) as TradeOrderStatus)
}

export function nextTradeOrderStatus(status: unknown): TradeOrderStatus | undefined {
  const index = tradeOrderStatusFlow.indexOf(String(status) as TradeOrderStatus)
  return index >= 0 ? tradeOrderStatusFlow[index + 1] : undefined
}

export function tradeOrderMutationPermission(status: unknown): BusinessActionPermission {
  return String(status) === '已结算'
    ? { allowed: false, reason: '已结算订单已锁定，如需更正请先按财务流程冲销' }
    : { allowed: true }
}

export function assertTradeOrderTransition(from: unknown, to: unknown) {
  if (!isTradeOrderStatus(to))
    throw new Error('贸易订单状态不合法')
  if (!from)
    return
  if (!isTradeOrderStatus(from))
    throw new Error('贸易订单原状态不合法')
  if (from === to)
    return
  if (nextTradeOrderStatus(from) !== to)
    throw new Error(`贸易订单状态只能从“${from}”流转到“${nextTradeOrderStatus(from) || '终态'}”`)
}

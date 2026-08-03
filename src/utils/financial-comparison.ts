export type FinancialComparisonDirection = 'up' | 'down' | 'flat' | 'new'

export interface FinancialComparison {
  previousValue: string | number
  direction: FinancialComparisonDirection
  percent?: number
}

export function createFinancialComparison(
  current: number,
  previous: number,
  previousValue: string | number = previous,
): FinancialComparison {
  if (!Number.isFinite(current) || !Number.isFinite(previous))
    return { previousValue, direction: 'flat', percent: 0 }

  if (Math.abs(previous) < 0.000001) {
    return Math.abs(current) < 0.000001
      ? { previousValue, direction: 'flat', percent: 0 }
      : { previousValue, direction: 'new' }
  }

  const change = (current - previous) / Math.abs(previous) * 100
  if (Math.abs(change) < 0.05)
    return { previousValue, direction: 'flat', percent: 0 }

  return {
    previousValue,
    direction: change > 0 ? 'up' : 'down',
    percent: Math.abs(change),
  }
}

export function formatFinancialComparisonChange(comparison: FinancialComparison) {
  if (comparison.direction === 'new')
    return '本月新增'
  if (comparison.direction === 'flat')
    return '持平 0%'

  const percent = Number(comparison.percent || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
  return `${comparison.direction === 'up' ? '上升' : '下降'} ${percent}%`
}

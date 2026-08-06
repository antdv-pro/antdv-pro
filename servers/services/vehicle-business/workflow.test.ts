import { describe, expect, it } from 'vitest'
import { assertStatusTransition, assertStatusValue, expenseApprovalTransitions, manualEnableTransitions } from './workflow'

describe('vehicle business workflow', () => {
  it('accepts declared transitions and idempotent updates', () => {
    expect(() => assertStatusTransition('草稿', '审批中', expenseApprovalTransitions)).not.toThrow()
    expect(() => assertStatusTransition('enabled', 'enabled', manualEnableTransitions)).not.toThrow()
  })

  it('rejects terminal and unknown statuses', () => {
    expect(() => assertStatusTransition('已确认', '已撤回', expenseApprovalTransitions, '费用状态')).toThrow('费用状态不能从“已确认”变更为“已撤回”')
    expect(() => assertStatusValue('未知', ['enabled', 'disabled'], '规费手工状态')).toThrow('规费手工状态不合法')
  })
})

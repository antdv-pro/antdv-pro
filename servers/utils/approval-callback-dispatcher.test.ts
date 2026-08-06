import { describe, expect, it, vi } from 'vitest'
import { dispatchApprovalBusinessCallback, handleApprovalApproved, registerApprovalBusinessHandler } from './approval-callback-dispatcher'

function instance(businessType: string) {
  return { id: 'approval-1', businessType } as any
}

describe('approval callback dispatcher', () => {
  it('ignores unregistered business types', async () => {
    await expect(dispatchApprovalBusinessCallback('approved', instance('unknown'))).resolves.toBeUndefined()
  })

  it('dispatches every lifecycle action to its registered handler', async () => {
    const handler = { onPending: vi.fn(), onApproved: vi.fn(), onRejected: vi.fn(), onRevoked: vi.fn() }
    registerApprovalBusinessHandler('all-actions-test', handler)
    for (const action of ['pending', 'approved', 'rejected', 'revoked'] as const)
      await dispatchApprovalBusinessCallback(action, instance('all-actions-test'))
    expect(handler.onPending).toHaveBeenCalledOnce()
    expect(handler.onApproved).toHaveBeenCalledOnce()
    expect(handler.onRejected).toHaveBeenCalledOnce()
    expect(handler.onRevoked).toHaveBeenCalledOnce()
  })

  it('restores snapshots and rethrows when a business callback fails', async () => {
    const snapshot = { balance: 100 }
    const restore = vi.fn()
    registerApprovalBusinessHandler('rollback-test', {
      snapshot: () => snapshot,
      restore,
      onApproved: () => {
        throw new Error('apply failed')
      },
    })
    await expect(handleApprovalApproved(instance('rollback-test'))).rejects.toThrow('apply failed')
    expect(restore).toHaveBeenCalledWith(snapshot)
  })

  it('does not restore when no snapshot was produced', async () => {
    const restore = vi.fn()
    registerApprovalBusinessHandler('no-snapshot-test', {
      restore,
      onRejected: () => {
        throw new Error('reject failed')
      },
    })
    await expect(dispatchApprovalBusinessCallback('rejected', instance('no-snapshot-test'))).rejects.toThrow('reject failed')
    expect(restore).not.toHaveBeenCalled()
  })
})

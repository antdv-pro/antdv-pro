import type { ApprovalInstance } from './approval-store'

export type ApprovalCallbackAction = 'pending' | 'approved' | 'rejected' | 'revoked'

export interface ApprovalBusinessHandler {
  snapshot?: () => unknown | Promise<unknown>
  restore?: (snapshot: unknown) => void | Promise<void>
  onPending?: (instance: ApprovalInstance) => void | Promise<void>
  onApproved?: (instance: ApprovalInstance) => void | Promise<void>
  onRejected?: (instance: ApprovalInstance) => void | Promise<void>
  onRevoked?: (instance: ApprovalInstance) => void | Promise<void>
}

const globalStore = globalThis as typeof globalThis & {
  __approvalBusinessHandlers?: Map<string, ApprovalBusinessHandler>
}
const handlers = globalStore.__approvalBusinessHandlers ?? new Map<string, ApprovalBusinessHandler>()
globalStore.__approvalBusinessHandlers = handlers

export function registerApprovalBusinessHandler(businessType: string, handler: ApprovalBusinessHandler) {
  const previous = handlers.get(businessType)
  if (!previous) {
    handlers.set(businessType, handler)
    return
  }
  handlers.set(businessType, {
    snapshot: async () => Promise.all([previous.snapshot?.(), handler.snapshot?.()]),
    restore: async (snapshot) => {
      const values = Array.isArray(snapshot) ? snapshot : []
      await previous.restore?.(values[0])
      await handler.restore?.(values[1])
    },
    onPending: async (instance) => {
      await previous.onPending?.(instance)
      await handler.onPending?.(instance)
    },
    onApproved: async (instance) => {
      await previous.onApproved?.(instance)
      await handler.onApproved?.(instance)
    },
    onRejected: async (instance) => {
      await previous.onRejected?.(instance)
      await handler.onRejected?.(instance)
    },
    onRevoked: async (instance) => {
      await previous.onRevoked?.(instance)
      await handler.onRevoked?.(instance)
    },
  })
}

export async function dispatchApprovalBusinessCallback(action: ApprovalCallbackAction, instance: ApprovalInstance) {
  const handler = handlers.get(instance.businessType)
  if (!handler)
    return

  const snapshot = await handler.snapshot?.()

  try {
    if (action === 'pending')
      await handler.onPending?.(instance)
    else if (action === 'approved')
      await handler.onApproved?.(instance)
    else if (action === 'rejected')
      await handler.onRejected?.(instance)
    else if (action === 'revoked')
      await handler.onRevoked?.(instance)
  }
  catch (error) {
    if (snapshot !== undefined)
      await handler.restore?.(snapshot)
    throw error
  }
}

export function handleApprovalApproved(instance: ApprovalInstance) {
  return dispatchApprovalBusinessCallback('approved', instance)
}

import { describe, expect, it } from 'vitest'
import { getPaymentProvider, paymentCallbackSignature, verifyPaymentCallbackSignature } from './payment-provider'
import { runtimeConfig } from './runtime-config'

describe('payment provider', () => {
  it('submits deterministic mock bank requests', async () => {
    const previous = runtimeConfig.payment.provider
    runtimeConfig.payment.provider = 'mock'
    try {
      await expect(getPaymentProvider().submit({
        paymentId: 'payment-1',
        paymentRequestNo: 'REQ-1',
        accountName: '工行',
        payeeName: '供应商',
        amount: 100,
        paymentDate: '2026-07-17',
      })).resolves.toMatchObject({ provider: 'mock', providerRequestId: 'MOCK-REQ-1', rawStatus: 'ACCEPTED' })
    }
    finally {
      runtimeConfig.payment.provider = previous
    }
  })

  it('accepts only callbacks signed with the configured secret', () => {
    const previous = runtimeConfig.payment.callbackSecret
    runtimeConfig.payment.callbackSecret = 'test-secret-that-is-long-enough-123456'
    try {
      const body = JSON.stringify({ eventId: 'event-1', status: 'SUCCESS' })
      expect(verifyPaymentCallbackSignature(body, paymentCallbackSignature(body))).toBe(true)
      expect(verifyPaymentCallbackSignature(`${body}x`, paymentCallbackSignature(body))).toBe(false)
      expect(verifyPaymentCallbackSignature(body, '')).toBe(false)
    }
    finally {
      runtimeConfig.payment.callbackSecret = previous
    }
  })
})

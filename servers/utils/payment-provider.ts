import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { runtimeConfig } from './runtime-config'

export interface BankPaymentRequest {
  paymentId: string
  paymentRequestNo: string
  accountName: string
  payeeName: string
  amount: number
  paymentDate: string
  remark?: string
}

export interface BankPaymentSubmission {
  provider: string
  providerRequestId: string
  acceptedAt: string
  rawStatus: string
}

export interface PaymentProvider {
  name: string
  submit: (request: BankPaymentRequest) => Promise<BankPaymentSubmission>
}

const mockProvider: PaymentProvider = {
  name: 'mock',
  async submit(request) {
    return {
      provider: 'mock',
      providerRequestId: `MOCK-${request.paymentRequestNo}`,
      acceptedAt: new Date().toISOString(),
      rawStatus: 'ACCEPTED',
    }
  },
}

const httpProvider: PaymentProvider = {
  name: 'http',
  async submit(request) {
    const response = await fetch(runtimeConfig.payment.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${runtimeConfig.payment.apiKey}`,
        'x-merchant-id': runtimeConfig.payment.merchantId,
      },
      body: JSON.stringify({ ...request, callbackUrl: runtimeConfig.payment.callbackUrl }),
    })
    if (!response.ok)
      throw new Error(`支付渠道提交失败(${response.status})`)
    const result = await response.json() as Record<string, any>
    const providerRequestId = String(result.providerRequestId || result.requestId || '').trim()
    if (!providerRequestId)
      throw new Error('支付渠道未返回请求号')
    return {
      provider: 'http',
      providerRequestId,
      acceptedAt: String(result.acceptedAt || new Date().toISOString()),
      rawStatus: String(result.status || 'ACCEPTED'),
    }
  },
}

export function getPaymentProvider(): PaymentProvider {
  if (runtimeConfig.payment.provider === 'mock')
    return mockProvider
  if (runtimeConfig.payment.provider === 'http')
    return httpProvider
  throw new Error('自动付款渠道未启用')
}

export function paymentCallbackSignature(rawBody: string, secret = runtimeConfig.payment.callbackSecret) {
  return createHmac('sha256', secret).update(rawBody).digest('hex')
}

export function verifyPaymentCallbackSignature(rawBody: string, signature: string) {
  if (!runtimeConfig.payment.callbackSecret || !signature)
    return false
  const expected = paymentCallbackSignature(rawBody)
  const actualBuffer = Buffer.from(signature.toLowerCase())
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

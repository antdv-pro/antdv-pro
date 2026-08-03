# 银行付款渠道接入

## 状态流

`PENDING（待支付） -> PROCESSING（银行处理中） -> SUCCESS（已支付）/FAILED（支付失败）`

- 只有 `SUCCESS` 会生成现金支出并核销应付。
- `PENDING` 和 `PROCESSING` 都占用应付可付额度，并计入看板待付款金额。
- 同一付款请求号、银行流水号和回调事件号均做幂等控制。

## 环境变量

```dotenv
PAYMENT_PROVIDER=http
PAYMENT_PROVIDER_ENDPOINT=https://bank-gateway.example/payments
PAYMENT_MERCHANT_ID=your-merchant-id
PAYMENT_API_KEY=your-api-key
PAYMENT_CALLBACK_SECRET=at-least-32-random-characters
PAYMENT_CALLBACK_URL=https://erp.example/api/approval/finance/payments/callback
```

开发联调使用 `PAYMENT_PROVIDER=mock`。生产环境未显式配置时默认使用 `disabled`，避免误发付款指令。

## 提交请求

系统向 `PAYMENT_PROVIDER_ENDPOINT` 发送 `POST application/json`，并通过
`Authorization: Bearer <PAYMENT_API_KEY>` 和 `x-merchant-id` 传递渠道身份。

```json
{
  "paymentId": "payment-PAY-20260717-001",
  "paymentRequestNo": "PAY-20260717-001",
  "accountName": "工行基本户",
  "payeeName": "供应商甲",
  "amount": 1200,
  "paymentDate": "2026-07-17",
  "remark": "采购结算",
  "callbackUrl": "https://erp.example/api/approval/finance/payments/callback"
}
```

渠道需返回：

```json
{
  "providerRequestId": "BANK-REQUEST-001",
  "status": "ACCEPTED",
  "acceptedAt": "2026-07-17T10:00:00.000Z"
}
```

## 异步回调

渠道向 `PAYMENT_CALLBACK_URL` 发送原始 JSON，并设置请求头：

`x-payment-signature = hex(HMAC-SHA256(PAYMENT_CALLBACK_SECRET, rawBody))`

成功示例：

```json
{
  "eventId": "BANK-EVENT-001",
  "paymentRequestNo": "PAY-20260717-001",
  "status": "SUCCESS",
  "bankSerialNo": "BANK-SERIAL-001",
  "paidAt": "2026-07-17T10:05:00.000Z"
}
```

失败示例：

```json
{
  "eventId": "BANK-EVENT-002",
  "paymentRequestNo": "PAY-20260717-001",
  "status": "FAILED",
  "reason": "收款账户信息错误"
}
```

真实银行字段、证书签名或国密算法与上述协议不同时，在
`servers/utils/payment-provider.ts` 中新增对应适配器，财务状态机和记账逻辑无需修改。

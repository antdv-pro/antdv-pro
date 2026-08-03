import { wecomApprovalStore } from '../../utils/wecom-approval-store'

export interface WecomCallbackQuery {
  msg_signature?: unknown
  timestamp?: unknown
  nonce?: unknown
}

function verify(query: WecomCallbackQuery, encrypted: string) {
  return wecomApprovalStore.verifySignature(
    String(query.msg_signature || ''),
    String(query.timestamp || ''),
    String(query.nonce || ''),
    encrypted,
  )
}

export const approvalCallbackService = {
  verifyUrl(query: WecomCallbackQuery, encrypted: string) {
    if (!verify(query, encrypted))
      throw new Error('invalid signature')
    return wecomApprovalStore.decryptCallback(encrypted)
  },
  async handleXml(query: WecomCallbackQuery, xml: string) {
    const encrypted = wecomApprovalStore.extractEncrypted(xml)
    if (!verify(query, encrypted))
      throw new Error('invalid signature')
    await wecomApprovalStore.handleCallbackXml(wecomApprovalStore.decryptCallback(encrypted))
  },
}

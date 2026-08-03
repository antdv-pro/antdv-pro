export const BILL_RECONCILIATION_CHECKS = [
  { label: '客户', key: 'customer', kind: 'text' },
  { label: '路线', key: 'routeLine', kind: 'text' },
  { label: '吨位', key: 'weight', kind: 'number' },
  { label: '单价', key: 'unitPrice', kind: 'number' },
  { label: '运距', key: 'distance', kind: 'number' },
  { label: '运费', key: 'freightAmount', kind: 'number' },
  { label: '税后运费', key: 'taxedFreight', kind: 'number' },
] as const

export function isSameBillValue(systemValue: unknown, customerValue: unknown, kind: 'number' | 'text') {
  if (kind === 'number')
    return Math.abs(Number(systemValue || 0) - Number(customerValue || 0)) < 0.01
  return String(systemValue || '').trim() === String(customerValue || '').trim()
}

export const TRANSPORT_FREIGHT_TAX_RATE = 0.09

export function calculateTransportFreightExcludingTax(freightIncludingTax: number) {
  if (!Number.isFinite(freightIncludingTax) || freightIncludingTax <= 0)
    return 0

  return freightIncludingTax / (1 + TRANSPORT_FREIGHT_TAX_RATE)
}

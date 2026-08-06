import { describe, expect, it } from 'vitest'
import { normalizeTransportDate } from './transport-date'

describe('normalizeTransportDate', () => {
  it('normalizes imported two-digit-year dates', () => {
    expect(normalizeTransportDate('8/21/20')).toBe('2020-08-21')
    expect(normalizeTransportDate('1/9/26')).toBe('2026-01-09')
  })

  it('preserves standard dates and handles Excel serial values', () => {
    expect(normalizeTransportDate('2024-03-12')).toBe('2024-03-12')
    expect(normalizeTransportDate('45363')).toBe('2024-03-12')
  })

  it('returns an empty value for invalid dates', () => {
    expect(normalizeTransportDate('2/30/20')).toBe('')
    expect(normalizeTransportDate('')).toBe('')
  })
})

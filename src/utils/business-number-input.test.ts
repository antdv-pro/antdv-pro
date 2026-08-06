// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { formatBusinessNumber, isZeroNumberValue, selectNumberInputContents } from './business-number-input'

describe('business number input', () => {
  it('leaves editable zero values blank until the user types', () => {
    expect(formatBusinessNumber(0, { input: '', userTyping: false }, { editable: true, hideZero: true, precision: 2 })).toBe('')
    expect(formatBusinessNumber(0, { input: '0', userTyping: true }, { editable: true, hideZero: true, precision: 2 })).toBe('0')
  })

  it('keeps zero visible for readonly calculation fields', () => {
    expect(formatBusinessNumber(0, { input: '', userTyping: false }, { editable: false, hideZero: true, precision: 2 })).toBe('0.00')
  })

  it('formats precision and custom decimal separators', () => {
    expect(formatBusinessNumber(31, { input: '', userTyping: false }, { editable: true, hideZero: true, precision: 1 })).toBe('31.0')
    expect(formatBusinessNumber('12.5', { input: '', userTyping: false }, { editable: true, hideZero: true, precision: 2, decimalSeparator: ',' })).toBe('12,50')
  })

  it('recognizes numeric zero without treating empty values as zero', () => {
    expect(isZeroNumberValue('0.00')).toBe(true)
    expect(isZeroNumberValue(null)).toBe(false)
    expect(isZeroNumberValue('')).toBe(false)
  })

  it('selects the native input contents on focus', () => {
    const input = document.createElement('input')
    const select = vi.spyOn(input, 'select')
    expect(selectNumberInputContents(input)).toBe(true)
    expect(select).toHaveBeenCalledOnce()
    expect(selectNumberInputContents(document.createElement('div'))).toBe(false)
  })
})

export type BusinessNumberValue = number | string | null | undefined

interface NumberFormatInfo {
  input: string
  userTyping: boolean
}

interface BusinessNumberFormatOptions {
  decimalSeparator?: string
  editable: boolean
  hideZero: boolean
  precision?: number
}

export function isZeroNumberValue(value: BusinessNumberValue) {
  if (value === null || value === undefined || value === '')
    return false
  return Number(value) === 0
}

export function formatBusinessNumber(
  value: BusinessNumberValue,
  info: NumberFormatInfo,
  options: BusinessNumberFormatOptions,
) {
  if (info.userTyping)
    return info.input
  if (value === null || value === undefined || value === '')
    return ''
  if (options.editable && options.hideZero && isZeroNumberValue(value))
    return ''

  const numericValue = Number(value)
  if (options.precision !== undefined && Number.isFinite(numericValue)) {
    const formatted = numericValue.toFixed(options.precision)
    return options.decimalSeparator && options.decimalSeparator !== '.'
      ? formatted.replace('.', options.decimalSeparator)
      : formatted
  }
  return String(value)
}

export function selectNumberInputContents(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement))
    return false
  target.select()
  return true
}

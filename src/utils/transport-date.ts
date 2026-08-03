import dayjs from 'dayjs'

const EXCEL_EPOCH_OFFSET = 25569
const MILLISECONDS_PER_DAY = 86_400_000

export function normalizeTransportDate(value: unknown): string {
  const text = String(value ?? '').trim()
  if (!text)
    return ''

  const excelSerial = Number(text)
  if (/^\d+(?:\.\d+)?$/.test(text) && excelSerial > 20000) {
    const date = new Date(Math.round((excelSerial - EXCEL_EPOCH_OFFSET) * MILLISECONDS_PER_DAY))
    if (!Number.isNaN(date.getTime()))
      return date.toISOString().slice(0, 10)
  }

  const slashDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (slashDate) {
    const [, month, day, yearText] = slashDate
    const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText)
    const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const parsed = dayjs(normalized)
    return parsed.isValid() && parsed.format('YYYY-MM-DD') === normalized ? normalized : ''
  }

  const parsed = dayjs(text)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
}

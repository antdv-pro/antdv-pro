import { Buffer } from 'node:buffer'

const mojibakePattern = /[ÃÂ�]|[èéçåäöü][\s\S]{0,5}[\u0080-\u00BF]/

// Browsers and spreadsheet tools often decode ISO-8859-1 data as Windows-1252.
// Map those printable characters back to their original bytes before UTF-8 decoding.
const windows1252Bytes: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  'ƒ': 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  'ˆ': 0x88,
  '‰': 0x89,
  'Š': 0x8A,
  '‹': 0x8B,
  'Œ': 0x8C,
  'Ž': 0x8E,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  'š': 0x9A,
  '›': 0x9B,
  'œ': 0x9C,
  'ž': 0x9E,
  'Ÿ': 0x9F,
}

function mojibakeBytes(value: string) {
  const bytes: number[] = []
  for (const char of value) {
    const byte = windows1252Bytes[char] ?? char.codePointAt(0)
    if (byte == null || byte > 0xFF)
      return undefined
    bytes.push(byte)
  }
  return Buffer.from(bytes)
}

export function repairMojibake(value: unknown) {
  if (typeof value !== 'string')
    return value
  if (!mojibakePattern.test(value))
    return value

  const bytes = mojibakeBytes(value)
  if (!bytes)
    return value

  const repaired = bytes.toString('utf8')
  return repaired.includes('�') ? value : repaired
}

export function repairDeep<T>(value: T): T {
  if (typeof value === 'string')
    return repairMojibake(value) as T

  if (Array.isArray(value))
    return value.map(item => repairDeep(item)) as T

  if (!value || typeof value !== 'object')
    return value

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null)
    return value

  const repaired: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>))
    repaired[key] = repairDeep(item)

  return repaired as T
}

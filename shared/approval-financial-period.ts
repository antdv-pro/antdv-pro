function parseYear(value: unknown) {
  const match = String(value ?? '').match(/(20\d{2})/)
  return match ? Number(match[1]) : undefined
}

function parseMonth(value: unknown) {
  const text = String(value ?? '').trim()
  const match = text.match(/20\d{2}[\s年\-/.]+(1[0-2]|0?[1-9])/) || text.match(/^(1[0-2]|0?[1-9])\s*月?$/)
  return match ? Number(match[1]) : undefined
}

export function resolveApprovalFinancialPeriod(
  dateValues: unknown[],
  explicitYear?: unknown,
  explicitMonth?: unknown,
) {
  for (const value of dateValues) {
    if (value == null || value === '')
      continue
    const year = parseYear(value)
    const month = parseMonth(value)
    if (year && month)
      return { financialYear: year, financialMonth: month }

    const numeric = Number(value)
    const date = Number.isFinite(numeric) && numeric > 0
      ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
      : new Date(String(value))
    if (!Number.isNaN(date.getTime()))
      return { financialYear: date.getFullYear(), financialMonth: date.getMonth() + 1 }
  }

  return {
    financialYear: parseYear(explicitYear),
    financialMonth: parseMonth(explicitMonth),
  }
}

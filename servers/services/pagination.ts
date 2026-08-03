export interface PageResult<T> {
  records: T[]
  total: number
  current: number
  pageSize: number
}

export function normalizePagination(current: unknown, pageSize: unknown, maxPageSize = 200) {
  const normalizedCurrent = Math.max(1, Math.trunc(Number(current) || 1))
  const normalizedPageSize = Math.min(maxPageSize, Math.max(1, Math.trunc(Number(pageSize) || 20)))
  return {
    current: normalizedCurrent,
    pageSize: normalizedPageSize,
    offset: (normalizedCurrent - 1) * normalizedPageSize,
  }
}

export function paginateRows<T>(rows: T[], current: unknown, pageSize: unknown): PageResult<T> {
  const page = normalizePagination(current, pageSize)
  return {
    records: rows.slice(page.offset, page.offset + page.pageSize),
    total: rows.length,
    current: page.current,
    pageSize: page.pageSize,
  }
}

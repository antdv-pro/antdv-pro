import { describe, expect, it } from 'vitest'
import { normalizePagination, paginateRows } from './pagination'

describe('service pagination', () => {
  it('normalizes invalid values and caps page size', () => {
    expect(normalizePagination(-1, 10000)).toEqual({ current: 1, pageSize: 200, offset: 0 })
  })

  it('returns stable metadata for local rows', () => {
    expect(paginateRows([1, 2, 3, 4, 5], 2, 2)).toEqual({ records: [3, 4], total: 5, current: 2, pageSize: 2 })
  })
})

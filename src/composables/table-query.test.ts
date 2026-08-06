import { describe, expect, it, vi } from 'vitest'

import { useTableQuery } from './table-query'

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return { ...actual, onMounted: vi.fn() }
})

describe('useTableQuery', () => {
  it('merges query state, transforms results and updates pagination', async () => {
    const beforeQuery = vi.fn()
    const queryApi = vi.fn().mockResolvedValue({ data: { records: [{ id: 1 }], total: 21 } })
    const afterQuery = vi.fn(data => ({ ...data, records: [...data.records, { id: 2 }] }))
    const { query, state } = useTableQuery({ queryOnMounted: false, queryApi, beforeQuery, afterQuery, queryParams: { keyword: 'A' } })
    await query()
    expect(queryApi).toHaveBeenCalledWith(expect.objectContaining({ current: 1, pageSize: 10, column: 'createTime', order: 'desc', keyword: 'A' }))
    expect(beforeQuery).toHaveBeenCalledOnce()
    expect(afterQuery).toHaveBeenCalledOnce()
    expect(state.dataSource).toEqual([{ id: 1 }, { id: 2 }])
    expect(state.pagination.total).toBe(21)
    expect(state.pagination.pageSizeOptions).toEqual(['10', '20', '50', '100'])
    expect(state.loading).toBe(false)
    state.pagination.onChange?.(1, 50)
    expect(state.pagination.pageSize).toBe(50)
    await vi.waitFor(() => expect(state.loading).toBe(false))
  })

  it('prevents overlapping requests and restores loading after failure', async () => {
    let resolve!: (value: unknown) => void
    const queryApi = vi.fn(() => new Promise(r => resolve = r))
    const table = useTableQuery({ queryOnMounted: false, queryApi })
    const first = table.query()
    await table.query()
    expect(queryApi).toHaveBeenCalledOnce()
    resolve({ data: { records: [], total: 0 } })
    await first

    queryApi.mockRejectedValueOnce(new Error('offline'))
    await expect(table.query()).rejects.toThrow('Query Failed: Error: offline')
    expect(table.state.loading).toBe(false)
  })

  it('tracks row selection, expansion and resets query state', async () => {
    const queryApi = vi.fn().mockResolvedValue({ data: { records: [], total: 0 } })
    const { state, resetQuery } = useTableQuery({ queryOnMounted: false, queryApi, queryParams: { status: 'active' } })
    state.rowSelections.onChange?.([1], [{ id: 1 }])
    expect(state.rowSelections.selectedRowKeys).toEqual([1])
    state.expandChange()
    expect(state.expand).toBe(true)
    state.pagination.current = 3
    resetQuery()
    expect(state.pagination.current).toBe(1)
    expect(state.queryParams).toEqual({})
    await vi.waitFor(() => expect(queryApi).toHaveBeenCalledOnce())
  })
})

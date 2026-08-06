import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AxiosLoading } from './loading'

const controls = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn() }))
vi.mock('@/composables/base-loading', () => ({ useLoading: () => controls }))

describe('axiosLoading', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens once for concurrent requests and closes after the last request', () => {
    const loading = new AxiosLoading()
    loading.addLoading()
    loading.addLoading()
    expect(controls.open).toHaveBeenCalledTimes(1)
    expect(loading.loadingCount).toBe(2)
    loading.closeLoading()
    expect(controls.close).not.toHaveBeenCalled()
    loading.closeLoading()
    expect(controls.close).toHaveBeenCalledTimes(1)
    expect(loading.loadingCount).toBe(0)
  })

  it('ignores unmatched close calls without making the counter negative', () => {
    const loading = new AxiosLoading()
    loading.closeLoading()
    expect(loading.loadingCount).toBe(0)
    expect(controls.close).not.toHaveBeenCalled()
  })
})

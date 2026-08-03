import { describe, expect, it } from 'vitest'
import { createEmptyTransportOrderForm, useTransportModuleState } from './use-transport-module-state'

describe('transport module state', () => {
  it('creates a complete independent order form', () => {
    const first = createEmptyTransportOrderForm()
    const second = createEmptyTransportOrderForm()
    first.customer = '客户甲'
    expect(second.customer).toBe('')
    expect(first).toMatchObject({ cargoName: 'LNG', status: '待审核', taxRate: '9.00%' })
  })

  it('owns query, modal, pagination and import state', () => {
    const state = useTransportModuleState()
    state.tablePagination.onChange(2, 50)
    expect(state.tablePagination).toMatchObject({ current: 2, pageSize: 50 })
    expect(state.orderModalOpen.value).toBe(false)
    expect(state.importPreview.status).toBe('idle')
  })
})

import { describe, expect, it } from 'vitest'
import { prepareMaintenanceDataset, presentMaintenanceDataset } from './maintenance-records'

const dataset = {
  orders: [],
  fuels: [],
  etc: [],
  driverPayrolls: [],
  inventoryMovements: [],
  vehicleLoans: [],
  baseCustomers: [],
  baseVehicles: [],
  baseCrews: [],
  baseRoutes: [],
  maintenance: [{ id: 1, status: '待审核', createdBy: 7 }],
}

describe('maintenance record presentation', () => {
  it('adds response-only permissions', () => {
    const result = presentMaintenanceDataset(dataset, { id: 7, roles: ['DEPT_LEADER'] })
    expect(result.maintenance[0].permissions.edit).toBe(true)
    expect(dataset.maintenance[0]).not.toHaveProperty('permissions')
  })

  it('preserves creators and strips client permissions before persistence', () => {
    const incoming = { ...dataset, maintenance: [{ id: 1, status: '待审核', permissions: { edit: true } }, { id: 2, status: '待审核' }] }
    const result = prepareMaintenanceDataset(incoming, dataset, { id: 9, roles: ['DEPT_LEADER'] })
    expect(result.maintenance).toEqual([
      { id: 1, status: '待审核', createdBy: 7 },
      { id: 2, status: '待审核', createdBy: 9 },
    ])
  })
})

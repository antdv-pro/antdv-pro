import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listExpiryWarnings } from './expiry-warning-service'

const mocks = vi.hoisted(() => ({
  getOaState: vi.fn(),
  getTransportDataset: vi.fn(),
  listFees: vi.fn(),
  listInsurances: vi.fn(),
  listLicenses: vi.fn(),
}))

vi.mock('../../utils/oa-module-store', () => ({
  oaModuleStore: { getState: mocks.getOaState },
}))
vi.mock('../../utils/office-vehicle-store', () => ({
  officeVehicleStore: {
    listInsurances: mocks.listInsurances,
    listLicenses: mocks.listLicenses,
  },
}))
vi.mock('../../utils/regulatory-fee-store', () => ({
  listRegulatoryFees: mocks.listFees,
}))
vi.mock('../../utils/transport-operation-store', () => ({
  transportOperationStore: { getDataset: mocks.getTransportDataset },
}))

describe('dashboard expiry warning permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listLicenses.mockResolvedValue({
      records: [{ id: 'L1', vehicleId: 'V1', plateNo: '青A1', licenseType: '行驶证', expiryDate: '2026-07-01' }],
    })
    mocks.listInsurances.mockResolvedValue({ records: [] })
    mocks.listFees.mockResolvedValue({ records: [] })
    mocks.getTransportDataset.mockResolvedValue({
      baseVehicles: [],
      vehicleLoans: [{
        id: 'LOAN-1',
        contractNo: 'LOAN-1',
        plateNo: '青A1',
        firstDueDate: '2026-07-01',
        totalPeriods: 1,
        monthlyPayment: 1000,
        payments: [],
      }],
    })
    mocks.getOaState.mockResolvedValue({
      modules: {
        receivable: [{
          id: 'AR-1',
          billType: '应收',
          counterparty: '客户甲',
          unpaidAmount: 1000,
          dueDate: '2026-07-01',
          status: '部分收款',
        }],
      },
    })
  })

  it('keeps finance warnings out of a regular user response', async () => {
    const result = await listExpiryWarnings({ userId: 1, roles: ['USER'] })

    expect(result.map(item => item.category)).toEqual(['证照'])
    expect(mocks.getOaState).not.toHaveBeenCalled()
  })

  it('includes loan and receivable warnings for finance roles', async () => {
    const result = await listExpiryWarnings({ userId: 2, roles: ['FINANCE_MANAGER'] })

    expect(result.map(item => item.category).sort()).toEqual(['应收应付', '证照', '车贷'].sort())
    expect(mocks.getOaState).toHaveBeenCalledOnce()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  requireAnyRole: vi.fn(),
  syncUsersSalary: vi.fn(),
}))

vi.mock('h3', () => ({
  defineEventHandler: (handler: any) => handler,
}))
vi.mock('../../../services/approval/oa-state-service', () => ({
  approvalOaStateService: { get: mocks.get },
}))
vi.mock('../../../services/system/user-salary-sync-service', () => ({
  syncUsersSalary: mocks.syncUsersSalary,
}))
vi.mock('../../../utils/security', () => ({
  requireAnyRole: mocks.requireAnyRole,
}))

describe('oA module data route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ modules: {}, cashBalanceRecords: [], revision: 7 })
  })

  it('reads the OA state without synchronizing salary records', async () => {
    const { default: handler } = await import('./data.get')

    await expect(handler({} as any)).resolves.toMatchObject({
      code: 200,
      data: { revision: 7 },
    })
    expect(mocks.requireAnyRole).toHaveBeenCalledWith({}, ['ADMIN', 'FINANCE_MANAGER', 'DEPT_LEADER', 'APPROVER'])
    expect(mocks.get).toHaveBeenCalledOnce()
    expect(mocks.syncUsersSalary).not.toHaveBeenCalled()
  })
})

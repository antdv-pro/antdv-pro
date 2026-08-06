import { beforeEach, describe, expect, it, vi } from 'vitest'

import submitApprovalHandler from './approval/instances/submit.post'
import approveTaskHandler from './approval/tasks/[id]/approve.post'
import syncGpsDevicesHandler from './gps/devices/sync.post'
import gpsVehiclesHandler from './gps/vehicles/index.get'
import loginHandler from './login.post'
import saveOfficeVehicleHandler from './office-vehicle/vehicles/save.post'
import createRegulatoryFeeHandler from './transport/fees/create.post'
import replaceTransportHandler from './transport/operations/data.put'

const mocks = vi.hoisted(() => ({
  body: {} as Record<string, any>,
  query: {} as Record<string, any>,
  params: {} as Record<string, string>,
  status: vi.fn(),
  sessionUser: { id: 7, nickname: '会话用户', deptId: 'D1', deptName: '运输部', roles: ['USER'], status: 'enabled' },
  requireAnyRole: vi.fn(),
  requireAdmin: vi.fn(),
  approval: { approve: vi.fn(), submit: vi.fn() },
  gps: { listVehicles: vi.fn(), syncDevices: vi.fn() },
  officeVehicle: { saveVehicle: vi.fn() },
  regulatoryFee: { create: vi.fn() },
  transport: { replaceDataset: vi.fn() },
  validateLogin: vi.fn(),
}))

vi.mock('h3', () => ({
  defineEventHandler: (handler: any) => handler,
  readBody: vi.fn(async () => mocks.body),
  getQuery: vi.fn(() => mocks.query),
  getRouterParam: vi.fn((_event: any, key: string) => mocks.params[key]),
  getRequestHeader: vi.fn(() => 'session-token'),
  getRequestIP: vi.fn(() => '127.0.0.1'),
  setResponseStatus: mocks.status,
}))
vi.mock('../utils/security', () => ({
  requireAuthenticatedUser: vi.fn(() => mocks.sessionUser),
  requireAnyRole: mocks.requireAnyRole,
  requireAdmin: mocks.requireAdmin,
  getTrustedAccessQuery: vi.fn(() => ({ userId: mocks.sessionUser.id, role: 'USER' })),
}))
vi.mock('../utils/approval-store', () => ({ approvalStore: mocks.approval }))
vi.mock('../utils/gps-store', () => ({ gpsStore: mocks.gps }))
vi.mock('../utils/office-vehicle-store', () => ({ officeVehicleStore: mocks.officeVehicle }))
vi.mock('../utils/office-vehicle-context', () => ({
  getOperatorContext: vi.fn(() => ({ userId: 7, roles: ['USER'] })),
  ok: vi.fn((data: any, msg = '获取成功') => ({ code: 200, msg, data })),
  fail: vi.fn((error: any) => ({ code: 400, msg: error.message })),
}))
vi.mock('../utils/regulatory-fee-store', () => ({ createRegulatoryFee: mocks.regulatoryFee.create }))
vi.mock('../utils/transport-operation-store', () => ({ transportOperationStore: mocks.transport }))
vi.mock('../utils/system-store', () => ({ systemStore: { validateLogin: mocks.validateLogin } }))

const event = { req: { method: 'POST' }, res: {}, context: { params: {} } } as any

describe('security-sensitive routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.body = {}
    mocks.query = {}
    mocks.params = {}
    mocks.approval.approve.mockResolvedValue({ instance: { id: 'I1' } })
    mocks.approval.submit.mockResolvedValue({ instance: { id: 'I1' } })
    mocks.gps.listVehicles.mockResolvedValue([])
    mocks.gps.syncDevices.mockResolvedValue({ devices: [] })
    mocks.officeVehicle.saveVehicle.mockResolvedValue({ id: 'V1' })
    mocks.regulatoryFee.create.mockResolvedValue({ id: 1 })
    mocks.transport.replaceDataset.mockResolvedValue({ orders: [] })
  })

  it('disables mobile login without trying fixed account credentials', async () => {
    mocks.body = { type: 'mobile', mobile: '13800000001', code: 'anything' }
    await expect((loginHandler as any)(event)).resolves.toEqual({
      code: 501,
      msg: '手机验证码登录尚未接入可信验证码服务，请使用账号密码登录',
    })
    expect(mocks.status).toHaveBeenCalledWith(event, 501)
    expect(mocks.validateLogin).not.toHaveBeenCalled()
  })

  it('uses the session user for approval actions and blocks management-system initiation', async () => {
    mocks.params.id = 'T1'
    mocks.body = { operatorId: 1, operatorName: '伪造管理员', comment: '同意' }
    await (approveTaskHandler as any)(event)
    expect(mocks.approval.approve).toHaveBeenCalledWith({
      taskId: 'T1',
      operatorId: 7,
      operatorName: '会话用户',
      comment: '同意',
    })

    mocks.body = { applicantId: 1, applicantName: '伪造管理员', deptId: 'ADMIN', businessType: 'fee' }
    await expect((submitApprovalHandler as any)(event)).resolves.toEqual({
      code: 400,
      msg: '审批单请在企业微信填写并发起，管理系统仅同步展示审批进度和结果',
    })
    expect(mocks.approval.submit).not.toHaveBeenCalled()
  })

  it('overrides forged GPS scope with the trusted session scope', async () => {
    mocks.query = { userId: 1, role: 'ADMIN' }
    await (gpsVehiclesHandler as any)(event)
    expect(mocks.gps.listVehicles).toHaveBeenCalledWith({ userId: 7, role: 'USER' })
  })

  it('checks authorization before accepting destructive dataset replacement', async () => {
    mocks.requireAnyRole.mockImplementationOnce(() => {
      throw new Error('无权执行此操作')
    })
    mocks.body = { orders: [{ code: 'O1' }] }
    await expect((replaceTransportHandler as any)(event)).rejects.toThrow('无权执行此操作')
    expect(mocks.transport.replaceDataset).not.toHaveBeenCalled()
  })

  it.each([
    ['GPS sync', syncGpsDevicesHandler, mocks.gps.syncDevices],
    ['office vehicle save', saveOfficeVehicleHandler, mocks.officeVehicle.saveVehicle],
    ['regulatory fee create', createRegulatoryFeeHandler, mocks.regulatoryFee.create],
  ])('rejects unauthorized %s before executing its store mutation', async (_label, handler, mutation) => {
    mocks.requireAnyRole.mockImplementationOnce(() => {
      throw new Error('无权执行此操作')
    })
    await expect((handler as any)(event)).rejects.toThrow('无权执行此操作')
    expect(mutation).not.toHaveBeenCalled()
  })
})

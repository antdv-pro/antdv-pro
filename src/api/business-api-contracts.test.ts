import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as approval from './approval'
import * as login from './common/login'
import * as menu from './common/menu'
import * as commonUser from './common/user'
import * as dashboard from './dashboard/analysis'
import { getExpiryWarningsApi } from './dashboard/expiry-warnings'
import * as gps from './gps'
import * as basicList from './list/basic-list'
import * as crudTable from './list/crud-table'
import * as tableList from './list/table-list'
import * as officeVehicle from './office-vehicle'
import * as system from './system'
import * as testApi from './test'
import * as etc from './transport/etc'
import * as fees from './transport/fees'
import * as maintenance from './transport/maintenance'
import { getTransportModuleSummaryApi } from './transport/summary'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  userStore: { userInfo: { id: 7 }, roles: ['USER'] as string[] },
}))

vi.mock('~@/composables/api', () => ({
  useGet: mocks.get,
  usePost: mocks.post,
  usePut: mocks.put,
  useDelete: mocks.del,
}))
vi.mock('~@/stores/user', () => ({ useUserStore: () => mocks.userStore }))

type ExpectedCall = [mock: keyof Pick<typeof mocks, 'get' | 'post' | 'put' | 'del'>, url: string, data?: unknown, config?: unknown]

function expectCalls(expected: ExpectedCall[]) {
  const actual = expected.map(([mock], index) => {
    const call = mocks[mock].mock.calls.shift()
    expect(call, `missing ${mock} call #${index + 1}`).toBeDefined()
    return [mock, ...(call || [])]
  })
  expect(actual).toEqual(expected.map(([mock, ...args]) => [mock, ...args]))
  expect(mocks.get).not.toHaveBeenCalled()
  expect(mocks.post).not.toHaveBeenCalled()
  expect(mocks.put).not.toHaveBeenCalled()
  expect(mocks.del).not.toHaveBeenCalled()
}

describe('business API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.userStore.userInfo = { id: 7 }
    mocks.userStore.roles = ['USER']
  })

  it('maps every approval operation to its server contract', () => {
    const operator = { operatorId: 7, operatorName: '张三' }
    approval.getApprovalTemplatesApi()
    approval.createApprovalTemplateApi({ name: '费用审批', businessTypes: ['fee'], nodes: [] })
    approval.submitApprovalApi({ businessType: 'fee', businessId: '1', businessNo: 'F1', title: '费用', applicantId: 7, applicantName: '张三' })
    approval.getApprovalInstancesApi({ status: 'PENDING' })
    approval.getApprovalDetailApi('I/1')
    approval.revokeApprovalApi('I1', operator)
    approval.getApprovalTodoApi(7, { page: 2 })
    approval.getApprovalDoneApi(7, { page: 3 })
    approval.getApprovalSubmittedApi(7, { page: 4 })
    approval.getApprovalCcApi(7, { page: 5 })
    approval.approveTaskApi('T1', operator)
    approval.rejectTaskApi('T2', operator)
    approval.transferTaskApi('T3', { ...operator, toUserId: 8, toUserName: '李四' })
    approval.getApprovalByBusinessApi('vehicle', 'V1')
    approval.getApprovalBusinessRecordsApi({ businessType: 'vehicle' })
    approval.getOaModuleStateApi()
    approval.saveOaModuleStateApi({ modules: {}, cashBalanceRecords: [] })

    expectCalls([
      ['get', '/approval/templates'],
      ['post', '/approval/templates', { name: '费用审批', businessTypes: ['fee'], nodes: [] }],
      ['post', '/approval/instances/submit', expect.objectContaining({ businessId: '1' })],
      ['get', '/approval/instances', { status: 'PENDING' }],
      ['get', '/approval/instances/I/1'],
      ['post', '/approval/instances/I1/revoke', operator],
      ['get', '/approval/tasks/todo', { userId: 7, page: 2 }],
      ['get', '/approval/tasks/done', { userId: 7, page: 3 }],
      ['get', '/approval/tasks/submitted', { userId: 7, page: 4 }],
      ['get', '/approval/cc/mine', { userId: 7, page: 5 }],
      ['post', '/approval/tasks/T1/approve', operator],
      ['post', '/approval/tasks/T2/reject', operator],
      ['post', '/approval/tasks/T3/transfer', { ...operator, toUserId: 8, toUserName: '李四' }],
      ['get', '/approval/business/vehicle/V1'],
      ['get', '/approval/business-records', { businessType: 'vehicle' }],
      ['get', '/approval/oa-module/data'],
      ['put', '/approval/oa-module/data', { modules: {}, cashBalanceRecords: [] }],
    ])
  })

  it('maps all GPS reads, syncs, bindings and geofence writes', () => {
    gps.getGpsProviderConfigsApi()
    gps.getGpsVehiclesApi()
    gps.getGpsDevicesApi()
    gps.syncGpsDevicesApi('808gps')
    gps.bindGpsDeviceApi('V1', { deviceId: 'D1' })
    gps.getGpsLatestLocationsApi()
    gps.syncGpsLatestLocationsApi()
    gps.getGpsVehicleLocationApi('V1')
    gps.getGpsVehicleTrackApi('V1', { startTime: '2026-01-01' })
    gps.getGpsAlarmsApi()
    gps.syncGpsAlarmsApi('808gps')
    gps.getGpsVehicleStatusesApi()
    gps.getGpsMapDataApi()
    gps.getGpsGeofencesApi()
    gps.getGpsSyncLogsApi()
    gps.handleGpsAlarmApi('A1', { status: 'handled' })
    gps.createGpsGeofenceApi({ name: '仓库', shape: 'circle' })
    gps.updateGpsGeofenceApi('G1', { enabled: false })
    gps.bindGpsGeofenceVehiclesApi('G1', { vehicleIds: ['V1'] })
    gps.getGpsOperationLogsApi()

    const access = { userId: 7, role: 'USER' }
    expectCalls([
      ['get', '/gps/provider-configs', undefined, { timeout: 45000, errorNotification: false }],
      ['get', '/gps/vehicles', access, { timeout: 45000, errorNotification: false }],
      ['get', '/gps/devices', undefined, { timeout: 45000, errorNotification: false }],
      ['post', '/gps/devices/sync', { provider: '808gps' }, { timeout: 45000, errorNotification: true }],
      ['post', '/gps/vehicles/V1/bind-device', { deviceId: 'D1' }],
      ['get', '/gps/locations/latest', access],
      ['post', '/gps/locations/sync', { provider: undefined }, { timeout: 45000, errorNotification: true }],
      ['get', '/gps/vehicles/V1/location'],
      ['get', '/gps/vehicles/V1/track', { startTime: '2026-01-01' }, { timeout: 60000, errorNotification: false }],
      ['get', '/gps/alarms', access],
      ['post', '/gps/alarms/sync', { provider: '808gps' }, { timeout: 45000, errorNotification: true }],
      ['get', '/gps/status'],
      ['get', '/gps/map-data', access, { timeout: 45000, errorNotification: false }],
      ['get', '/gps/geofences'],
      ['get', '/gps/sync-logs', undefined, { timeout: 45000, errorNotification: false }],
      ['post', '/gps/alarms/A1/handle', { status: 'handled' }],
      ['post', '/gps/geofences', { name: '仓库', shape: 'circle' }],
      ['put', '/gps/geofences/G1', { enabled: false }],
      ['post', '/gps/geofences/G1/bind-vehicles', { vehicleIds: ['V1'] }],
      ['get', '/gps/operation-logs', undefined, { timeout: 45000, errorNotification: false }],
    ])
  })

  it('uses administrator access scope for GPS queries', () => {
    mocks.userStore.roles = ['ADMIN']
    gps.getGpsVehiclesApi()
    expect(mocks.get).toHaveBeenCalledWith('/gps/vehicles', { userId: 7, role: 'ADMIN' }, { timeout: 45000, errorNotification: false })
  })

  it('maps every office vehicle operation', () => {
    const query = { current: 2, pageSize: 20 }
    officeVehicle.getOfficeVehicleSummaryApi(query)
    officeVehicle.getOfficeVehicleListApi(query)
    officeVehicle.saveOfficeVehicleApi({ plateNo: '京A1' })
    officeVehicle.saveOfficeVehicleBatchApi({ vehicle: { plateNo: '京A2' }, expenses: [] })
    officeVehicle.getOfficeVehicleDetailApi('V1')
    officeVehicle.deleteOfficeVehicleApi('V1')
    officeVehicle.getOfficeVehicleExpenseListApi(query)
    officeVehicle.saveOfficeVehicleExpenseApi({ vehicleId: 'V1', amount: 10 })
    officeVehicle.deleteOfficeVehicleExpenseApi('E1')
    officeVehicle.submitOfficeVehicleExpenseApprovalApi('E1')
    officeVehicle.changeOfficeVehicleExpenseStatusApi('E1', '已确认')
    officeVehicle.exportOfficeVehicleExpensesApi(query)
    officeVehicle.getOfficeVehicleLicenseListApi(query)
    officeVehicle.saveOfficeVehicleLicenseApi({ vehicleId: 'V1', licenseNo: 'L1' })
    officeVehicle.deleteOfficeVehicleLicenseApi('L1')
    officeVehicle.getOfficeVehicleInsuranceListApi(query)
    officeVehicle.saveOfficeVehicleInsuranceApi({ vehicleId: 'V1', policyNo: 'P1' })
    officeVehicle.getOfficeVehicleReminderListApi(query)
    officeVehicle.handleOfficeVehicleReminderApi('R1', '已处理')
    officeVehicle.getOfficeVehicleLogsApi('V1')

    expectCalls([
      ['post', '/office-vehicle/summary', query],
      ['post', '/office-vehicle/vehicles', query],
      ['post', '/office-vehicle/vehicles/save', { plateNo: '京A1' }],
      ['post', '/office-vehicle/batch-save', { vehicle: { plateNo: '京A2' }, expenses: [] }],
      ['get', '/office-vehicle/vehicles/V1'],
      ['del', '/office-vehicle/vehicles/V1'],
      ['post', '/office-vehicle/expenses', query],
      ['post', '/office-vehicle/expenses/save', { vehicleId: 'V1', amount: 10 }],
      ['del', '/office-vehicle/expenses/E1'],
      ['post', '/office-vehicle/expenses/E1/submit-approval'],
      ['put', '/office-vehicle/expenses/E1/status', { status: '已确认' }],
      ['post', '/office-vehicle/expenses/export', query],
      ['post', '/office-vehicle/licenses', query],
      ['post', '/office-vehicle/licenses/save', { vehicleId: 'V1', licenseNo: 'L1' }],
      ['del', '/office-vehicle/licenses/L1'],
      ['post', '/office-vehicle/insurances', query],
      ['post', '/office-vehicle/insurances/save', { vehicleId: 'V1', policyNo: 'P1' }],
      ['post', '/office-vehicle/reminders', query],
      ['post', '/office-vehicle/reminders/R1/handle', { handleRemark: '已处理' }],
      ['get', '/office-vehicle/logs', { recordId: 'V1' }],
    ])
  })

  it('maps system administration operations', () => {
    system.getSystemUsersApi({ keyword: '张' })
    system.saveSystemUserApi({ username: 'zhang' })
    system.deleteSystemUserApi(1)
    system.disableSystemUserApi(1, 'disabled')
    system.resetSystemUserPasswordApi(1, 'new-password')
    system.getSystemOrganizationsApi()
    system.saveSystemOrganizationApi({ name: '财务部' })
    system.deleteSystemOrganizationApi('O1')
    system.getSystemRolesApi()
    system.saveSystemRoleApi({ code: 'FINANCE' })
    system.deleteSystemRoleApi('R1')
    system.getSystemDictionariesApi({ type: 'vehicle' })
    system.saveSystemDictionaryApi({ type: 'vehicle', value: 'truck' })
    system.deleteSystemDictionaryApi('D1')
    system.getSystemLoginLogsApi({ keyword: 'zhang' })
    system.getSystemOperationLogsApi({ action: 'update' })
    system.recordSystemOperationApi({ module: 'user', action: 'update', content: '更新用户' })

    expectCalls([
      ['get', '/system/users', { keyword: '张' }],
      ['post', '/system/users/save', { username: 'zhang' }],
      ['del', '/system/users/1'],
      ['post', '/system/users/1/disable', { status: 'disabled' }],
      ['post', '/system/users/1/reset-password', { password: 'new-password' }],
      ['get', '/system/orgs'],
      ['post', '/system/orgs/save', { name: '财务部' }],
      ['del', '/system/orgs/O1'],
      ['get', '/system/roles'],
      ['post', '/system/roles/save', { code: 'FINANCE' }],
      ['del', '/system/roles/R1'],
      ['get', '/system/dicts', { type: 'vehicle' }],
      ['post', '/system/dicts/save', { type: 'vehicle', value: 'truck' }],
      ['del', '/system/dicts/D1'],
      ['get', '/system/logs/login', { keyword: 'zhang' }],
      ['get', '/system/logs/operation', { action: 'update' }],
      ['post', '/system/logs/operation-record', { module: 'user', action: 'update', content: '更新用户' }],
    ])
  })

  it('maps regulatory fee and transport summary operations', () => {
    const query = { current: 1, pageSize: 10 }
    const payload = { feeType: '保险', totalAmount: 1200, validStartDate: '2026-01-01', validEndDate: '2026-12-31' }
    fees.getRegulatoryFeeListApi(query)
    fees.getRegulatoryFeeDetailApi(1)
    fees.createRegulatoryFeeApi(payload)
    fees.updateRegulatoryFeeApi(1, payload)
    fees.deleteRegulatoryFeeApi(1)
    fees.changeRegulatoryFeeStatusApi(1, 'disabled')
    fees.submitRegulatoryFeeApprovalApi(1)
    fees.checkRegulatoryFeeNameApi('保险', 1)
    fees.exportRegulatoryFeeApi(query)
    fees.getRegulatoryFeeSummaryApi(query)
    fees.getRegulatoryFeeOverviewApi({ plateNo: '京A1' })
    maintenance.getMaintenanceSummaryApi({ records: [{ id: 1 }] })
    maintenance.createMaintenanceRecordApi({ plateNo: '青H12345' })
    maintenance.updateMaintenanceRecordApi(1, { plateNo: '青H12345' })
    maintenance.deleteMaintenanceRecordApi(1)
    maintenance.importMaintenanceRecordsApi([{ plateNo: '青H12345' }])
    maintenance.createMaintenanceInventoryApi({ movement: { type: '入库' } })
    getTransportModuleSummaryApi({ moduleName: '订单', rows: [{ id: 1 }] })
    etc.getTransportEtcPageApi({ current: 1, pageSize: 20, keyword: '青A' })
    etc.importTransportEtcApi([{ code: 'E1' }])

    expectCalls([
      ['post', '/transport/fees', query],
      ['get', '/transport/fees/1'],
      ['post', '/transport/fees/create', payload],
      ['put', '/transport/fees/1', payload],
      ['del', '/transport/fees/1'],
      ['put', '/transport/fees/1/status', { manualStatus: 'disabled' }],
      ['post', '/transport/fees/1/submit-approval'],
      ['get', '/transport/fees/check-name', { feeName: '保险', excludeId: 1 }],
      ['post', '/transport/fees/export', query],
      ['post', '/transport/fees/summary', query],
      ['post', '/transport/fees/overview', { plateNo: '京A1' }],
      ['post', '/transport/maintenance/summary', { records: [{ id: 1 }] }],
      ['post', '/transport/maintenance/create', { plateNo: '青H12345' }],
      ['put', '/transport/maintenance/1', { plateNo: '青H12345' }],
      ['del', '/transport/maintenance/1'],
      ['post', '/transport/maintenance/import', { records: [{ plateNo: '青H12345' }] }],
      ['post', '/transport/maintenance/inventory', { movement: { type: '入库' } }],
      ['post', '/transport/module/summary', { moduleName: '订单', rows: [{ id: 1 }] }],
      ['get', '/transport/etc', { current: 1, pageSize: 20, keyword: '青A' }],
      ['post', '/transport/etc/import', { records: [{ code: 'E1' }] }],
    ])
  })

  it('loads the unified dashboard expiry warning feed', () => {
    getExpiryWarningsApi()
    expectCalls([
      ['get', '/dashboard/expiry-warnings'],
    ])
  })

  it('maps authentication, user, menu, sample and list operations', async () => {
    login.loginApi({ username: 'admin', password: 'secret' })
    login.logoutApi()
    menu.getRouteMenusApi()
    commonUser.getUserInfoApi()
    commonUser.getUserListApi({ keyword: '张' })
    dashboard.getListApi({ title: '项目' })
    dashboard.createListApi({ title: '新项目' })
    dashboard.editListApi({ id: 1, title: '项目', username: 'admin', password: 'secret' })
    dashboard.delListApi(1)
    basicList.getListApi({ title: '基础' })
    crudTable.getListApi({ name: '配置' })
    crudTable.deleteApi(2)
    tableList.getListApi({ name: '咨询' })
    tableList.deleteApi(3)
    testApi.test200()
    testApi.test401()
    testApi.test500()
    testApi.testPut()
    testApi.testPost()
    testApi.testDelete()

    expectCalls([
      ['post', '/login', { username: 'admin', password: 'secret' }, { token: false, customDev: true, loading: true }] as any,
      ['get', '/logout'],
      ['get', '/menu'],
      ['get', '/user/info'],
      ['get', '/users', { keyword: '张' }],
      ['post', '/list', { title: '项目' }],
      ['post', '/list/create', { title: '新项目' }],
      ['put', '/list', { id: 1, title: '项目', username: 'admin', password: 'secret' }],
      ['del', '/list/1'],
      ['post', '/list/basic-list', { title: '基础' }],
      ['post', '/list/crud-table', { name: '配置' }],
      ['del', '/list/2'],
      ['post', '/list/consult-list', { name: '咨询' }],
      ['del', '/list/3'],
      ['get', '/'],
      ['get', '/401'],
      ['get', '/500'],
      ['put', '/test'],
      ['post', '/test'],
      ['del', '/test'],
    ])
  })
})

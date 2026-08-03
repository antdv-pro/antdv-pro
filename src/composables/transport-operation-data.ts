import { nextTick, ref, watch } from 'vue'

export interface FuelRecord extends Record<string, string> {
  code: string
  month: string
  date: string
  plateNo: string
  location: string
  product: string
  quantity: string
  quantityUnit: 'L' | 'kg'
  amount: string
  driver: string
}

export interface EtcRecord extends Record<string, string> {
  code: string
  summaryNo: string
  name: string
  owner: string
  status: string
  amount: string
  updatedAt: string
  month: string
  plateNo: string
  invoiceNo: string
  cardNo: string
}

export interface OrderRecord extends Record<string, string> {
  code: string
  shipDate: string
  financeMonth: string
  plateNo: string
  trailerNo: string
  driver: string
  escort: string
  customer: string
  routeLine: string
  loadingAddress: string
  unloadingAddress: string
  orderType: string
  cargoName: string
  sentWeight: string
  receivedWeight: string
  freightPrice: string
  freightTotal: string
  taxRate: string
  taxedFreight: string
  receiptStatus: string
  settlementStatus: string
  status: string
  remark: string
}

export interface DriverPayrollRecord extends Record<string, string | undefined> {
  code: string
  name: string
  crewRole?: '司机' | '押运员' | '模式配置'
  plateNo?: string
  plateNos?: string
  financeMonth?: string
  owner: string
  status: string
  salaryMode?: string
  modeStartDate?: string
  entryDate?: string
  attendanceDays?: string
  attendanceDates?: string
  lastAttendanceDate?: string
  todayAttendance?: string
  tripCount?: string
  baseSalary?: string
  tripCommission?: string
  allowance?: string
  deduction?: string
  grossSalary?: string
  netSalary?: string
  amount: string
  updatedAt: string
  approvalStatus?: string
  approvalInstanceId?: string
}

export interface MaintenanceRecord {
  id: number
  repairDate: string
  financialMonth: string
  plateNo: string
  trailerNo: string
  project: string
  shop: string
  mileage: number
  items: string
  payType: string
  driver: string
  amount: number
  status: '待审核' | '已审核' | '推修中' | '已驳回' | '已作废'
  remark: string
  approvalStatus?: string
  approvalInstanceId?: string
  createdBy?: string | number
  permissions?: import('~@/types/record-permission').PermissionAwareRecord['permissions']
}

export interface InventoryMovementRecord {
  id: number
  code: string
  movementDate: string
  type: '入库' | '出库'
  partName: string
  specification: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
  supplier: string
  plateNo: string
  operator: string
  remark: string
  maintenanceId?: number
}

export type LoanStatus = '未开始' | '还款中' | '临近到期' | '已逾期' | '已结清'
export type PaymentMethod = '银行转账' | '现金' | '承兑' | '其他'

export interface RepaymentRecord {
  id: number
  periodNo: number
  paymentDate: string
  amount: number
  principal: number
  interest: number
  method: PaymentMethod
  voucherNo?: string
  remark?: string
}

export interface VehicleLoanRecord {
  id: number
  contractNo: string
  plateNo: string
  trailerNo?: string
  lender: string
  loanAmount: number
  principalAmount: number
  annualRate: number
  totalPeriods: number
  startDate: string
  firstDueDate: string
  monthlyPayment: number
  owner?: string
  remark?: string
  payments: RepaymentRecord[]
  approvalStatus?: string
  approvalInstanceId?: string
}

export interface TransportOperationDataset {
  orders: OrderRecord[]
  fuels: FuelRecord[]
  etc: EtcRecord[]
  driverPayrolls: DriverPayrollRecord[]
  maintenance: MaintenanceRecord[]
  inventoryMovements: InventoryMovementRecord[]
  vehicleLoans: VehicleLoanRecord[]
  baseCompanies?: Array<Record<string, string>>
  baseCustomers: Array<Record<string, string>>
  baseVehicles: Array<Record<string, string>>
  baseCrews: Array<Record<string, string>>
  baseRoutes: Array<Record<string, string>>
}

function cloneRows<T>(rows: T[] = []): T[] {
  return JSON.parse(JSON.stringify(rows))
}

const gasFuelPlanFields = [
  'plannedFuelConsumption',
  'newVehiclePlannedFuelConsumption',
  'oldVehiclePlannedFuelConsumption',
  'newGasVehiclePlannedFuelConsumption',
  'oldGasVehiclePlannedFuelConsumption',
  'roundTripNewGasVehiclePlannedFuelConsumption',
  'roundTripOldGasVehiclePlannedFuelConsumption',
]

const dieselFuelPlanFields = [
  'newDieselVehiclePlannedFuelConsumption',
  'oldDieselVehiclePlannedFuelConsumption',
  'roundTripNewDieselVehiclePlannedFuelConsumption',
  'roundTripOldDieselVehiclePlannedFuelConsumption',
]

function normalizeFuelPlanUnit(value: unknown, unit: 'kg' | 'L') {
  const text = String(value ?? '').trim()
  if (!text)
    return ''
  const amount = text.replace(/\s*(?:kg|l|升)\xA0*$/i, '').trim()
  return amount ? `${amount}${unit}` : ''
}

export function normalizeTransportBaseRouteFuelUnits(row: Record<string, string>) {
  const normalized = { ...row }
  gasFuelPlanFields.forEach((field) => {
    if (normalized[field])
      normalized[field] = normalizeFuelPlanUnit(normalized[field], 'kg')
  })
  dieselFuelPlanFields.forEach((field) => {
    if (normalized[field])
      normalized[field] = normalizeFuelPlanUnit(normalized[field], 'L')
  })
  return normalized
}

export const transportOperationLoading = ref(false)
export const transportOperationError = ref('')
export const transportOperationHydrated = ref(false)
export const transportOperationSaving = ref(false)
export const transportOperationDirty = ref(false)

export const transportOrderRows = ref<OrderRecord[]>([])
export const transportFuelRows = ref<FuelRecord[]>([])
export const transportEtcRows = ref<EtcRecord[]>([])
export const transportDriverPayrollRows = ref<DriverPayrollRecord[]>([])
export const transportMaintenanceRows = ref<MaintenanceRecord[]>([])
export const transportInventoryMovementRows = ref<InventoryMovementRecord[]>([])
export const transportVehicleLoanRows = ref<VehicleLoanRecord[]>([])
export const transportBaseCompanyRows = ref<Array<Record<string, string>>>([])
export const transportBaseCustomerRows = ref<Array<Record<string, string>>>([])
export const transportBaseVehicleRows = ref<Array<Record<string, string>>>([])
export const transportBaseCrewRows = ref<Array<Record<string, string>>>([])
export const transportBaseRouteRows = ref<Array<Record<string, string>>>([])

let persistTimer: ReturnType<typeof setTimeout> | undefined
let applyingRemoteData = false
let loadPromise: Promise<void> | undefined
let saveQueue: Promise<void> = Promise.resolve()
let changeVersion = 0
let datasetRevision = ''
let baselineDataset: TransportOperationDataset | undefined

const datasetKeys: Array<keyof TransportOperationDataset> = [
  'orders',
  'fuels',
  'etc',
  'driverPayrolls',
  'maintenance',
  'inventoryMovements',
  'vehicleLoans',
  'baseCompanies',
  'baseCustomers',
  'baseVehicles',
  'baseCrews',
  'baseRoutes',
]

function normalizeCustomerName(value: unknown) {
  return String(value ?? '').trim()
}

function toAmount(value: unknown) {
  const amount = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

export function calculateCustomerBidBalance(customer: Record<string, string>, orders: OrderRecord[]) {
  const bidAmount = toAmount(customer.bidAmount)
  const customerName = normalizeCustomerName(customer.name)
  const startDate = String(customer.bidStartDate ?? '').trim().slice(0, 10)
  if (bidAmount <= 0 || !customerName || !startDate)
    return undefined

  const recordedFreight = orders.reduce((total, order) => {
    const orderCustomer = normalizeCustomerName(order.customer)
    const shipDate = String(order.shipDate ?? '').trim().slice(0, 10)
    if (orderCustomer !== customerName || !shipDate || shipDate < startDate)
      return total
    return total + toAmount(order.freightTotal)
  }, 0)

  return {
    bidAmount,
    recordedFreight,
    remainingAmount: Math.max(0, bidAmount - recordedFreight),
    progress: Math.min(100, (recordedFreight / bidAmount) * 100),
  }
}

function createCustomerCode(rows: Array<Record<string, string>>) {
  const maxNo = rows.reduce((max, row) => {
    const match = String(row.code ?? '').match(/^KH(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `KH${String(maxNo + 1).padStart(3, '0')}`
}

export function syncTransportCustomersFromOrders() {
  const customers = transportBaseCustomerRows.value
  const customerNames = new Set(customers.map(row => normalizeCustomerName(row.name)).filter(Boolean))
  const orderCustomers = [...new Set(transportOrderRows.value.map(row => normalizeCustomerName(row.customer)).filter(Boolean))]
  let changed = false

  orderCustomers.forEach((name) => {
    if (customerNames.has(name))
      return
    customers.push({
      code: createCustomerCode(customers),
      name,
      area: '',
      contact: '',
      bidAmount: '',
      bidStartDate: '',
      progress: '0',
      status: '合作中',
      updatedAt: new Date().toISOString().slice(0, 10),
      source: '运输订单',
    })
    customerNames.add(name)
    changed = true
  })
  return changed
}

function normalizeCrewPlateNo(value: unknown) {
  return String(value ?? '').trim().replace(/[\s·•\-]/g, '').toUpperCase()
}

function payrollMonthKey(date = new Date()) {
  const financialMonth = new Date(date.getFullYear(), date.getMonth() + (date.getDate() >= 26 ? 1 : 0), 1)
  return `${financialMonth.getFullYear()}-${String(financialMonth.getMonth() + 1).padStart(2, '0')}`
}

function payrollMonthStart(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(year, monthNumber - 2, 26)
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-26`
}

function previousPayrollMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const previous = new Date(year, monthNumber - 2, 1)
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`
}

function lastSalaryMode(record: Record<string, string | undefined>) {
  try {
    const history = JSON.parse(String(record.salaryModeHistory || '[]'))
    if (Array.isArray(history) && history.length) {
      const latest = history
        .filter(item => item?.mode && item?.startDate)
        .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
        .at(-1)
      if (latest)
        return { mode: String(latest.mode), amount: String(latest.amount || '0.00') }
    }
  }
  catch {}
  return { mode: String(record.salaryMode || '固定月薪'), amount: String(record.modeAmount || record.baseSalary || '0.00') }
}

function configuredSalaryModeAmount(mode: string) {
  return String(transportDriverPayrollRows.value.find(row => row.crewRole === '模式配置' && row.salaryMode === mode)?.modeAmount || '0.00')
}

/** Keep payroll identities and vehicle bindings aligned with the base crew archive. */
export function syncDriverPayrollFromBaseData(date = new Date()) {
  const month = payrollMonthKey(date)
  const bindings = new Map<string, { name: string, plates: Set<string> }>()
  const addBinding = (nameValue: unknown, plateValue: unknown) => {
    const name = String(nameValue ?? '').trim()
    const plate = normalizeCrewPlateNo(plateValue)
    if (!name || !plate)
      return
    const binding = bindings.get(name) ?? { name, plates: new Set<string>() }
    binding.plates.add(plate)
    bindings.set(name, binding)
  }

  transportBaseCrewRows.value.forEach((row) => {
    const plate = row.plateNo || row.vehicleInfo || row.vehicle || row.code
    addBinding(row.driverName || row.driver, plate)
  })
  transportBaseVehicleRows.value.forEach((row) => {
    const plate = row.plateNo || row.code
    addBinding(row.driverName || row.driver, plate)
  })

  let changed = false
  bindings.forEach((binding) => {
    const existing = transportDriverPayrollRows.value.find((row) => {
      const rowRole = row.crewRole || '司机'
      return rowRole === '司机' && String(row.name ?? '').trim() === binding.name && String(row.financeMonth || '') === month
    })
    const plates = [...binding.plates].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    const plateNos = plates.join('、')
    if (existing) {
      if (existing.manualPlateNos === 'true')
        return
      if (existing.crewRole !== '司机' || existing.plateNos !== plateNos || existing.plateNo !== plates[0]) {
        existing.crewRole = '司机'
        existing.plateNos = plateNos
        existing.plateNo = plates[0]
        existing.owner = `${plateNos} / ${existing.financeMonth || payrollMonthKey()}`
        changed = true
      }
      return
    }

    const previousRecord = transportDriverPayrollRows.value.find((row) => {
      const rowRole = row.crewRole || '司机'
      return rowRole === '司机' && String(row.name ?? '').trim() === binding.name && String(row.financeMonth || '') === previousPayrollMonth(month)
    })
    const inheritedMode = previousRecord ? lastSalaryMode(previousRecord) : { mode: '固定月薪', amount: configuredSalaryModeAmount('固定月薪') }
    const inheritedPlateNos = previousRecord?.plateNos || previousRecord?.plateNo || plateNos
    const inheritedPlates = String(inheritedPlateNos).split(/[、,，/]/).map(item => normalizeCrewPlateNo(item)).filter(Boolean)
    const monthStart = payrollMonthStart(month)
    const sequence = transportDriverPayrollRows.value.length + 1
    transportDriverPayrollRows.value.push({
      code: `XC${month.replace('-', '')}${String(sequence).padStart(4, '0')}`,
      name: binding.name,
      crewRole: '司机',
      plateNo: inheritedPlates[0] || plates[0],
      plateNos: inheritedPlates.join('、') || plateNos,
      financeMonth: month,
      owner: `${inheritedPlates.join('、') || plateNos} / ${month}`,
      status: '核算中',
      salaryMode: inheritedMode.mode,
      modeAmount: inheritedMode.amount,
      salaryModeHistory: JSON.stringify([{ mode: inheritedMode.mode, startDate: monthStart, amount: inheritedMode.amount }]),
      modeStartDate: monthStart,
      plateStartDates: previousRecord?.plateStartDates || '{}',
      manualPlateNos: previousRecord ? 'true' : '',
      attendanceDays: '0',
      attendanceDates: '',
      tripCount: '0',
      baseSalary: inheritedMode.mode.includes('固定') || inheritedMode.mode === '底薪+差费' ? inheritedMode.amount : '0.00',
      tripCommission: '0.00',
      allowance: '0.00',
      deduction: '0.00',
      grossSalary: '0.00',
      netSalary: '0.00',
      amount: '0.00',
      updatedAt: new Date().toISOString().slice(0, 10),
    })
    changed = true
  })
  return changed
}

function authHeaders() {
  return {
    Authorization: localStorage.getItem('Authorization') || '',
    'Content-Type': 'application/json',
  }
}

async function fetchTransportOperation(input: RequestInfo | URL, init?: RequestInit) {
  const retryDelays = [750, 1500]
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init)
    }
    catch (error) {
      if (attempt >= retryDelays.length)
        throw new Error('运输服务暂时无法连接，请稍后重试')
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]))
    }
  }
}

function currentDataset(): TransportOperationDataset {
  return {
    orders: cloneRows(transportOrderRows.value),
    fuels: cloneRows(transportFuelRows.value),
    etc: cloneRows(transportEtcRows.value),
    driverPayrolls: cloneRows(transportDriverPayrollRows.value),
    maintenance: cloneRows(transportMaintenanceRows.value),
    inventoryMovements: cloneRows(transportInventoryMovementRows.value),
    vehicleLoans: cloneRows(transportVehicleLoanRows.value),
    baseCompanies: cloneRows(transportBaseCompanyRows.value),
    baseCustomers: cloneRows(transportBaseCustomerRows.value),
    baseVehicles: cloneRows(transportBaseVehicleRows.value),
    baseCrews: cloneRows(transportBaseCrewRows.value),
    baseRoutes: cloneRows(transportBaseRouteRows.value),
  }
}

function datasetPartitionChanged(
  left: Partial<TransportOperationDataset>,
  right: Partial<TransportOperationDataset>,
  key: keyof TransportOperationDataset,
) {
  return JSON.stringify(left[key] ?? []) !== JSON.stringify(right[key] ?? [])
}

async function fetchLatestDataset() {
  const response = await fetchTransportOperation('/api/transport/operations/data', {
    headers: authHeaders(),
  })
  const result = await response.json()
  if (result.code !== 200)
    throw new Error(result.msg || '运输运营数据刷新失败')
  return {
    data: result.data as Partial<TransportOperationDataset>,
    revision: String(result.revision || ''),
  }
}

async function rebaseUnrelatedRemoteChanges(local: TransportOperationDataset) {
  if (!baselineDataset)
    return undefined

  const latest = await fetchLatestDataset()
  const changedKeys = datasetKeys.filter(key => datasetPartitionChanged(local, baselineDataset!, key))
  const conflictingKeys = changedKeys.filter(key => datasetPartitionChanged(latest.data, baselineDataset!, key))
  if (conflictingKeys.length)
    return undefined

  const merged = { ...latest.data } as TransportOperationDataset
  changedKeys.forEach((key) => {
    ;(merged as any)[key] = cloneRows<any>(local[key] as any[])
  })
  return { data: merged, revision: latest.revision }
}

function applyDataset(data: Partial<TransportOperationDataset>) {
  applyingRemoteData = true
  transportOrderRows.value = cloneRows(data.orders)
  transportFuelRows.value = cloneRows(data.fuels)
  transportEtcRows.value = cloneRows(data.etc)
  transportDriverPayrollRows.value = cloneRows(data.driverPayrolls)
  transportMaintenanceRows.value = cloneRows(data.maintenance)
  transportInventoryMovementRows.value = cloneRows(data.inventoryMovements)
  transportVehicleLoanRows.value = cloneRows(data.vehicleLoans)
  transportBaseCompanyRows.value.splice(0, transportBaseCompanyRows.value.length, ...cloneRows(data.baseCompanies))
  transportBaseCustomerRows.value.splice(0, transportBaseCustomerRows.value.length, ...cloneRows(data.baseCustomers))
  transportBaseVehicleRows.value.splice(0, transportBaseVehicleRows.value.length, ...cloneRows(data.baseVehicles))
  transportBaseCrewRows.value.splice(0, transportBaseCrewRows.value.length, ...cloneRows(data.baseCrews))
  const baseRoutes = cloneRows(data.baseRoutes).map(normalizeTransportBaseRouteFuelUnits)
  transportBaseRouteRows.value.splice(0, transportBaseRouteRows.value.length, ...baseRoutes)
  const customersChanged = syncTransportCustomersFromOrders()
  nextTick(() => {
    applyingRemoteData = false
    const payrollChanged = syncDriverPayrollFromBaseData()
    if (customersChanged || payrollChanged)
      schedulePersist()
  })
}

/** Apply a server-confirmed partition mutation without triggering the legacy full-dataset autosave. */
export async function applyTransportOperationMutation(mutate: () => void) {
  const dirtyBeforeMutation = transportOperationDirty.value
  applyingRemoteData = true
  try {
    mutate()
    await nextTick()
    baselineDataset = currentDataset()
    transportOperationDirty.value = dirtyBeforeMutation
  }
  finally {
    applyingRemoteData = false
  }
}

export async function loadTransportOperationData(options: { force?: boolean } = {}) {
  if (transportOperationHydrated.value && !options.force)
    return

  if (loadPromise)
    return loadPromise

  loadPromise = (async () => {
    transportOperationLoading.value = true
    transportOperationError.value = ''
    try {
      const response = await fetchTransportOperation('/api/transport/operations/data', {
        headers: authHeaders(),
      })
      const result = await response.json()
      if (result.code !== 200)
        throw new Error(result.msg || '运输运营数据加载失败')
      applyDataset(result.data || {})
      datasetRevision = String(result.revision || '')
      baselineDataset = currentDataset()
      transportOperationHydrated.value = true
    }
    catch (error: any) {
      transportOperationError.value = error?.message || '运输运营数据加载失败'
    }
    finally {
      transportOperationLoading.value = false
    }
  })()

  try {
    await loadPromise
  }
  finally {
    loadPromise = undefined
  }
}

async function persistCurrentDataset(options: { confirmDestructiveReplace?: boolean } = {}) {
  if (!transportOperationHydrated.value || applyingRemoteData)
    return
  transportOperationSaving.value = true
  const savingVersion = changeVersion
  try {
    let data = currentDataset()
    let revision = datasetRevision
    let result: any
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetchTransportOperation('/api/transport/operations/data', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          ...data,
          expectedRevision: revision,
          ...(options.confirmDestructiveReplace ? { confirmDestructiveReplace: true } : {}),
        }),
      })
      result = await response.json()
      if (result.code === 200)
        break
      if (attempt > 0 || !String(result.msg || '').includes('数据已被其他用户更新'))
        throw new Error(result.msg || '运输运营数据保存失败')
      const rebased = await rebaseUnrelatedRemoteChanges(data)
      if (!rebased)
        throw new Error('当前模块的数据已被其他用户更新，请刷新后重新录入')
      data = rebased.data
      revision = rebased.revision
    }
    if (result?.code !== 200)
      throw new Error(result?.msg || '运输运营数据保存失败')
    datasetRevision = String(result.revision || datasetRevision)
    baselineDataset = data
    applyDataset(data)
    transportOperationError.value = ''
    if (savingVersion === changeVersion)
      transportOperationDirty.value = false
  }
  catch (error: any) {
    transportOperationError.value = error?.message || '运输运营数据保存失败'
    throw error
  }
  finally {
    transportOperationSaving.value = false
  }
}

export function saveTransportOperationData(options: { confirmDestructiveReplace?: boolean } = {}) {
  const queued = saveQueue.catch(() => undefined).then(() => persistCurrentDataset(options))
  saveQueue = queued
  return queued
}

export async function flushTransportOperationData(options: { confirmDestructiveReplace?: boolean } = {}) {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = undefined
  }
  await saveTransportOperationData(options)
}

/**
 * Synchronize before workflows that edit a single order. Automatic persistence
 * may still be queued when the user clicks Save; wait for it before taking a
 * fresh revision so the modal cannot submit against an older snapshot.
 */
export async function refreshTransportOperationDataForOrderSave() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = undefined
  }
  if (transportOperationDirty.value)
    await saveTransportOperationData()
  await saveQueue.catch(() => undefined)
  await loadTransportOperationData({ force: true })
}

function schedulePersist() {
  if (!transportOperationHydrated.value || applyingRemoteData)
    return
  changeVersion += 1
  transportOperationDirty.value = true
  if (persistTimer)
    clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = undefined
    saveTransportOperationData().catch((error: any) => {
      transportOperationError.value = error?.message || '运输运营数据保存失败'
    })
  }, 500)
}

watch([
  transportOrderRows,
  transportFuelRows,
  transportEtcRows,
  transportDriverPayrollRows,
  transportMaintenanceRows,
  transportInventoryMovementRows,
  transportVehicleLoanRows,
  transportBaseCompanyRows,
  transportBaseCustomerRows,
  transportBaseVehicleRows,
  transportBaseCrewRows,
  transportBaseRouteRows,
], schedulePersist, { deep: true })

watch(transportOrderRows, () => {
  syncTransportCustomersFromOrders()
}, { deep: true })
watch([transportBaseVehicleRows, transportBaseCrewRows], () => syncDriverPayrollFromBaseData(), { deep: true })

if (typeof window !== 'undefined')
  void loadTransportOperationData()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (!transportOperationDirty.value && !transportOperationSaving.value)
      return
    event.preventDefault()
    event.returnValue = ''
  })
}

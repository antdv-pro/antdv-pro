import type { OperatorContext } from '../../utils/office-vehicle-store'
import { buildExpiryWarnings } from '../../../shared/expiry-warnings'
import { oaModuleStore } from '../../utils/oa-module-store'
import { officeVehicleStore } from '../../utils/office-vehicle-store'
import { listRegulatoryFees } from '../../utils/regulatory-fee-store'
import { transportOperationStore } from '../../utils/transport-operation-store'

export async function listExpiryWarnings(context: OperatorContext) {
  const canViewFinance = (context.roles || []).some(role => ['ADMIN', 'FINANCE_MANAGER', 'DEPT_LEADER', 'APPROVER'].includes(String(role)))
  const [licenses, insurances, fees, transport, oaState] = await Promise.all([
    officeVehicleStore.listLicenses({ ...context, current: 1, pageSize: 100000 }),
    officeVehicleStore.listInsurances({ ...context, current: 1, pageSize: 100000 }),
    listRegulatoryFees({ current: 1, pageSize: 100000 }),
    transportOperationStore.getDataset(),
    canViewFinance ? oaModuleStore.getState() : Promise.resolve(undefined),
  ])

  return buildExpiryWarnings({
    officeLicenses: licenses.records,
    officeInsurances: insurances.records,
    regulatoryFees: fees.records,
    transportVehicles: transport.baseVehicles,
    vehicleLoans: canViewFinance ? transport.vehicleLoans : [],
    receivablePayables: oaState?.modules.receivable,
  })
}

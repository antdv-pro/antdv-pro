import dayjs from 'dayjs'
import { getCurrentFinancialMonthRange } from '~@/utils/financialPeriod'

export interface TransportOrderForm extends Record<string, string> {
  code: string
}

export function createEmptyTransportOrderForm(): TransportOrderForm {
  const currentDate = dayjs()
  const currentPeriod = getCurrentFinancialMonthRange()
  const currentPeriodYear = currentPeriod.key.slice(0, 4)
  const currentPeriodMonth = currentPeriod.key.slice(4, 6)
  return {
    code: '',
    shipDate: currentDate.format('YYYY/MM/DD'),
    financeYear: currentPeriodYear || currentDate.format('YYYY'),
    financeMonth: currentPeriodYear && currentPeriodMonth ? `${currentPeriodYear}-${currentPeriodMonth}` : currentPeriod.key,
    plateNo: '',
    trailerNo: '',
    driver: '',
    escort: '',
    customer: '',
    routeLine: '',
    loadingAddress: '',
    unloadingAddress: '',
    orderType: '往返',
    routeType: '往返双程',
    mileage: '',
    cargoName: 'LNG',
    sentWeight: '',
    receivedWeight: '',
    extraFee: '',
    priceFormula: '吨位×单价',
    freightPrice: '',
    freightTotal: '',
    taxRate: '9.00%',
    taxedFreight: '',
    lossUnitPrice: '0',
    lossRate: '0.5',
    lossWeight: '0.00',
    lossAmount: '0.00',
    etcFee: '0',
    plannedFuelConsumption: '自动计算',
    actualFuelVolume: '0',
    actualFuelAmount: '0',
    receiptStatus: '未回单',
    settlementStatus: '未结算',
    status: '待审核',
    remark: '',
  }
}

export function useTransportOrderForm() {
  return {
    orderModalOpen: ref(false),
    editingOrderCode: ref(''),
    orderForm: reactive<TransportOrderForm>(createEmptyTransportOrderForm()),
  }
}

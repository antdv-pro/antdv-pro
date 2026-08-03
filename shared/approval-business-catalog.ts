export interface ApprovalBusinessCatalogItem {
  category: string
  label: string
  businessType: string
  moduleName: string
  modulePath?: string
  requireAmount?: boolean
  requireAttachment?: boolean
  defaultApproverIds: Array<string | number>
  descriptionPlaceholder: string
  initiationSource?: 'MANAGEMENT_SYSTEM' | 'WECOM'
}

export type ApprovalOaModuleKey = 'dashboard' | 'receivable' | 'cash' | 'salary' | 'org' | 'vehicle'

export type ApprovalFinanceDirection = 'IN' | 'OUT' | 'NONE'
export type ApprovalFinanceAction
  = | 'CREATE_RECEIVABLE'
    | 'CREATE_PAYABLE'
    | 'REGISTER_RECEIPT'
    | 'REQUEST_PAYMENT'
    | 'REGISTER_CASH_EXPENSE'
    | 'NONE'

export interface ApprovalFinancePolicy {
  direction: ApprovalFinanceDirection
  action: ApprovalFinanceAction
  targetModule: 'receivable' | 'cash' | 'none'
  requiresCounterparty: boolean
  requiresSettlementExecution: boolean
}

const APPROVAL_OA_MODULE_MAP: Record<string, ApprovalOaModuleKey> = {
  expense: 'dashboard',
  payment: 'receivable',
  receivable: 'receivable',
  receipt: 'receivable',
  cash_expense: 'cash',
  salary: 'salary',
  attendance_adjustment: 'salary',
  leave: 'salary',
  overtime: 'salary',
  travel: 'salary',
  hr_change: 'org',
  office_vehicle_expense: 'vehicle',
}

const NO_FINANCE_EFFECT: ApprovalFinancePolicy = {
  direction: 'NONE',
  action: 'NONE',
  targetModule: 'none',
  requiresCounterparty: false,
  requiresSettlementExecution: false,
}

const PAYABLE_POLICY: ApprovalFinancePolicy = {
  direction: 'OUT',
  action: 'CREATE_PAYABLE',
  targetModule: 'receivable',
  requiresCounterparty: true,
  requiresSettlementExecution: true,
}

export const APPROVAL_FINANCE_POLICY_MAP: Record<string, ApprovalFinancePolicy> = {
  transport_fuel: PAYABLE_POLICY,
  transport_etc: PAYABLE_POLICY,
  transport_maintenance: PAYABLE_POLICY,
  transport_fee: PAYABLE_POLICY,
  vehicle_loan: PAYABLE_POLICY,
  transport_exception_fee: PAYABLE_POLICY,
  office_vehicle_expense: PAYABLE_POLICY,
  purchase: PAYABLE_POLICY,
  payment: { direction: 'OUT', action: 'REQUEST_PAYMENT', targetModule: 'receivable', requiresCounterparty: true, requiresSettlementExecution: true },
  receivable: { direction: 'IN', action: 'CREATE_RECEIVABLE', targetModule: 'receivable', requiresCounterparty: true, requiresSettlementExecution: true },
  cash_expense: { direction: 'OUT', action: 'REGISTER_CASH_EXPENSE', targetModule: 'cash', requiresCounterparty: false, requiresSettlementExecution: true },
  receipt: { direction: 'IN', action: 'REGISTER_RECEIPT', targetModule: 'cash', requiresCounterparty: true, requiresSettlementExecution: false },
  expense: PAYABLE_POLICY,
  salary: { ...PAYABLE_POLICY, requiresCounterparty: false },
  travel: PAYABLE_POLICY,
  asset_purchase: PAYABLE_POLICY,
  contract: NO_FINANCE_EFFECT,
  attendance_adjustment: NO_FINANCE_EFFECT,
  leave: NO_FINANCE_EFFECT,
  overtime: NO_FINANCE_EFFECT,
  hr_change: NO_FINANCE_EFFECT,
  inventory_adjustment: NO_FINANCE_EFFECT,
  asset_scrap: NO_FINANCE_EFFECT,
  general: NO_FINANCE_EFFECT,
}

export const APPROVAL_BUSINESS_CATALOG: ApprovalBusinessCatalogItem[] = [
  { category: '费用支出类', label: '燃油费审批', businessType: 'transport_fuel', moduleName: '加油明细', modulePath: '/transport/fuel', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写燃油费用用途、车辆、期间和票据说明' },
  { category: '费用支出类', label: 'ETC费审批', businessType: 'transport_etc', moduleName: 'ETC费用', modulePath: '/transport/etc', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写ETC费用期间、车辆、路线和发票说明' },
  { category: '费用支出类', label: '维保费审批', businessType: 'transport_maintenance', moduleName: '维保费用', modulePath: '/transport/maintenance', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写维修/保养项目、车辆、供应商和费用说明' },
  { category: '费用支出类', label: '规费审批', businessType: 'transport_fee', moduleName: '规费管理', modulePath: '/transport/fees', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写保险、年审、营运证等规费说明' },
  { category: '费用支出类', label: '车贷审批', businessType: 'vehicle_loan', moduleName: '车贷费用', modulePath: '/transport/vehicle-loans', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3, 5], descriptionPlaceholder: '填写车辆贷款期次、还款金额和付款说明' },
  { category: '费用支出类', label: '异常费用审批', businessType: 'transport_exception_fee', moduleName: '异常费用', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写异常原因、责任归属、费用金额和附件说明' },
  { category: '费用支出类', label: '办公用车费用审批', businessType: 'office_vehicle_expense', moduleName: '办公用车', modulePath: '/oa-approval/vehicle', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写用车人员、车辆、费用类型、金额和票据说明' },
  { category: '合同采购类', label: '合同审批', businessType: 'contract', moduleName: '合同管理', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 5], descriptionPlaceholder: '填写合同对方、合同金额、期限和主要条款' },
  { category: '合同采购类', label: '采购申请', businessType: 'purchase', moduleName: '采购管理', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写采购物品、用途、预算和供应商信息' },
  { category: '财务收付款类', label: '付款申请', businessType: 'payment', moduleName: '付款管理', modulePath: '/oa-approval/receivable-payable', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写付款对象、付款事由、金额和账户信息' },
  { category: '财务收付款类', label: '应收确认', businessType: 'receivable', moduleName: '应收管理', modulePath: '/oa-approval/receivable-payable', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写客户、应收金额、业务日期、到期日期和来源单据' },
  { category: '财务收付款类', label: '现金支出', businessType: 'cash_expense', moduleName: '现金管理', modulePath: '/oa-approval/cash', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写现金账户、支出事由、金额和附件说明' },
  { category: '财务收付款类', label: '收款登记', businessType: 'receipt', moduleName: '收款管理', modulePath: '/oa-approval/receivable-payable', requireAmount: true, defaultApproverIds: [3], descriptionPlaceholder: '填写客户、收款金额和收款账户' },
  { category: '财务收付款类', label: '费用报销', businessType: 'expense', moduleName: '报销管理', modulePath: '/oa-approval/dashboard', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写报销事项、金额、费用日期和票据说明' },
  { category: '人事薪酬类', label: '工资发放审批', businessType: 'salary', moduleName: '薪资管理', modulePath: '/oa-approval/salary', requireAmount: true, requireAttachment: true, defaultApproverIds: [3, 5], descriptionPlaceholder: '填写工资月份、发放人数、考勤依据和发放金额' },
  { category: '人事薪酬类', label: '考勤补录审批', businessType: 'attendance_adjustment', moduleName: '考勤管理', modulePath: '/oa-approval/salary', requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写补录日期、补录原因、考勤影响和证明附件', initiationSource: 'WECOM' },
  { category: '人事薪酬类', label: '请假审批', businessType: 'leave', moduleName: '考勤管理', modulePath: '/oa-approval/salary', defaultApproverIds: [4], descriptionPlaceholder: '填写请假类型、开始结束时间、考勤影响和请假原因', initiationSource: 'WECOM' },
  { category: '人事薪酬类', label: '加班审批', businessType: 'overtime', moduleName: '考勤管理', modulePath: '/oa-approval/salary', defaultApproverIds: [4], descriptionPlaceholder: '填写加班时间、加班事项、调休/加班费方式和考勤影响', initiationSource: 'WECOM' },
  { category: '人事薪酬类', label: '出差审批', businessType: 'travel', moduleName: '考勤管理', modulePath: '/oa-approval/salary', requireAmount: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写出差地点、时间、事由、预算和考勤影响', initiationSource: 'WECOM' },
  { category: '人事薪酬类', label: '组织人事变更', businessType: 'hr_change', moduleName: '系统组织架构', modulePath: '/system/organization', requireAttachment: true, defaultApproverIds: [4, 5], descriptionPlaceholder: '填写入转调离、部门岗位或人员信息变更事项', initiationSource: 'WECOM' },
  { category: '库存资产类', label: '库存调整', businessType: 'inventory_adjustment', moduleName: '库存管理', requireAttachment: true, defaultApproverIds: [4], descriptionPlaceholder: '填写调整物料、数量、原因和盘点附件' },
  { category: '库存资产类', label: '资产采购', businessType: 'asset_purchase', moduleName: '资产管理', requireAmount: true, requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写资产名称、用途、预算和供应商' },
  { category: '库存资产类', label: '资产报废', businessType: 'asset_scrap', moduleName: '资产管理', requireAttachment: true, defaultApproverIds: [4, 3], descriptionPlaceholder: '填写资产编号、报废原因、残值和照片附件' },
  { category: '通用事项类', label: '通用审批', businessType: 'general', moduleName: '审批中心', modulePath: '/oa-approval/center', defaultApproverIds: [4], descriptionPlaceholder: '填写需要审批的事项、背景和处理建议' },
]

export const APPROVAL_BUSINESS_MAP = new Map(APPROVAL_BUSINESS_CATALOG.map(item => [item.businessType, item]))

export function approvalBusinessLabel(businessType: string) {
  return APPROVAL_BUSINESS_MAP.get(businessType)?.label || businessType || '未分类审批'
}

export function approvalOaModuleKey(businessType: string) {
  return APPROVAL_OA_MODULE_MAP[businessType]
}

export function approvalFinancePolicy(businessType: string): ApprovalFinancePolicy {
  return APPROVAL_FINANCE_POLICY_MAP[businessType] || NO_FINANCE_EFFECT
}

export function approvalInitiationSource(_businessType: string) {
  return 'WECOM'
}

export function requiredWecomDirection(_businessType: string) {
  return 'WECOM_TO_CENTER'
}

const APPROVAL_BUSINESS_KEYWORDS: Array<[string, RegExp]> = [
  ['transport_fuel', /燃油|加油|柴油|汽油|尿素/],
  ['transport_etc', /ETC|通行费|路桥费/i],
  ['transport_maintenance', /维保|维修|保养|轮胎|配件/],
  ['transport_fee', /规费|保险|年审|营运证|GPS年费|检测费/],
  ['vehicle_loan', /车贷|贷款|还款|利息/],
  ['transport_exception_fee', /异常费用|压车费|绕路费|罚款|事故赔付/],
  ['office_vehicle_expense', /办公用车|公务用车|停车费/],
  ['salary', /工资|薪资|奖金|社保|公积金|个税/],
  ['attendance_adjustment', /考勤补录|补卡|缺卡|迟到|早退/],
  ['leave', /请假|事假|病假|年假|调休|婚假|产假|丧假/],
  ['overtime', /加班/],
  ['travel', /出差|差旅/],
  ['hr_change', /入职|转岗|调岗|离职|组织人事|部门变更|岗位变更/],
  ['purchase', /采购/],
  ['contract', /合同/],
  ['cash_expense', /现金支出|备用金/],
  ['payment', /付款|应付/],
  ['receivable', /应收确认|应收立账|应收生成/],
  ['receipt', /收款|回款|到账|应收/],
  ['asset_purchase', /资产采购/],
  ['asset_scrap', /资产报废|报废/],
  ['inventory_adjustment', /库存调整|盘点/],
  ['expense', /费用|报销|支出/],
  ['general', /通用审批|其他事项/],
]

export function inferApprovalBusinessType(value: unknown) {
  const text = String(value || '').trim()
  return APPROVAL_BUSINESS_KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0]
}

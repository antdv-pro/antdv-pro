export interface BusinessDictionaryDefinition {
  type: string
  typeName: string
  label: string
  value: string
  sortNo: number
  status: 'enabled'
  remark: string
}

export const businessDictionaryTypes = [
  { label: '贸易承运商', value: 'trade_carrier' },
  { label: '贸易计划单位', value: 'trade_plan_unit' },
  { label: '贸易装车液厂', value: 'trade_loading_factory' },
  { label: '贸易订单状态', value: 'trade_order_status' },
  { label: '贸易车辆性质', value: 'trade_vehicle_nature' },
  { label: '酒店收支分类', value: 'hotel_revenue_category' },
  { label: '酒店支付方式', value: 'hotel_payment_method' },
  { label: '酒店经营设置', value: 'hotel_setting' },
  { label: '维保服务商', value: 'maintenance_shop' },
  { label: '维保支出方式', value: 'maintenance_payment_method' },
  { label: '贷款机构', value: 'loan_lender' },
  { label: '贷款支付方式', value: 'loan_payment_method' },
  { label: '办公用车支付方式', value: 'office_vehicle_payment_method' },
  { label: '办公用车费用类型', value: 'office_vehicle_expense_type' },
  { label: '办公用车证照类型', value: 'office_vehicle_license_type' },
  { label: '办公用车提醒类型', value: 'office_vehicle_reminder_type' },
  { label: '运输规费类型', value: 'regulatory_fee_type' },
  { label: '审批支出内容', value: 'approval_expense_content' },
  { label: 'OA 公司主体', value: 'oa_company' },
  { label: 'OA 业务角色', value: 'oa_role' },
  { label: '岗位层级', value: 'position_level' },
] as const

const defaults: Record<string, string[]> = {
  trade_carrier: ['诚捷', '诚域', '诺锐', '外协车队'],
  trade_plan_unit: ['诚域', '诚捷', '诺锐'],
  trade_loading_factory: ['阎中/巨安', '昆仑五厂', '昆仑格', '陕西延长/亿利通'],
  trade_order_status: ['待确认', '已确认', '已结算'],
  trade_vehicle_nature: ['自有', '外协'],
  hotel_revenue_category: ['房费', '押金', '退款', '商品售卖', '采购', '水电', '维修', '工资', '平台佣金', '其他'],
  hotel_payment_method: ['现金', '微信', '支付宝', '银行卡', 'OTA平台'],
  maintenance_shop: ['格尔木顺达汽修厂', '西宁米其林轮胎店', '陕西宁强修理站', '宝鸡华明维保点'],
  maintenance_payment_method: ['备用金', '公司转账', '油卡抵扣'],
  loan_lender: ['青海银行', '建设银行', '工商银行', '平安租赁', '东风金融', '解放金融'],
  loan_payment_method: ['银行转账', '现金', '承兑', '其他'],
  office_vehicle_payment_method: ['企业微信', '公务卡', '银行转账', '现金', '个人垫付'],
  office_vehicle_expense_type: ['加油费', '充电费', '维修费', '保养费', '保险费', '年检费', '停车费', '过路费', '洗车费', '违章罚款', '其他费用'],
  office_vehicle_license_type: ['行驶证', '车辆登记证', '营运证', '道路运输证', '驾驶证', '其他证照'],
  office_vehicle_reminder_type: ['车辆年审到期', '车辆保险到期', '车辆保养时间', '交强险到期', '商业险到期', '行驶证到期', '营运证到期', '道路运输证到期', '其他提醒'],
  regulatory_fee_type: ['交强险', '主车商业险', '挂车商业险', '车辆意外险', '承运人责任险', 'GPS年费', '主车行驶证', '挂车行驶证', '气瓶年审', '罐体检测', '安全阀年检', '压力表校验'],
  approval_expense_content: ['日常支出', '项目支出', '行政支出', '财务支出', '经营支出', '其他支出'],
  oa_company: ['青海诚捷运输有限公司', '青海诚域能源有限公司', '青海诺锐新能源有限公司'],
  oa_role: ['管理员', '财务审批', '行政审批', '用车审批', '工资审批', '部门主管', '普通员工'],
  position_level: ['高层', '中层', '主管', '专员', '一线'],
}

export const businessDictionaryDefaults: BusinessDictionaryDefinition[] = [
  ...Object.entries(defaults).flatMap(([type, values]) => {
    const typeName = businessDictionaryTypes.find(item => item.value === type)?.label || type
    return values.map((value, index) => ({
      type,
      typeName,
      label: value,
      value,
      sortNo: index + 1,
      status: 'enabled' as const,
      remark: '系统内置业务主数据，可编辑或停用',
    }))
  }),
  {
    type: 'hotel_setting',
    typeName: '酒店经营设置',
    label: '总房量',
    value: '100',
    sortNo: 1,
    status: 'enabled',
    remark: '酒店当前可售房间总数',
  },
]

export const businessDictionaryTypeSet = new Set<string>(businessDictionaryTypes.map(item => item.value))
export const businessDictionaryDefaultKeySet = new Set<string>(businessDictionaryDefaults.map(item => `${item.type}::${item.value}`))

export function defaultBusinessDictionaryValues(type: string) {
  return businessDictionaryDefaults.filter(item => item.type === type).map(item => item.value)
}

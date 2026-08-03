<script setup lang="ts">
import type { SummaryCardItem } from '~@/components/summary-cards/index.vue'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { h } from 'vue'
import * as XLSX from 'xlsx'
import SummaryCards from '~@/components/summary-cards/index.vue'
import {
  transportDriverPayrollRows,
  transportEtcRows,
  transportFuelRows,
  transportMaintenanceRows,
  transportOperationError,
  transportOperationLoading,
  transportVehicleLoanRows,
} from '~@/composables/transport-operation-data'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'

type ExpenseStatus = '待确认' | '审批中' | '已确认' | '已归档' | '已结清'

interface ExpenseRow {
  id: string
  code: string
  source: string
  expenseType: string
  occurredDate: string
  financialMonth: string
  plateNo: string
  trailerNo?: string
  vehicleInfo: string
  handler: string
  vendor: string
  amount: number
  status: ExpenseStatus
  remark: string
}

interface QueryModel {
  keyword?: string
  source?: string
  status?: ExpenseStatus
  plateNo?: string
  month?: string
}

const message = useMessage()
const queryModel = reactive<QueryModel>({})

const sourceOptions = ['加油明细', 'ETC费用', '维保费用', '规费管理', '车贷费用', '司机薪酬']
  .map(value => ({ label: value, value }))
const statusOptions: ExpenseStatus[] = ['待确认', '审批中', '已确认', '已归档', '已结清']

const allRows = computed<ExpenseRow[]>(() => [
  ...transportFuelRows.value.map(row => ({
    id: `fuel-${row.code}`,
    code: row.code,
    source: '加油明细',
    expenseType: row.product || '燃油费',
    occurredDate: normalizeDate(row.date),
    financialMonth: row.month,
    plateNo: row.plateNo,
    vehicleInfo: row.plateNo,
    handler: row.driver,
    vendor: row.location,
    amount: toNumber(row.amount),
    status: '已确认' as ExpenseStatus,
    remark: row.quantity,
  })),
  ...transportEtcRows.value.map(row => ({
    id: `etc-${row.code}`,
    code: row.code,
    source: 'ETC费用',
    expenseType: '通行费',
    occurredDate: normalizeDate(row.updatedAt),
    financialMonth: row.month,
    plateNo: row.plateNo,
    vehicleInfo: row.plateNo,
    handler: row.cardNo,
    vendor: row.name,
    amount: toNumber(row.amount),
    status: row.status === '待核对' ? '待确认' as ExpenseStatus : '已确认' as ExpenseStatus,
    remark: row.invoiceNo,
  })),
  ...transportMaintenanceRows.value.map(row => ({
    id: `maintenance-${row.id}`,
    code: `WB${String(row.id).padStart(5, '0')}`,
    source: '维保费用',
    expenseType: row.project,
    occurredDate: row.repairDate,
    financialMonth: row.financialMonth,
    plateNo: row.plateNo,
    trailerNo: row.trailerNo,
    vehicleInfo: row.trailerNo ? `${row.plateNo} / ${row.trailerNo}` : row.plateNo,
    handler: row.driver,
    vendor: row.shop,
    amount: Number(row.amount || 0),
    status: row.status === '待审核' || row.approvalStatus === '审批中' ? '审批中' as ExpenseStatus : '已确认' as ExpenseStatus,
    remark: row.items,
  })),
  ...transportVehicleLoanRows.value.map(row => ({
    id: `loan-${row.id}`,
    code: row.contractNo,
    source: '车贷费用',
    expenseType: '月供还款',
    occurredDate: row.firstDueDate,
    financialMonth: dayjs(row.firstDueDate).format('YYYY-MM'),
    plateNo: row.plateNo,
    trailerNo: row.trailerNo,
    vehicleInfo: row.trailerNo ? `${row.plateNo} / ${row.trailerNo}` : row.plateNo,
    handler: row.lender,
    vendor: row.owner || row.lender,
    amount: Number(row.monthlyPayment || 0),
    status: row.payments.length >= row.totalPeriods ? '已结清' as ExpenseStatus : '待确认' as ExpenseStatus,
    remark: `${row.payments.length}/${row.totalPeriods} 期`,
  })),
  ...transportDriverPayrollRows.value.map(row => ({
    id: `salary-${row.code}`,
    code: row.code,
    source: '司机薪酬',
    expenseType: '司机薪酬',
    occurredDate: normalizeDate(row.updatedAt),
    financialMonth: row.updatedAt?.slice(0, 7) || '',
    plateNo: String(row.owner || '').split('/')[0]?.trim() || '',
    vehicleInfo: String(row.owner || '').split('/')[0]?.trim() || '-',
    handler: row.name,
    vendor: '运输管理部',
    amount: toNumber(row.amount),
    status: row.status === '审批通过' ? '审批中' as ExpenseStatus : '已确认' as ExpenseStatus,
    remark: row.owner || '',
  })),
  ...createRegulatoryExpenseRows(),
])

const monthOptions = computed(() => {
  return [...new Set(allRows.value.map(row => row.financialMonth).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))
    .map(value => ({ label: value, value }))
})

const filteredRows = computed(() => {
  const keyword = queryModel.keyword?.trim()
  return allRows.value.filter((row) => {
    if (keyword && ![row.code, row.source, row.expenseType, row.plateNo, row.trailerNo, row.handler, row.vendor, row.remark].some(value => String(value || '').includes(keyword)))
      return false
    if (queryModel.source && row.source !== queryModel.source)
      return false
    if (queryModel.status && row.status !== queryModel.status)
      return false
    if (queryModel.month && row.financialMonth !== queryModel.month)
      return false
    if (queryModel.plateNo && !`${row.plateNo}${row.trailerNo || ''}`.includes(queryModel.plateNo))
      return false
    return true
  })
})

const categoryRows = computed(() => {
  return sourceOptions.map((option) => {
    const rows = filteredRows.value.filter(row => row.source === option.value)
    return {
      source: option.value,
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + row.amount, 0),
      pendingCount: rows.filter(row => ['待确认', '审批中'].includes(row.status)).length,
    }
  }).filter(row => row.count)
})

const summaryCards = computed<SummaryCardItem[]>(() => {
  const totalAmount = filteredRows.value.reduce((sum, row) => sum + row.amount, 0)
  const pendingCount = filteredRows.value.filter(row => ['待确认', '审批中'].includes(row.status)).length
  const confirmedAmount = filteredRows.value.filter(row => ['已确认', '已归档', '已结清'].includes(row.status)).reduce((sum, row) => sum + row.amount, 0)
  return [
    { label: '费用总额', value: money(totalAmount), hint: '当前筛选范围', tone: 'danger' },
    { label: '费用笔数', value: filteredRows.value.length, hint: '跨加油/ETC/维保等', tone: 'primary' },
    { label: '待处理', value: pendingCount, hint: '待确认或审批中', tone: pendingCount ? 'warning' : 'success' },
    { label: '已确认金额', value: money(confirmedAmount), hint: '可纳入经营核算', tone: 'success' },
  ]
})

const categoryColumns = [
  { title: '费用来源', dataIndex: 'source', width: 116 },
  { title: '笔数', dataIndex: 'count', width: 72 },
  { title: '金额合计', dataIndex: 'amount', width: 124 },
  { title: '待处理', dataIndex: 'pendingCount', width: 84 },
]
const tableColumns = [
  { title: '费用编号', dataIndex: 'code', width: 150, fixed: 'left' as const },
  { title: '费用来源', dataIndex: 'source', width: 130 },
  { title: '费用类型', dataIndex: 'expenseType', width: 130 },
  { title: '发生日期', dataIndex: 'occurredDate', width: 120 },
  { title: '财务月', dataIndex: 'financialMonth', width: 100 },
  { title: '车辆', dataIndex: 'vehicleInfo', width: 140 },
  { title: '经办/司机', dataIndex: 'handler', width: 130 },
  { title: '供应商/地点', dataIndex: 'vendor', width: 170 },
  { title: '费用金额', dataIndex: 'amount', width: 130 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '备注', dataIndex: 'remark', ellipsis: true },
]
const categoryTableColumns = computed(() => enhanceBusinessTableColumns(categoryColumns))
const categoryTableScrollX = computed(() => createBusinessTableScrollX(categoryTableColumns.value, 520))
const expenseTableColumns = computed(() => enhanceBusinessTableColumns(tableColumns, { noSortFields: ['remark'] }))
const expenseTableScrollX = computed(() => createBusinessTableScrollX(expenseTableColumns.value, 1500))

function createRegulatoryExpenseRows(): ExpenseRow[] {
  return [
    { id: 'regulatory-1', code: 'GF202607001', source: '规费管理', expenseType: '保险费', occurredDate: '2026-07-01', financialMonth: '2026-07', plateNo: '沪A·3589', vehicleInfo: '沪A·3589', handler: '赵会计', vendor: '太平洋保险', amount: 12480, status: '已确认', remark: '主车商业险' },
    { id: 'regulatory-2', code: 'GF202607002', source: '规费管理', expenseType: '年审费', occurredDate: '2026-07-03', financialMonth: '2026-07', plateNo: '苏E·2198', vehicleInfo: '苏E·2198', handler: '李行政', vendor: '车管所', amount: 1680, status: '待确认', remark: '年审资料待补齐' },
  ]
}

function handleReset() {
  Object.keys(queryModel).forEach((key) => {
    delete queryModel[key as keyof QueryModel]
  })
}

function exportRows() {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(filteredRows.value.map(row => ({
    费用编号: row.code,
    费用来源: row.source,
    费用类型: row.expenseType,
    发生日期: row.occurredDate,
    财务月: row.financialMonth,
    车牌号: row.plateNo,
    挂车号: row.trailerNo || '',
    经办司机: row.handler,
    供应商地点: row.vendor,
    费用金额: row.amount,
    状态: row.status,
    备注: row.remark,
  })))
  XLSX.utils.book_append_sheet(workbook, worksheet, '费用明细')
  XLSX.writeFile(workbook, `运输费用管理_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
  message.success('导出成功')
}

function normalizeDate(value?: string) {
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD') : String(value || '')
}

function toNumber(value: unknown) {
  if (typeof value === 'number')
    return value
  const numberValue = Number.parseFloat(String(value ?? '').replace(/[¥￥,\s]/g, ''))
  return Number.isFinite(numberValue) ? numberValue : 0
}

function money(value: number) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function statusColor(status: ExpenseStatus) {
  const colorMap: Record<ExpenseStatus, string> = {
    待确认: 'orange',
    审批中: 'processing',
    已确认: 'success',
    已归档: 'green',
    已结清: 'blue',
  }
  return colorMap[status]
}

function displayVehicleValue(value?: string) {
  return value || '-'
}
</script>

<template>
  <page-container>
    <a-alert v-if="transportOperationError" class="expense-card" type="error" show-icon :message="transportOperationError" />

    <SummaryCards :cards="summaryCards" :xl-span="6" compact :loading="transportOperationLoading" />

    <a-card class="expense-card" :bordered="false">
      <a-form class="expense-query" :model="queryModel" layout="vertical">
        <a-row :gutter="[16, 12]" align="bottom">
          <a-col :xs="24" :md="8" :xl="5">
            <a-form-item label="关键字">
              <a-input v-model:value="queryModel.keyword" allow-clear placeholder="编号/车辆/供应商/备注" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="费用来源">
              <a-select v-model:value="queryModel.source" allow-clear placeholder="全部" :options="sourceOptions" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="状态">
              <a-select v-model:value="queryModel.status" allow-clear placeholder="全部">
                <a-select-option v-for="item in statusOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="财务月">
              <a-select v-model:value="queryModel.month" allow-clear placeholder="全部" :options="monthOptions" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="车牌号">
              <a-input v-model:value="queryModel.plateNo" allow-clear placeholder="请输入车牌号" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :xl="7" class="query-actions">
            <a-space>
              <a-button type="primary">
                查询
              </a-button>
              <a-button :icon="h(ReloadOutlined)" @click="handleReset">
                重置
              </a-button>
              <a-button :icon="h(DownloadOutlined)" @click="exportRows">
                导出
              </a-button>
            </a-space>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :xl="8">
        <a-card class="expense-card" title="费用分类汇总" :bordered="false">
          <a-table
            row-key="source"
            size="small"
            :loading="transportOperationLoading"
            :pagination="false"
            :columns="categoryTableColumns"
            :data-source="categoryRows"
            :scroll="{ x: categoryTableScrollX }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'amount'">
                <span class="amount-text">{{ money(record.amount) }}</span>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
      <a-col :xs="24" :xl="16">
        <a-card class="expense-card" title="费用明细列表" :bordered="false">
          <a-table
            row-key="id"
            :loading="transportOperationLoading"
            :columns="expenseTableColumns"
            :data-source="filteredRows"
            :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
            :scroll="{ x: expenseTableScrollX }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'vehicleInfo'">
                <div class="vehicle-stack-cell">
                  <span class="vehicle-main">{{ displayVehicleValue(record.plateNo) }}</span>
                  <span class="vehicle-sub">{{ displayVehicleValue(record.trailerNo) }}</span>
                </div>
              </template>
              <template v-else-if="column.dataIndex === 'amount'">
                <span class="amount-text">{{ money(record.amount) }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="statusColor(record.status)">
                  {{ record.status }}
                </a-tag>
              </template>
              <template v-else>
                <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                  <span class="cell-ellipsis">
                    {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
                  </span>
                </a-tooltip>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>
  </page-container>
</template>

<style scoped lang="less">
.expense-card {
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 18px rgb(15 23 42 / 5%);
}

.expense-query {
  :deep(.ant-form-item) {
    margin-bottom: 0;
  }
}

.query-actions {
  display: flex;
  justify-content: flex-end;
}

.amount-text {
  color: #0f172a;
  font-weight: 700;
}

.vehicle-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
}

.vehicle-main {
  color: #0f172a;
  font-weight: 600;
}

.vehicle-sub {
  color: #64748b;
  font-size: 12px;
}

@media (max-width: 768px) {
  .query-actions {
    justify-content: stretch;

    :deep(.ant-space),
    :deep(.ant-space-item),
    :deep(.ant-btn) {
      width: 100%;
    }
  }
}
</style>

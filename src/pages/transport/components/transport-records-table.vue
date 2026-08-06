<script setup lang="ts">
import type { RecordActionItem } from '~@/components/record-actions/index.vue'
import RecordActions from '~@/components/record-actions/index.vue'

type Row = Record<string, any>
interface Column { dataIndex?: string | string[], [key: string]: any }

const props = defineProps<{
  moduleName: string
  pageTitle: string
  columns: Column[]
  rows: Row[]
  pagination: Record<string, any>
  scrollX: number
  beforeUploadOrderRecords: (file: File) => boolean | Promise<boolean>
  getRowClassName: (record: Row) => string
  getStageTag: (record: Row) => { stage: string, label: string, fenceName?: string }
  getStatusColor: (record: Row) => string
  getStatus: (record: Row) => string
  getColumnValue: (record: Row, dataIndex: unknown) => unknown
  displayVehicleValue: (value?: string) => string
  isLatestVehicleOrder: (record: Row) => boolean
  getGpsLocationLabel: (record: Row) => string
  getGpsLocation: (record: Row) => { locationTime?: string } | undefined
  getActions: (record: Row) => RecordActionItem[]
  displayTableValue: (record: Row, dataIndex: unknown) => string
}>()

const emit = defineEmits<{
  importBatch: [kind: 'fuel' | 'etc']
  export: []
  add: []
  openGps: [record: Row]
}>()

const isOrder = computed(() => props.moduleName === 'TransportOrders')
const isEtc = computed(() => props.moduleName === 'TransportEtc')
const canAdd = computed(() => ['TransportOrders', 'TransportFuel'].includes(props.moduleName))

function getRowKey(record: Row) {
  if (!isEtc.value)
    return String(record.code || '')
  return [record.sourceFileHash, record.summaryNo, record.sourceFileRow, record.code].filter(Boolean).join(':')
}
</script>

<template>
  <a-card :title="`${pageTitle}列表`" :bordered="false">
    <template #extra>
      <a-space>
        <a-upload v-if="isOrder" :show-upload-list="false" accept=".xlsx,.xls" :before-upload="beforeUploadOrderRecords">
          <a-button type="primary">
            导入运单
          </a-button>
        </a-upload>
        <a-button v-else-if="moduleName === 'TransportFuel'" type="primary" @click="emit('importBatch', 'fuel')">
          导入油卡记录
        </a-button>
        <a-button v-else-if="moduleName === 'TransportEtc'" type="primary" @click="emit('importBatch', 'etc')">
          导入ETC费用
        </a-button>
        <a-button @click="emit('export')">
          导出表格
        </a-button>
        <a-button type="primary" :disabled="!canAdd" @click="emit('add')">
          新增
        </a-button>
      </a-space>
    </template>
    <a-table
      :class="{ 'transport-order-table': isOrder, 'transport-etc-table': moduleName === 'TransportEtc' }"
      :row-key="getRowKey"
      :columns="columns"
      :data-source="rows"
      :pagination="pagination"
      :scroll="{ x: scrollX }"
      :row-class-name="getRowClassName"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tooltip :title="isOrder ? `运输阶段：${getStageTag(record).label}${getStageTag(record).fenceName ? `（${getStageTag(record).fenceName}）` : ''}` : ''">
            <a-tag :color="getStatusColor(record)">
              {{ getStatus(record) }}
            </a-tag>
          </a-tooltip>
        </template>
        <span v-else-if="column.dataIndex === 'amount'" font-600>{{ record.amount }}</span>
        <span v-else-if="['baseSalary', 'tripCommission', 'allowance', 'deduction', 'grossSalary', 'netSalary'].includes(String(column.dataIndex))" :class="column.dataIndex === 'netSalary' ? 'salary-net-amount' : ''">{{ getColumnValue(record, column.dataIndex) || '-' }}</span>
        <span v-else-if="['attendanceDays', 'tripCount'].includes(String(column.dataIndex))" class="salary-stat-value">{{ getColumnValue(record, column.dataIndex) || '0' }}</span>
        <span v-else-if="column.dataIndex === 'freightTotal'" font-600>{{ record.freightTotal }}</span>
        <div v-else-if="column.dataIndex === 'vehicleInfo'" class="vehicle-stack-cell">
          <span class="vehicle-main">{{ displayVehicleValue(record.plateNo) }}</span>
          <span class="vehicle-sub">{{ displayVehicleValue(record.trailerNo) }}</span>
        </div>
        <div v-else-if="column.dataIndex === 'crewInfo'" class="vehicle-stack-cell">
          <span class="vehicle-main">{{ displayVehicleValue(record.driver) }}</span>
          <span class="vehicle-sub">{{ displayVehicleValue(record.escort) }}</span>
        </div>
        <template v-else-if="column.dataIndex === 'gpsAction'">
          <button v-if="isOrder && isLatestVehicleOrder(record)" class="order-location-link" type="button" @click="emit('openGps', record)">
            <span>{{ getGpsLocationLabel(record) }}</span>
            <small v-if="getGpsLocation(record)?.locationTime">{{ getGpsLocation(record)?.locationTime }}</small>
          </button>
          <span v-else-if="isOrder" class="order-location-empty">-</span>
        </template>
        <RecordActions v-else-if="column.dataIndex === 'action'" :actions="getActions(record)" />
        <a-tooltip v-else :title="displayTableValue(record, column.dataIndex)">
          <span class="cell-ellipsis">{{ displayTableValue(record, column.dataIndex) }}</span>
        </a-tooltip>
      </template>
    </a-table>
  </a-card>
</template>

<style lang="less" scoped>
.order-location-link {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 0;
  color: #1677ff;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.order-location-link span,
.order-location-link small {
  overflow-wrap: anywhere;
  white-space: normal;
}
.order-location-link small,
.order-location-empty,
.vehicle-sub {
  color: var(--admin-muted);
  font-size: 12px;
}
.vehicle-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
}
.vehicle-main {
  color: var(--admin-text);
  font-weight: 600;
}
.salary-stat-value {
  display: inline-flex;
  min-width: 46px;
  justify-content: flex-end;
  color: var(--admin-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.salary-net-amount {
  color: #cf1322;
  font-weight: 700;
}
.transport-order-table :deep(.ant-table-cell),
.transport-etc-table :deep(.ant-table-cell) {
  overflow-wrap: anywhere;
  white-space: normal;
}
.transport-order-table :deep(.ant-table-tbody > tr > td) {
  overflow: visible;
  text-overflow: clip;
}
.transport-order-table :deep(.order-fuel-overrun-row > td) {
  color: #a8071a;
  background: #fff1f0 !important;
}
.transport-order-table :deep(.order-fuel-overrun-row:hover > td) {
  background: #ffd8d4 !important;
}
.transport-etc-table :deep(.ant-table) {
  table-layout: auto;
}
.transport-etc-table :deep(.ant-table-tbody > tr > td) {
  overflow: visible;
  text-overflow: clip;
}
.transport-etc-table :deep(.cell-ellipsis) {
  display: inline;
  overflow: visible;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
}
</style>

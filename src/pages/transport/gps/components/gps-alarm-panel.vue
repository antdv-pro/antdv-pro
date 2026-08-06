<script setup lang="ts">
import type { GpsAlarmRecord } from '~@/api/gps'
import { displayBusinessTableValue, getBusinessTableValue } from '~@/utils/business-table'
import { sanitizeGpsDisplayAddress } from '~@/utils/gps-address'

defineProps<{
  alarms: GpsAlarmRecord[]
  columns: Array<Record<string, any>>
  scrollX: number
  statusColor: (value: string) => string
  alarmLevelLabel: (value: string) => string
  alarmStatusLabel: (value: string) => string
}>()

const emit = defineEmits<{
  selectVehicle: [vehicleId: string]
  handleAlarm: [record: GpsAlarmRecord, status: 'handled' | 'ignored']
}>()
const alarmTypeFilter = defineModel<string>('alarmTypeFilter', { required: true })
const alarmStatusFilter = defineModel<string>('alarmStatusFilter', { required: true })
const alarmRemark = defineModel<string>('alarmRemark', { required: true })
function asAlarmRecord(record: Record<string, any>) {
  return record as GpsAlarmRecord
}
</script>

<template>
  <a-space wrap mb-4>
    <a-select v-model:value="alarmTypeFilter" w-160px>
      <a-select-option value="all">
        全部报警
      </a-select-option>
      <a-select-option value="超速">
        超速报警
      </a-select-option>
      <a-select-option value="离线">
        离线报警
      </a-select-option>
      <a-select-option value="围栏">
        围栏报警
      </a-select-option>
      <a-select-option value="疲劳">
        疲劳驾驶报警
      </a-select-option>
      <a-select-option value="停留">
        异常停留报警
      </a-select-option>
    </a-select>
    <a-select v-model:value="alarmStatusFilter" w-140px>
      <a-select-option value="all">
        全部状态
      </a-select-option>
      <a-select-option value="unhandled">
        未处理
      </a-select-option>
      <a-select-option value="handled">
        已处理
      </a-select-option>
      <a-select-option value="ignored">
        已忽略
      </a-select-option>
    </a-select>
    <a-input v-model:value="alarmRemark" w-260px placeholder="处理备注" />
  </a-space>
  <a-table row-key="id" :columns="columns" :data-source="alarms" :scroll="{ x: scrollX }">
    <template #bodyCell="{ column, record }">
      <template v-if="column.dataIndex === 'alarmLevel'">
        <a-tag :color="statusColor(record.alarmLevel)">
          {{ alarmLevelLabel(record.alarmLevel) }}
        </a-tag>
      </template>
      <template v-else-if="column.dataIndex === 'status'">
        <a-tag :color="statusColor(record.status)">
          {{ alarmStatusLabel(record.status) }}
        </a-tag>
      </template>
      <template v-else-if="column.dataIndex === 'address'">
        {{ sanitizeGpsDisplayAddress(record.address) || (record.latitude || record.longitude ? `${Number(record.latitude).toFixed(6)}, ${Number(record.longitude).toFixed(6)}` : '定位无效') }}
      </template>
      <template v-else-if="column.dataIndex === 'action'">
        <a-space>
          <a @click="emit('selectVehicle', record.vehicleId)">查看</a>
          <a :disabled="record.status !== 'unhandled'" @click="record.status === 'unhandled' && emit('handleAlarm', asAlarmRecord(record), 'handled')">审核</a>
          <a-dropdown>
            <a @click.prevent>更多</a>
            <template #overlay>
              <a-menu>
                <a-menu-item v-if="record.status === 'unhandled'">
                  <a @click="emit('handleAlarm', asAlarmRecord(record), 'ignored')">忽略</a>
                </a-menu-item>
                <a-menu-item><a @click="emit('selectVehicle', record.vehicleId)">定位</a></a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </a-space>
      </template>
      <template v-else>
        <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
          <span class="cell-ellipsis">{{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}</span>
        </a-tooltip>
      </template>
    </template>
  </a-table>
</template>

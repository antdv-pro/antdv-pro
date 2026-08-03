<script setup lang="ts">
import { displayBusinessTableValue, getBusinessTableValue } from '~@/utils/business-table'

defineProps<{
  vehicles: Array<{ vehicleId: string, plateNo: string }>
  points: Array<Record<string, any>>
  columns: Array<Record<string, any>>
  scrollX: number
  currentPoint?: Record<string, any>
  loading: boolean
  playing: boolean
  lastSyncAt: string
  statusColor: (value: string) => string
  pointTypeLabel: (value: string) => string
  accStatusLabel: (value: string) => string
}>()

const emit = defineEmits<{ load: [], play: [], pause: [] }>()
const selectedVehicleId = defineModel<string>('selectedVehicleId', { required: true })
const trackRange = defineModel<[any, any] | undefined>('trackRange')
const playSpeed = defineModel<number>('playSpeed', { required: true })
</script>

<template>
  <a-space wrap mb-4>
    <span class="alarm-sync-time">最近同步：{{ lastSyncAt || '尚未同步' }}</span>
    <a-select v-model:value="selectedVehicleId" w-180px>
      <a-select-option v-for="vehicle in vehicles" :key="vehicle.vehicleId" :value="vehicle.vehicleId">
        {{ vehicle.plateNo }}
      </a-select-option>
    </a-select>
    <a-range-picker v-model:value="trackRange" show-time />
    <a-button type="primary" :loading="loading" @click="emit('load')">
      查询轨迹
    </a-button>
    <a-button :disabled="!points.length || playing" @click="emit('play')">
      播放
    </a-button>
    <a-button :disabled="!playing" @click="emit('pause')">
      暂停
    </a-button>
    <a-select v-model:value="playSpeed" w-100px>
      <a-select-option :value="1">
        1倍
      </a-select-option>
      <a-select-option :value="2">
        2倍
      </a-select-option>
      <a-select-option :value="4">
        4倍
      </a-select-option>
    </a-select>
    <span v-if="currentPoint">当前：{{ currentPoint.locationTime }} / {{ currentPoint.speed }}公里/小时</span>
  </a-space>
  <a-table row-key="id" :loading="loading" :columns="columns" :data-source="points" :locale="{ emptyText: '所选时间段内暂无轨迹数据' }" :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true }" :scroll="{ x: scrollX }">
    <template #bodyCell="{ column, record }">
      <template v-if="column.dataIndex === 'pointType'">
        <a-tag :color="statusColor(record.pointType)">
          {{ pointTypeLabel(record.pointType) }}
        </a-tag>
      </template>
      <template v-else-if="column.dataIndex === 'accStatus'">
        {{ accStatusLabel(record.accStatus) }}
      </template>
      <template v-else>
        <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
          <span class="cell-ellipsis">{{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}</span>
        </a-tooltip>
      </template>
    </template>
  </a-table>
</template>

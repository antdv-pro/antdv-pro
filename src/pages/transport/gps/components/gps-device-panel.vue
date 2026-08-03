<script setup lang="ts">
import type { GpsDevice, TransportVehicle } from '~@/api/gps'
import { displayBusinessTableValue, getBusinessTableValue } from '~@/utils/business-table'

defineProps<{
  vehicles: TransportVehicle[]
  devices: GpsDevice[]
  columns: Array<Record<string, any>>
  scrollX: number
  statusColor: (value?: string) => string
  onlineStatusLabel: (value?: string) => string
  providerLabel: (value?: string) => string
}>()
const emit = defineEmits<{ bind: [] }>()
const selectedVehicleId = defineModel<string>('selectedVehicleId', { required: true })
const selectedDeviceId = defineModel<string>('selectedDeviceId', { required: true })
</script>

<template>
  <a-space wrap mb-4>
    <a-select v-model:value="selectedVehicleId" w-180px placeholder="选择车辆">
      <a-select-option v-for="vehicle in vehicles" :key="vehicle.vehicleId" :value="vehicle.vehicleId">
        {{ vehicle.plateNo }} / {{ vehicle.driverName }}
      </a-select-option>
    </a-select>
    <a-select v-model:value="selectedDeviceId" w-220px placeholder="选择设备">
      <a-select-option v-for="device in devices" :key="device.deviceId" :value="device.deviceId">
        {{ device.deviceNo }} / {{ device.deviceName }}
      </a-select-option>
    </a-select>
    <a-button type="primary" @click="emit('bind')">
      绑定车辆和设备
    </a-button>
  </a-space>
  <a-table row-key="deviceId" :columns="columns" :data-source="devices" :scroll="{ x: scrollX }">
    <template #bodyCell="{ column, record }">
      <template v-if="column.dataIndex === 'onlineStatus'">
        <a-tag :color="statusColor(record.onlineStatus)">
          {{ onlineStatusLabel(record.onlineStatus) }}
        </a-tag>
      </template>
      <template v-else-if="column.dataIndex === 'provider'">
        {{ providerLabel(record.provider) }}
      </template>
      <template v-else>
        <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
          <span class="cell-ellipsis">{{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}</span>
        </a-tooltip>
      </template>
    </template>
  </a-table>
</template>

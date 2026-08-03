<script setup lang="ts">
import { displayBusinessTableValue, getBusinessTableValue } from '~@/utils/business-table'

defineProps<{
  syncLogs: Array<Record<string, any>>
  operationLogs: Array<Record<string, any>>
  syncColumns: Array<Record<string, any>>
  operationColumns: Array<Record<string, any>>
  syncScrollX: number
  operationScrollX: number
  statusColor: (value?: string) => string
  syncStatusLabel: (value?: string) => string
  providerLabel: (value?: string) => string
  syncTypeLabel: (value?: string) => string
  targetTypeLabel: (value?: string) => string
}>()
</script>

<template>
  <a-row :gutter="[16, 16]">
    <a-col :xs="24" :lg="12">
      <a-table row-key="id" size="small" :columns="syncColumns" :data-source="syncLogs" :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true }" :scroll="{ x: syncScrollX }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor(record.status)">
              {{ syncStatusLabel(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'provider'">
            {{ providerLabel(record.provider) }}
          </template>
          <template v-else-if="column.dataIndex === 'syncType'">
            {{ syncTypeLabel(record.syncType) }}
          </template>
          <template v-else>
            <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
              <span class="cell-ellipsis">{{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}</span>
            </a-tooltip>
          </template>
        </template>
      </a-table>
    </a-col>
    <a-col :xs="24" :lg="12">
      <a-table row-key="id" size="small" :columns="operationColumns" :data-source="operationLogs" :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true }" :scroll="{ x: operationScrollX }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'targetType'">
            {{ targetTypeLabel(record.targetType) }}
          </template>
          <template v-else>
            <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
              <span class="cell-ellipsis">{{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}</span>
            </a-tooltip>
          </template>
        </template>
      </a-table>
    </a-col>
  </a-row>
</template>

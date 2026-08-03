<script setup lang="ts">
defineProps<{
  configs: Array<Record<string, any>>
  providerLabel: (value?: string) => string
  booleanLabel: (value?: boolean) => string
}>()
</script>

<template>
  <a-alert mb-4 type="info" show-icon message="八零八定位服务的接口地址、账号、密码和令牌均从服务端环境变量读取；未配置或同步失败时显示错误和空态。" />
  <a-table row-key="id" :data-source="configs" :pagination="false">
    <a-table-column title="服务商" data-index="provider" />
    <a-table-column title="名称" data-index="name" />
    <a-table-column title="接口地址" data-index="baseUrl" />
    <a-table-column title="监控台地址" data-index="monitorUrl" />
    <a-table-column title="启用" data-index="enabled" />
    <a-table-column title="凭证状态" data-index="tokenConfigured" />
    <template #bodyCell="{ column, record }">
      <template v-if="column.dataIndex === 'provider'">
        {{ providerLabel(record.provider) }}
      </template>
      <template v-else-if="column.dataIndex === 'enabled'">
        {{ booleanLabel(record.enabled) }}
      </template>
      <template v-else-if="column.dataIndex === 'tokenConfigured'">
        {{ booleanLabel(record.tokenConfigured) }}
      </template>
    </template>
  </a-table>
</template>

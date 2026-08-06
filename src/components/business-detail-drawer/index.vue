<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title: string
  subtitle?: string
  status?: string
  statusColor?: string
  loading?: boolean
  width?: number | string
}>(), {
  subtitle: '',
  status: '',
  statusColor: 'default',
  loading: false,
  width: 760,
})

defineEmits<{
  'update:open': [value: boolean]
}>()

const slots = useSlots()
</script>

<template>
  <a-drawer
    :open="open"
    :width="width"
    class="business-detail-drawer"
    :body-style="{ padding: '20px 24px 28px' }"
    @close="$emit('update:open', false)"
  >
    <template #title>
      <div class="drawer-title">
        <strong>{{ title }}</strong>
        <span v-if="subtitle">{{ subtitle }}</span>
      </div>
    </template>
    <template v-if="status || slots.extra" #extra>
      <a-space>
        <a-tag v-if="status" :color="statusColor">
          {{ status }}
        </a-tag>
        <slot name="extra" />
      </a-space>
    </template>

    <a-skeleton :loading="loading" active :paragraph="{ rows: 8 }">
      <div class="drawer-content">
        <slot />
      </div>
    </a-skeleton>

    <template v-if="slots.footer" #footer>
      <div class="drawer-footer">
        <slot name="footer" />
      </div>
    </template>
  </a-drawer>
</template>

<style scoped>
.drawer-title {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.drawer-title strong {
  overflow: hidden;
  color: #172033;
  font-size: 16px;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-title span {
  overflow: hidden;
  color: #667287;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-content {
  min-width: 0;
}

.drawer-content :deep(.ant-descriptions-header) {
  margin-bottom: 12px;
}

.drawer-content :deep(.ant-descriptions-title) {
  color: #263247;
  font-size: 14px;
}

.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 767px) {
  :global(.business-detail-drawer .ant-drawer-content-wrapper) {
    width: 100% !important;
  }
}
</style>

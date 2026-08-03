<script setup lang="ts">
import BusinessDetailDrawer from '~@/components/business-detail-drawer/index.vue'

defineProps<{
  open: boolean
  title: string
  subtitle?: string
  status?: string
  entries: Array<[string, unknown]>
  getLabel: (key: string) => string
}>()

defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <BusinessDetailDrawer
    :open="open"
    :title="title"
    :subtitle="subtitle"
    :status="status"
    status-color="default"
    :width="760"
    @update:open="$emit('update:open', $event)"
  >
    <a-descriptions bordered :column="2" size="small">
      <a-descriptions-item v-for="([key, value]) in entries" :key="key" :label="getLabel(key)">
        {{ value || '-' }}
      </a-descriptions-item>
    </a-descriptions>
    <template #footer>
      <a-button @click="$emit('update:open', false)">
        关闭
      </a-button>
    </template>
  </BusinessDetailDrawer>
</template>

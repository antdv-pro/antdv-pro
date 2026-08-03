<script setup lang="ts">
import type { ImportConfirmState } from '~@/types/import'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'

const emit = defineEmits<{
  cancel: []
  confirm: []
  downloadErrors: []
  reselect: []
}>()

const state = defineModel<ImportConfirmState>('state', { required: true })

const previewColumns = computed(() => enhanceBusinessTableColumns(state.value.columns))
const previewScrollX = computed(() => createBusinessTableScrollX(previewColumns.value, 960))
const rowSelection = computed(() => ({
  selectedRowKeys: state.value.selectedRowKeys,
  onChange: (keys: Array<string | number>) => {
    state.value.selectedRowKeys = keys
    state.value.canConfirm = state.value.status === 'pending' && keys.length > 0
  },
}))
</script>

<template>
  <a-modal
    :open="state.open"
    :title="state.title"
    width="960px"
    aria-describedby="import-confirm-summary"
    :mask-closable="state.status !== 'importing'"
    :closable="state.status !== 'importing'"
    @cancel="emit('cancel')"
  >
    <a-descriptions id="import-confirm-summary" bordered size="small" :column="{ xs: 1, sm: 2, lg: 3 }">
      <a-descriptions-item label="文件名">
        {{ state.fileName || '-' }}
      </a-descriptions-item>
      <a-descriptions-item label="文件大小">
        {{ state.fileSizeText }}
      </a-descriptions-item>
      <a-descriptions-item label="当前状态">
        {{ state.statusText }}
      </a-descriptions-item>
      <a-descriptions-item v-if="state.summaryNo" label="汇总单号" :span="3">
        <span class="summary-number">{{ state.summaryNo }}</span>
      </a-descriptions-item>
      <a-descriptions-item label="总记录数">
        {{ state.totalRecords }}
      </a-descriptions-item>
      <a-descriptions-item label="有效记录数">
        {{ state.validRecords }}
      </a-descriptions-item>
      <a-descriptions-item label="错误记录数">
        {{ state.errorRecords }}
      </a-descriptions-item>
      <a-descriptions-item label="重复记录数">
        {{ state.duplicateRecords }}
      </a-descriptions-item>
      <a-descriptions-item label="待新增数量">
        {{ state.pendingCreate }}
      </a-descriptions-item>
      <a-descriptions-item label="重复导入策略">
        禁止重复导入
      </a-descriptions-item>
    </a-descriptions>

    <div v-if="state.status === 'importing' || state.status === 'completed'" mt-4>
      <a-progress :percent="state.progress" />
      <div mt-2 c="var(--text-color-secondary)">
        当前处理 {{ state.processedRecords }} / {{ state.validRecords }} 条，成功 {{ state.successCount }} 条，失败 {{ state.failedCount }} 条。
      </div>
    </div>

    <a-alert
      v-if="state.errorDetails.length"
      mt-4
      type="error"
      show-icon
      :message="`错误明细（${state.errorDetails.length}）`"
      :description="state.errorDetails.slice(0, 5).join('；')"
    />
    <a-alert
      v-if="state.duplicateDetails.length"
      mt-4
      type="warning"
      show-icon
      :message="`重复明细（${state.duplicateDetails.length}）`"
      :description="state.duplicateDetails.slice(0, 5).join('；')"
    />

    <a-divider>导入预览</a-divider>
    <a-table
      size="small"
      row-key="code"
      :columns="previewColumns"
      :data-source="state.previewRows"
      :row-selection="rowSelection"
      :pagination="{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], showTotal: (total: number) => `共 ${total} 条` }"
      :scroll="{ x: previewScrollX }"
    >
      <template #bodyCell="{ column, record }">
        <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
          <span class="cell-ellipsis">
            {{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}
          </span>
        </a-tooltip>
      </template>
    </a-table>

    <template #footer>
      <a-space>
        <a-button :disabled="state.status === 'importing'" @click="emit('cancel')">
          取消
        </a-button>
        <a-button @click="emit('downloadErrors')">
          下载错误明细
        </a-button>
        <a-button :disabled="state.status === 'importing'" @click="emit('reselect')">
          重新选择文件
        </a-button>
        <a-button type="primary" :disabled="!state.canConfirm" :loading="state.status === 'importing'" @click="emit('confirm')">
          确认导入
        </a-button>
      </a-space>
    </template>
  </a-modal>
</template>

<style scoped>
.summary-number {
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
</style>

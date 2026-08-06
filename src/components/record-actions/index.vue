<script setup lang="ts">
export interface RecordActionItem {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  hidden?: boolean
  confirm?: boolean
  confirmTitle?: string
  onClick: () => void | Promise<void>
}

const props = withDefaults(defineProps<{
  actions: RecordActionItem[]
  inlineCount?: number
}>(), {
  inlineCount: 3,
})

const visibleActions = computed(() => props.actions.filter(action => !action.hidden))
const viewAction = computed(() => visibleActions.value.find(action => action.key === 'view' || action.label === '查看'))
const auditActions = computed(() => {
  return visibleActions.value.filter((action) => {
    const key = action.key.toLowerCase()
    return ['audit', 'approve', 'reject', 'submit', 'revoke'].includes(key) || action.label.includes('审核')
  })
})
const moreActions = computed(() => {
  const groupedKeys = new Set([
    viewAction.value?.key,
    ...auditActions.value.map(action => action.key),
  ])
  return visibleActions.value.filter(action => !groupedKeys.has(action.key))
})

function runAction(action: RecordActionItem) {
  if (action.disabled)
    return
  return action.onClick()
}

function runFirstAuditAction() {
  const action = auditActions.value.find(item => !item.disabled)
  if (!action)
    return
  return runAction(action)
}
</script>

<template>
  <a-space v-if="visibleActions.length" class="record-actions" :size="4">
    <a-button
      type="link"
      size="small"
      :disabled="!viewAction || viewAction.disabled"
      @click="viewAction && runAction(viewAction)"
    >
      查看
    </a-button>

    <a-dropdown v-if="auditActions.length > 1" trigger="click">
      <a-button type="link" size="small">
        审核
      </a-button>
      <template #overlay>
        <a-menu>
          <a-menu-item v-for="action in auditActions" :key="action.key" :disabled="action.disabled">
            <a-popconfirm
              v-if="action.confirm"
              :title="action.confirmTitle || `确定${action.label}该记录？`"
              :ok-button-props="{ danger: action.danger }"
              ok-text="确定"
              cancel-text="取消"
              @confirm="runAction(action)"
            >
              <span :class="{ 'action-danger': action.danger }">{{ action.label }}</span>
            </a-popconfirm>
            <span v-else :class="{ 'action-danger': action.danger }" @click="runAction(action)">
              {{ action.label }}
            </span>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
    <a-button
      v-else
      type="link"
      size="small"
      :disabled="!auditActions.length || auditActions[0]?.disabled"
      @click="runFirstAuditAction"
    >
      审核
    </a-button>

    <a-dropdown trigger="click" :disabled="!moreActions.length">
      <a-button type="link" size="small" :disabled="!moreActions.length">
        更多
      </a-button>
      <template #overlay>
        <a-menu>
          <a-menu-item v-for="action in moreActions" :key="action.key" :disabled="action.disabled">
            <a-popconfirm
              v-if="action.confirm"
              :title="action.confirmTitle || `确定${action.label}该记录？`"
              :ok-button-props="{ danger: action.danger }"
              ok-text="确定"
              cancel-text="取消"
              @confirm="runAction(action)"
            >
              <span :class="{ 'action-danger': action.danger }">{{ action.label }}</span>
            </a-popconfirm>
            <span v-else :class="{ 'action-danger': action.danger }" @click="runAction(action)">
              {{ action.label }}
            </span>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </a-space>
  <span v-else class="action-empty">无可用操作</span>
</template>

<style scoped lang="less">
.action-danger {
  color: #ff4d4f;
}

.action-empty {
  color: rgb(0 0 0 / 45%);
}

.record-actions {
  white-space: nowrap;

  :deep(.ant-btn-link) {
    padding-inline: 4px;
  }
}
</style>

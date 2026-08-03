<script setup lang="ts">
type Row = Record<string, any>

defineProps<{
  canManage: boolean
  loading: boolean
  reconciliation: { missingCount: number, missing: Row[] }
  steps: Row[]
}>()

const emit = defineEmits<{ check: [], reconcile: [] }>()
</script>

<template>
  <section class="finance-workflow" aria-label="财务闭环进度">
    <div class="finance-workflow__header">
      <div><h2>财务闭环</h2><p>从审批结果到实际现金收支，按待处理数量逐项推进。</p></div>
      <a-space v-if="canManage" wrap>
        <a-button size="small" :loading="loading" @click="emit('check')">
          检查回写
        </a-button>
        <a-popconfirm v-if="reconciliation.missingCount" :title="`确认回补 ${reconciliation.missingCount} 条历史审批？操作可重复执行，不会生成重复台账。`" ok-text="确认回补" cancel-text="取消" @confirm="emit('reconcile')">
          <a-button size="small" type="primary" danger :loading="loading">
            回补 {{ reconciliation.missingCount }} 条
          </a-button>
        </a-popconfirm>
      </a-space>
    </div>
    <div class="finance-workflow__steps">
      <RouterLink v-for="(step, index) in steps" :key="step.key" :to="step.path" class="finance-step" :class="`is-${step.state}`">
        <span class="finance-step__index">{{ index + 1 }}</span>
        <span class="finance-step__content"><strong>{{ step.label }}</strong><small>{{ step.detail }}</small></span>
        <span class="finance-step__count">{{ step.count }}</span>
      </RouterLink>
    </div>
    <a-alert v-if="reconciliation.missingCount" class="finance-workflow__alert" type="warning" show-icon :message="`${reconciliation.missingCount} 条已通过审批尚未生成财务台账`" :description="reconciliation.missing.slice(0, 3).map(item => `${item.approvalCode} → ${item.target}`).join('；')" />
  </section>
</template>

<style scoped lang="less">
.finance-workflow {
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: 8px;
  background: var(--admin-surface);
}
.finance-workflow__header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}
.finance-workflow__header h2 {
  margin: 0;
  color: var(--admin-text);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.4;
}
.finance-workflow__header p {
  margin: 3px 0 0;
  color: var(--admin-text-secondary);
  font-size: 13px;
}
.finance-workflow__steps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--admin-border-subtle);
  border-radius: 6px;
}
.finance-step {
  position: relative;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  min-height: 64px;
  padding: 10px 12px;
  background: var(--admin-surface);
  color: inherit;
  text-decoration: none;
}
.finance-step + .finance-step {
  border-left: 1px solid var(--admin-border-subtle);
}
.finance-step:hover,
.finance-step:focus-visible {
  background: var(--admin-bg-subtle, #f8fafc);
}
.finance-step:focus-visible {
  outline: 2px solid var(--admin-primary);
  outline-offset: -2px;
}
.finance-step.is-warning {
  background: #fffaf0;
}
.finance-step__index {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e8eef7;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}
.finance-step.is-done .finance-step__index {
  background: #dcfce7;
  color: #166534;
}
.finance-step.is-active .finance-step__index {
  background: #dbeafe;
  color: #1d4ed8;
}
.finance-step.is-warning .finance-step__index {
  background: #fef3c7;
  color: #92400e;
}
.finance-step__content {
  display: grid;
  min-width: 0;
  gap: 2px;
}
.finance-step__content strong {
  color: var(--admin-text);
  font-size: 13px;
  font-weight: 650;
}
.finance-step__content small {
  overflow: hidden;
  color: var(--admin-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.finance-step__count {
  min-width: 22px;
  color: var(--admin-text);
  font-size: 15px;
  font-weight: 700;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.finance-workflow__alert {
  margin-top: 12px;
}
@media (max-width: 1100px) {
  .finance-workflow__steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .finance-step + .finance-step {
    border-left: 0;
    border-top: 1px solid var(--admin-border-subtle);
  }
}
@media (max-width: 640px) {
  .finance-workflow__header {
    flex-direction: column;
  }
  .finance-workflow__steps {
    grid-template-columns: 1fr;
  }
}
</style>

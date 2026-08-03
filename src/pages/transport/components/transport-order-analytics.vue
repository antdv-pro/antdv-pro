<script setup lang="ts">
type Row = Record<string, any>
type Dimension = 'customer' | 'routeLine' | 'plateNo' | 'financeMonth'

const props = defineProps<{ rows: Row[] }>()

const dimension = ref<Dimension>('customer')
const options = [
  { label: '按客户', value: 'customer' },
  { label: '按路线', value: 'routeLine' },
  { label: '按车辆', value: 'plateNo' },
  { label: '按月份', value: 'financeMonth' },
]

function number(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const summary = computed(() => {
  const grouped = new Map<string, { name: string, income: number, volume: number, count: number }>()
  props.rows.forEach((row) => {
    const income = number(row.taxedFreight) || number(row.freightTotal)
    const volume = number(row.receivedWeight) || number(row.sentWeight)
    const name = String(row[dimension.value] || '未归类')
    const item = grouped.get(name) || { name, income: 0, volume: 0, count: 0 }
    item.income += income
    item.volume += volume
    item.count += 1
    grouped.set(name, item)
  })
  return [...grouped.values()].sort((a, b) => b.income - a.income).slice(0, 10)
})

const maxIncome = computed(() => Math.max(...summary.value.map(item => item.income), 1))
const maxVolume = computed(() => Math.max(...summary.value.map(item => item.volume), 1))

function money(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
</script>

<template>
  <section class="order-analysis" aria-label="运输订单收入与运量分析">
    <header>
      <div>
        <h3>收入与运量</h3>
        <p>点击维度切换汇总口径，展示当前筛选范围前 10 项</p>
      </div>
      <a-segmented v-model:value="dimension" :options="options" />
    </header>

    <div v-if="summary.length" class="analysis-table">
      <div class="analysis-head">
        <span>维度</span><span>税后收入</span><span>运输量</span><span>订单</span>
      </div>
      <div v-for="item in summary" :key="item.name" class="analysis-row">
        <strong :title="item.name">{{ item.name }}</strong>
        <div class="metric-cell">
          <span>{{ money(item.income) }}</span>
          <i class="income-bar" :style="{ width: `${item.income / maxIncome * 100}%` }" />
        </div>
        <div class="metric-cell">
          <span>{{ item.volume.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) }} 吨</span>
          <i class="volume-bar" :style="{ width: `${item.volume / maxVolume * 100}%` }" />
        </div>
        <span>{{ item.count }} 单</span>
      </div>
    </div>
    <a-empty v-else description="当前筛选范围暂无订单数据" />
  </section>
</template>

<style scoped>
.order-analysis {
  margin-bottom: 12px;
  padding: 16px 18px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  background: var(--admin-surface);
}
header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}
h3,
p {
  margin: 0;
}
h3 {
  color: var(--admin-text);
  font-size: 15px;
}
p {
  margin-top: 3px;
  color: var(--admin-muted);
  font-size: 12px;
}
.analysis-table {
  min-width: 0;
  overflow-x: auto;
}
.analysis-head,
.analysis-row {
  display: grid;
  grid-template-columns: minmax(130px, 1.2fr) minmax(180px, 2fr) minmax(180px, 2fr) 64px;
  gap: 14px;
  align-items: center;
  min-width: 680px;
}
.analysis-head {
  padding: 7px 10px;
  color: var(--admin-muted);
  background: var(--admin-surface-muted);
  font-size: 12px;
  font-weight: 600;
}
.analysis-row {
  min-height: 48px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--admin-border-subtle);
  color: var(--admin-text-secondary);
  font-size: 13px;
}
.analysis-row:last-child {
  border-bottom: 0;
}
.analysis-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--admin-text);
}
.metric-cell {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 28px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--admin-surface-muted);
}
.metric-cell span {
  position: relative;
  z-index: 1;
  padding: 0 8px;
  color: var(--admin-text);
  font-variant-numeric: tabular-nums;
}
.metric-cell i {
  position: absolute;
  inset: 0 auto 0 0;
  opacity: 0.18;
}
.income-bar {
  background: var(--admin-primary);
}
.volume-bar {
  background: var(--admin-success);
}
@media (max-width: 720px) {
  header {
    flex-direction: column;
  }
  :deep(.ant-segmented) {
    width: 100%;
    overflow-x: auto;
  }
}
</style>

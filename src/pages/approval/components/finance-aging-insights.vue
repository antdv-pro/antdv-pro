<script setup lang="ts">
import dayjs from 'dayjs'

type Row = Record<string, any>
const props = defineProps<{ rows: Row[] }>()

const buckets = computed(() => {
  const today = dayjs().startOf('day')
  const definitions = [
    { label: '未到期', min: Number.NEGATIVE_INFINITY, max: -1 },
    { label: '逾期 1-30 天', min: 0, max: 30 },
    { label: '逾期 31-90 天', min: 31, max: 90 },
    { label: '逾期 90 天以上', min: 91, max: Number.POSITIVE_INFINITY },
  ]
  return definitions.map((bucket) => {
    const matched = props.rows.filter((row) => {
      if (String(row.billType || '') !== '应收')
        return false
      const due = dayjs(row.dueDate)
      if (!due.isValid())
        return bucket.label === '未到期'
      const days = today.diff(due.startOf('day'), 'day')
      return days >= bucket.min && days <= bucket.max
    })
    return {
      ...bucket,
      count: matched.length,
      amount: matched.reduce((sum, row) => sum + Number(row.unpaidAmount || row.amount || 0), 0),
    }
  })
})

const maxAmount = computed(() => Math.max(...buckets.value.map(item => item.amount), 1))
const dueSoon = computed(() => props.rows.filter((row) => {
  const due = dayjs(row.dueDate)
  const days = due.diff(dayjs().startOf('day'), 'day')
  return String(row.billType || '') === '应收' && days >= 0 && days <= 7 && Number(row.unpaidAmount || row.amount || 0) > 0
}).length)
</script>

<template>
  <section class="aging-insights" aria-label="应收账龄分析">
    <header>
      <div><h3>应收账龄</h3><p>按到期日和当前未收金额自动分层</p></div>
      <a-tag :color="dueSoon ? 'warning' : 'success'">
        7 天内到期 {{ dueSoon }} 笔
      </a-tag>
    </header>
    <div class="aging-grid">
      <div v-for="item in buckets" :key="item.label" class="aging-item">
        <span>{{ item.label }}</span>
        <strong>¥{{ item.amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) }}</strong>
        <i><b :style="{ width: `${item.amount / maxAmount * 100}%` }" /></i>
        <small>{{ item.count }} 笔</small>
      </div>
    </div>
  </section>
</template>

<style scoped>
.aging-insights {
  margin-bottom: 16px;
  padding: 15px 18px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  background: var(--admin-surface);
}
header {
  display: flex;
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
.aging-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 16px;
}
.aging-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 10px;
  min-width: 0;
}
.aging-item > span,
.aging-item > small {
  color: var(--admin-muted);
  font-size: 12px;
}
.aging-item > strong {
  color: var(--admin-text);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.aging-item > i {
  grid-column: 1 / -1;
  height: 7px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--admin-surface-muted);
}
.aging-item b {
  display: block;
  height: 100%;
  background: var(--admin-warning);
}
.aging-item > small {
  grid-column: 1 / -1;
}
@media (max-width: 800px) {
  .aging-grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 480px) {
  .aging-grid {
    grid-template-columns: 1fr;
  }
}
</style>

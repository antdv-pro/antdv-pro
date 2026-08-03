<script setup lang="ts">
import dayjs from 'dayjs'

type Row = Record<string, any>
const props = defineProps<{ rows: Row[] }>()

const statusItems = computed(() => {
  const today = dayjs().startOf('day')
  const values = { '即将到期': 0, '已过期': 0, '有效': 0 }
  props.rows.forEach((row) => {
    const end = dayjs(row.validEndDate)
    const days = end.diff(today, 'day')
    if (!end.isValid() || days < 0)
      values['已过期'] += 1
    else if (days <= 30)
      values['即将到期'] += 1
    else values['有效'] += 1
  })
  return Object.entries(values).map(([label, value]) => ({ label, value }))
})

const monthItems = computed(() => {
  const map = new Map<string, number>()
  props.rows.forEach((row) => {
    const date = dayjs(row.validStartDate || row.createdAt)
    if (!date.isValid())
      return
    const key = date.format('YYYY-MM')
    map.set(key, (map.get(key) || 0) + Number(row.totalAmount || 0))
  })
  return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label)).slice(-6)
})
const maxMonth = computed(() => Math.max(...monthItems.value.map(item => item.value), 1))
</script>

<template>
  <section class="fee-insights" aria-label="规费到期与支出分析">
    <div class="expiry-summary">
      <div v-for="item in statusItems" :key="item.label">
        <span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>项规费</small>
      </div>
    </div>
    <div class="monthly-spend">
      <header><strong>月度支出趋势</strong><span>按有效期开始月份统计</span></header>
      <div class="month-bars">
        <div v-for="item in monthItems" :key="item.label">
          <span>{{ item.label.slice(5) }}月</span><i><b :style="{ height: `${Math.max(5, item.value / maxMonth * 100)}%` }" /></i><small>¥{{ Math.round(item.value).toLocaleString('zh-CN') }}</small>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fee-insights {
  display: grid;
  grid-template-columns: minmax(300px, 0.8fr) minmax(420px, 1.2fr);
  gap: 12px;
  margin-bottom: 12px;
}
.expiry-summary,
.monthly-spend {
  padding: 15px 18px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  background: var(--admin-surface);
}
.expiry-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.expiry-summary > div {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.expiry-summary span,
.expiry-summary small,
header span,
.month-bars span,
.month-bars small {
  color: var(--admin-muted);
  font-size: 12px;
}
.expiry-summary strong {
  margin: 4px 0;
  color: var(--admin-text);
  font-size: 22px;
}
header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  color: var(--admin-text);
  font-size: 13px;
}
.month-bars {
  display: flex;
  gap: 12px;
  align-items: end;
  height: 92px;
}
.month-bars > div {
  display: grid;
  grid-template-rows: 14px 1fr 16px;
  gap: 3px;
  flex: 1;
  min-width: 42px;
  height: 100%;
  text-align: center;
}
.month-bars i {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 4px 4px 0 0;
  background: var(--admin-surface-muted);
}
.month-bars b {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  background: var(--admin-primary);
}
.month-bars small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 900px) {
  .fee-insights {
    grid-template-columns: 1fr;
  }
}
</style>

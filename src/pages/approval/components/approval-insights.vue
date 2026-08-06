<script setup lang="ts">
import dayjs from 'dayjs'

type Row = Record<string, any>
const props = defineProps<{ instances: Row[], todo: Row[], done: Row[] }>()

function amount(row: Row) {
  const value = Number(row.amount ?? row.formData?.amount ?? row.formSnapshot?.amount ?? 0)
  return Number.isFinite(value) ? value : 0
}

function dateOf(row: Row) {
  return dayjs(row.submittedAt || row.createdAt || row.updatedAt)
}

const averageHours = computed(() => {
  const durations = props.done.map((row) => {
    const start = dateOf(row)
    const end = dayjs(row.completedAt || row.actedAt || row.updatedAt)
    return start.isValid() && end.isValid() ? Math.max(0, end.diff(start, 'minute') / 60) : 0
  }).filter(Boolean)
  return durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0
})

const departmentData = computed(() => {
  const map = new Map<string, number>()
  props.todo.forEach((row) => {
    const name = String(row.deptName || row.departmentName || row.instance?.deptName || row.formSnapshot?.departmentName || '未分配部门')
    map.set(name, (map.get(name) || 0) + 1)
  })
  return [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
})

const monthData = computed(() => {
  const map = new Map<string, number>()
  props.instances.forEach((row) => {
    const date = dateOf(row)
    if (!date.isValid())
      return
    const key = date.format('YYYY-MM')
    map.set(key, (map.get(key) || 0) + amount(row))
  })
  return [...map].map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name)).slice(-6)
})

const maxDepartment = computed(() => Math.max(...departmentData.value.map(item => item.value), 1))
const maxAmount = computed(() => Math.max(...monthData.value.map(item => item.value), 1))
</script>

<template>
  <section class="approval-insights" aria-label="审批效率分析">
    <div class="efficiency-summary">
      <span>平均审批时效</span>
      <strong>{{ averageHours ? `${averageHours.toFixed(1)} 小时` : '-' }}</strong>
      <small>按已办任务提交至完成时间计算</small>
    </div>
    <div class="insight-chart">
      <header><strong>部门待办分布</strong><span>{{ todo.length }} 项待办</span></header>
      <div v-if="departmentData.length" class="bars">
        <div v-for="item in departmentData" :key="item.name" class="bar-row">
          <span :title="item.name">{{ item.name }}</span>
          <i><b :style="{ width: `${item.value / maxDepartment * 100}%` }" /></i>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
      <a-empty v-else description="暂无部门待办" />
    </div>
    <div class="insight-chart">
      <header><strong>审批金额趋势</strong><span>最近 6 个月</span></header>
      <div v-if="monthData.length" class="bars">
        <div v-for="item in monthData" :key="item.name" class="bar-row">
          <span>{{ item.name.slice(5) }}月</span>
          <i><b class="amount" :style="{ width: `${item.value / maxAmount * 100}%` }" /></i>
          <strong>¥{{ Math.round(item.value).toLocaleString('zh-CN') }}</strong>
        </div>
      </div>
      <a-empty v-else description="暂无金额数据" />
    </div>
  </section>
</template>

<style scoped>
.approval-insights {
  display: grid;
  grid-template-columns: 190px repeat(2, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.efficiency-summary,
.insight-chart {
  min-width: 0;
  padding: 15px 16px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  background: var(--admin-surface);
}
.efficiency-summary {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.efficiency-summary span,
.efficiency-summary small,
header span {
  color: var(--admin-muted);
  font-size: 12px;
}
.efficiency-summary strong {
  margin: 6px 0 4px;
  color: var(--admin-text);
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}
header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  color: var(--admin-text);
  font-size: 13px;
}
.bars {
  display: grid;
  gap: 7px;
}
.bar-row {
  display: grid;
  grid-template-columns: 78px minmax(80px, 1fr) 76px;
  gap: 8px;
  align-items: center;
  min-height: 20px;
  font-size: 12px;
}
.bar-row > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--admin-text-secondary);
}
.bar-row > i {
  height: 7px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--admin-surface-muted);
}
.bar-row b {
  display: block;
  height: 100%;
  background: var(--admin-warning);
}
.bar-row b.amount {
  background: var(--admin-primary);
}
.bar-row > strong {
  overflow: hidden;
  color: var(--admin-text);
  font-size: 12px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 1100px) {
  .approval-insights {
    grid-template-columns: 1fr 1fr;
  }
  .efficiency-summary {
    grid-column: 1 / -1;
  }
}
@media (max-width: 720px) {
  .approval-insights {
    grid-template-columns: 1fr;
  }
  .efficiency-summary {
    grid-column: auto;
  }
}
</style>

<script setup lang="ts">
type Row = Record<string, any>
const props = defineProps<{ moduleName: string, rows: Row[] }>()
function number(value: unknown) {
  const result = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(result) ? result : 0
}
const title = computed(() => ({ TransportFuel: '单车油耗与油价变化', TransportEtc: 'ETC 路线费用排行', TransportDriverPayroll: '司机薪资构成' }[props.moduleName] || '业务分析'))
const rows = computed(() => {
  if (props.moduleName === 'TransportFuel') {
    const map = new Map<string, { label: string, primary: number, secondary: number, count: number }>()
    props.rows.forEach((row) => {
      const key = String(row.plateNo || '未关联车辆')
      const item = map.get(key) || { label: key, primary: 0, secondary: 0, count: 0 }
      item.primary += number(row.quantity || row.fuelVolume)
      item.secondary += number(row.amount)
      item.count += 1
      map.set(key, item)
    })
    return [...map.values()].map(item => ({ ...item, secondary: item.primary ? item.secondary / item.primary : 0 })).sort((a, b) => b.primary - a.primary).slice(0, 8)
  }
  if (props.moduleName === 'TransportEtc') {
    const map = new Map<string, { label: string, primary: number, secondary: number, count: number, journeys: Set<string> }>()
    props.rows.forEach((row) => {
      const key = String(row.routeLine || row.route || row.tollRoute || row.name || (row.entryInfo && row.exitInfo ? `${row.entryInfo} - ${row.exitInfo}` : '') || '未识别路线')
      const item = map.get(key) || { label: key, primary: 0, secondary: 0, count: 0, journeys: new Set<string>() }
      item.primary += number(row.amount)
      item.journeys.add(String(row.routeJourneyId || row.code))
      item.count = item.journeys.size
      map.set(key, item)
    })
    return [...map.values()].sort((a, b) => b.primary - a.primary).slice(0, 8)
  }
  if (props.moduleName === 'TransportDriverPayroll') {
    return props.rows.map(row => ({ label: String(row.name || row.driver || '未关联司机'), primary: number(row.amount || row.netSalary), secondary: number(row.baseSalary), count: number(row.tripCommission || row.allowance) - number(row.deduction) })).sort((a, b) => b.primary - a.primary).slice(0, 8)
  }
  return []
})
const max = computed(() => Math.max(...rows.value.map(item => item.primary), 1))
</script>

<template>
  <section v-if="rows.length" class="submodule-analysis">
    <header><strong>{{ title }}</strong><span>当前筛选范围前 8 项</span></header>
    <div class="analysis-grid">
      <div v-for="item in rows" :key="item.label" class="analysis-row">
        <span :title="item.label">{{ item.label }}</span><i><b :style="{ width: `${item.primary / max * 100}%` }" /></i>
        <strong v-if="moduleName === 'TransportFuel'">{{ item.primary.toFixed(1) }} L</strong><strong v-else>¥{{ item.primary.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) }}</strong>
        <small v-if="moduleName === 'TransportFuel'">均价 ¥{{ item.secondary.toFixed(2) }}/L</small><small v-else-if="moduleName === 'TransportEtc'">{{ item.count }} 趟</small><small v-else>固定 ¥{{ item.secondary.toFixed(0) }} · 浮动 ¥{{ item.count.toFixed(0) }}</small>
      </div>
    </div>
  </section>
</template>

<style scoped>
.submodule-analysis {
  margin-bottom: 12px;
  padding: 15px 18px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  background: var(--admin-surface);
}
header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  color: var(--admin-text);
  font-size: 13px;
}
header span,
small {
  color: var(--admin-muted);
  font-size: 12px;
}
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(260px, 1fr));
  gap: 8px 24px;
}
.analysis-row {
  display: grid;
  grid-template-columns: 100px minmax(80px, 1fr) 86px 132px;
  gap: 8px;
  align-items: center;
  min-height: 26px;
  font-size: 12px;
}
.analysis-row > span,
.analysis-row small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.analysis-row > span {
  color: var(--admin-text-secondary);
}
.analysis-row > i {
  height: 7px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--admin-surface-muted);
}
.analysis-row b {
  display: block;
  height: 100%;
  background: var(--admin-primary);
}
.analysis-row strong {
  color: var(--admin-text);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 900px) {
  .analysis-grid {
    grid-template-columns: 1fr;
  }
}
</style>

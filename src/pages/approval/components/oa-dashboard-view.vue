<script setup lang="ts">
type Row = Record<string, any>

defineProps<{
  quickLinks: Row[]
  financeStatus: Row[]
  approvalBreakdown: Row[]
  risks: Row[]
  moduleSummaries: Row[]
  expenseTrend: Row[]
  expenseTrendMax: number
  incomeExpenseShare: { income: number, expense: number, total: number }
  pendingSalaryAmount: number
  overdueReceivableAmount: number
  money: (value: unknown) => string
  percent: (value: number, total: number) => number
}>()
</script>

<template>
  <a-card title="快速入口" :bordered="false" class="dashboard-quick-panel" mb-4>
    <div class="quick-link-grid">
      <RouterLink v-for="item in quickLinks" :key="item.path" class="quick-link-item" :to="item.path">
        <strong>{{ item.label }}</strong><span>{{ item.desc }}</span>
      </RouterLink>
    </div>
  </a-card>

  <section class="dashboard-overview">
    <a-card :bordered="false" class="dashboard-funds-panel">
      <template #title>
        <div class="panel-title-stack">
          <strong>资金状态总览</strong><span>按当前筛选条件汇总 OA 收支、现金、应收应付和审批金额</span>
        </div>
      </template>
      <div class="dashboard-funds-grid">
        <div v-for="item in financeStatus" :key="item.label" class="dashboard-kpi-card">
          <div class="dashboard-kpi-label">
            {{ item.label }}
          </div>
          <div class="dashboard-kpi-value" :class="`tone-${item.tone}`">
            {{ item.value }}
          </div>
          <div class="dashboard-kpi-hint">
            {{ item.hint }}
          </div>
        </div>
      </div>
    </a-card>
    <a-card title="审批状态结构" :bordered="false" class="dashboard-panel dashboard-approval-panel">
      <div class="approval-breakdown-list">
        <div v-for="item in approvalBreakdown" :key="item.label" class="approval-breakdown-row">
          <div class="breakdown-title">
            <span>{{ item.label }}</span><strong>{{ item.value }}</strong>
          </div>
          <a-progress :percent="item.percent" :show-info="false" :status="item.tone === 'danger' ? 'exception' : item.tone === 'success' ? 'success' : 'active'" />
        </div>
      </div>
    </a-card>
    <a-card title="风险提醒" :bordered="false" class="dashboard-panel dashboard-risk-panel">
      <div class="risk-list">
        <div v-for="item in risks" :key="item.title" class="risk-row" :class="`risk-${item.level}`">
          <div><strong>{{ item.title }}</strong><span>{{ item.desc }}</span></div><em>{{ item.value }}</em>
        </div>
      </div>
    </a-card>
  </section>

  <section class="dashboard-workbench">
    <a-card title="经营模块汇总" :bordered="false" class="dashboard-panel dashboard-module-panel">
      <div class="module-summary-grid">
        <RouterLink v-for="item in moduleSummaries" :key="item.title" class="module-summary-item" :to="item.path">
          <div class="module-summary-title">
            {{ item.title }}
          </div>
          <div v-for="metric in item.metrics" :key="metric[0]" class="module-summary-metric">
            <span>{{ metric[0] }}</span><strong>{{ metric[1] }}</strong>
          </div>
        </RouterLink>
      </div>
    </a-card>
    <a-card title="实际现金收支趋势" :bordered="false" class="dashboard-panel">
      <div v-if="expenseTrend.length" class="trend-chart">
        <div class="trend-legend" aria-label="图例">
          <span><i class="income" />实际收入</span><span><i class="expense" />实际支出</span>
        </div>
        <div v-for="item in expenseTrend" :key="item.month" class="trend-row">
          <span class="trend-month">{{ item.month }}</span>
          <div class="trend-bars">
            <div class="trend-track">
              <div class="trend-bar income" :style="{ width: `${percent(item.income, expenseTrendMax)}%` }">
                {{ money(item.income) }}
              </div>
            </div>
            <div class="trend-track">
              <div class="trend-bar expense" :style="{ width: `${percent(item.expense, expenseTrendMax)}%` }">
                {{ money(item.expense) }}
              </div>
            </div>
            <span class="trend-net" :class="{ negative: item.net < 0 }">净额 {{ money(item.net) }}</span>
          </div>
        </div>
      </div>
      <a-empty v-else description="当前筛选范围暂无收支数据" />
    </a-card>
    <a-card title="实际现金收支占比" :bordered="false" class="dashboard-panel">
      <div class="share-line">
        <span>实际收入</span><a-progress :percent="percent(incomeExpenseShare.income, incomeExpenseShare.total)" status="success" />
      </div>
      <div class="share-line">
        <span>实际支出</span><a-progress :percent="percent(incomeExpenseShare.expense, incomeExpenseShare.total)" status="exception" />
      </div>
      <a-alert mt-4 type="info" show-icon :message="`工资待发金额 ${money(pendingSalaryAmount)}，逾期应收金额 ${money(overdueReceivableAmount)}`" />
    </a-card>
  </section>
</template>

<style scoped lang="less">
.dashboard-overview,
.dashboard-workbench {
  display: grid;
  gap: 16px;
  margin-bottom: 16px;
}
.dashboard-overview {
  grid-template-columns: 2fr 1fr 1.25fr;
  grid-template-areas: 'funds approval risk';
  align-items: stretch;
}
.dashboard-workbench {
  grid-template-columns: 1.2fr 1.1fr 0.8fr;
  align-items: stretch;
}
.dashboard-funds-panel {
  grid-area: funds;
}
.dashboard-approval-panel {
  grid-area: approval;
}
.dashboard-risk-panel {
  grid-area: risk;
}
.dashboard-panel,
.dashboard-funds-panel {
  height: 100%;
}
:deep(.dashboard-panel .ant-card-body),
:deep(.dashboard-funds-panel .ant-card-body) {
  padding: 16px;
}
.dashboard-funds-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  height: 100%;
}
.dashboard-kpi-card {
  min-height: 112px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}
.dashboard-kpi-label,
.dashboard-kpi-hint {
  color: #64748b;
  font-size: 12px;
}
.dashboard-kpi-value {
  margin: 8px 0 6px;
  color: #0f172a;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.2;
}
.tone-success {
  color: #15803d;
}
.tone-danger {
  color: #b91c1c;
}
.tone-warning {
  color: #b45309;
}
.tone-primary {
  color: #1d4ed8;
}
.panel-title-stack {
  display: grid;
  gap: 2px;
}
.panel-title-stack strong {
  color: #0f172a;
  font-size: 16px;
}
.panel-title-stack span {
  color: #64748b;
  font-size: 12px;
  font-weight: 400;
}
.approval-breakdown-row {
  margin-bottom: 16px;
}
.approval-breakdown-row:last-child {
  margin-bottom: 0;
}
.breakdown-title {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #334155;
}
.module-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  height: 100%;
}
.module-summary-item {
  display: block;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: inherit;
  text-decoration: none;
}
.module-summary-item:hover {
  border-color: #1677ff;
}
.module-summary-title {
  margin-bottom: 8px;
  color: #0f172a;
  font-weight: 700;
}
.module-summary-metric {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
}
.module-summary-metric strong {
  color: #0f172a;
  font-weight: 650;
}
.risk-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
}
.risk-row:last-child {
  border-bottom: 0;
}
.risk-row div {
  display: grid;
  gap: 2px;
}
.risk-row span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}
.risk-row em {
  color: #0f172a;
  font-style: normal;
  font-weight: 700;
  white-space: nowrap;
}
.risk-danger em {
  color: #b91c1c;
}
.risk-warning em {
  color: #b45309;
}
.quick-link-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.quick-link-item {
  display: flex;
  min-width: 156px;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: inherit;
  text-decoration: none;
}
.quick-link-item:hover {
  border-color: #1677ff;
  background: #f8fbff;
}
.quick-link-item strong {
  color: #0f172a;
  white-space: nowrap;
}
.quick-link-item span {
  color: #64748b;
  font-size: 12px;
}
:deep(.dashboard-quick-panel .ant-card-body) {
  padding: 12px 16px 16px;
}
.trend-row {
  display: grid;
  grid-template-columns: 82px 1fr;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}
.trend-chart {
  min-width: 0;
}
.trend-legend {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-bottom: 16px;
  color: #64748b;
  font-size: 12px;
}
.trend-legend span {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.trend-legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.trend-legend i.income,
.trend-bar.income {
  background: #16a34a;
}
.trend-legend i.expense,
.trend-bar.expense {
  background: #ef4444;
}
.trend-month {
  color: #64748b;
  font-size: 13px;
}
.trend-bars {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.trend-track {
  min-width: 0;
  overflow: hidden;
  border-radius: 4px;
  background: #f1f5f9;
}
.trend-bar {
  min-width: min(88px, 100%);
  height: 24px;
  padding: 0 8px;
  overflow: hidden;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  line-height: 24px;
  white-space: nowrap;
}
.trend-net {
  color: #15803d;
  font-size: 12px;
}
.trend-net.negative {
  color: #dc2626;
}
.share-line {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}
@media (max-width: 900px) {
  .dashboard-overview,
  .dashboard-workbench,
  .module-summary-grid {
    grid-template-columns: 1fr;
  }
  .dashboard-overview {
    grid-template-areas: 'funds' 'approval' 'risk';
  }
  .dashboard-funds-grid {
    grid-template-columns: 1fr;
  }
}
@media (min-width: 901px) and (max-width: 1280px) {
  .dashboard-overview {
    grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
    grid-template-areas: 'funds approval' 'risk risk';
  }
  .dashboard-workbench {
    grid-template-columns: 1fr 1fr;
  }
}
</style>

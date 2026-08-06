<script setup lang="ts">
import type { FinancialComparison } from '~@/utils/financial-comparison'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  MinusOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { computed } from 'vue'
import { formatFinancialComparisonChange } from '~@/utils/financial-comparison'

export type SummaryDataState = 'ready' | 'empty' | 'unavailable'

export interface SummaryCardItem {
  label: string
  value: string | number
  hint?: string
  comparison?: FinancialComparison
  tag?: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
  dataState?: SummaryDataState
}

const props = withDefaults(defineProps<{
  cards: SummaryCardItem[]
  loading?: boolean
  xlSpan?: number
  compact?: boolean
  singleColumn?: boolean
  dataState?: SummaryDataState
}>(), {
  dataState: 'ready',
})

const allCardsEmpty = computed(() => props.cards.length > 0 && props.cards.every(item => item.dataState === 'empty'))

const comparisonIcons = {
  down: ArrowDownOutlined,
  flat: MinusOutlined,
  new: PlusOutlined,
  up: ArrowUpOutlined,
}
</script>

<template>
  <a-empty v-if="!loading && (dataState === 'empty' || allCardsEmpty || !cards.length)" class="summary-empty" description="当前筛选范围暂无数据" />
  <a-alert v-else-if="!loading && dataState === 'unavailable'" class="summary-unavailable" type="warning" show-icon message="数据暂不可比较" description="当前数据源未返回可用记录，请稍后重试或检查筛选条件。" />
  <a-row v-else :gutter="[16, 16]" class="summary-cards" :class="{ 'is-compact': compact, 'is-single-column': singleColumn }">
    <a-col v-for="item in cards" :key="item.label" :xs="24" :sm="singleColumn ? 24 : 12" :xl="singleColumn ? 24 : (xlSpan ?? 6)">
      <a-card
        class="summary-card"
        :class="[`tone-${item.tone || 'default'}`, { 'is-compact': compact }]"
        :loading="loading"
        :bordered="true"
        role="group"
        :aria-label="`${item.label}：${item.value}`"
      >
        <div class="summary-main">
          <div class="summary-heading">
            <div class="summary-title">
              {{ item.label }}
            </div>
            <a-tag v-if="item.tag" class="summary-tag" :color="item.tone === 'warning' ? 'orange' : item.tone === 'success' ? 'green' : item.tone === 'danger' ? 'red' : 'blue'">
              {{ item.tag }}
            </a-tag>
          </div>
          <div class="summary-value">
            {{ item.value }}
          </div>
        </div>
        <div class="summary-footer">
          <template v-if="item.comparison && item.dataState !== 'empty' && item.dataState !== 'unavailable'">
            <span class="summary-previous">
              <span class="summary-previous-label">上月</span>
              <strong>{{ item.comparison.previousValue }}</strong>
            </span>
            <span
              class="summary-trend"
              :class="`is-${item.comparison.direction}`"
              :aria-label="`较上月${formatFinancialComparisonChange(item.comparison)}`"
            >
              <component :is="comparisonIcons[item.comparison.direction]" class="summary-trend-icon" aria-hidden="true" />
              <span>{{ formatFinancialComparisonChange(item.comparison) }}</span>
            </span>
          </template>
          <span v-else class="summary-hint" :class="`is-${item.tone || 'default'}`">
            {{ item.hint || '当前财务月' }}
          </span>
        </div>
      </a-card>
    </a-col>
  </a-row>
</template>

<style scoped lang="less">
.summary-cards {
  margin-bottom: 16px;
}

.summary-cards.is-single-column {
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;

  :deep(> .ant-col) {
    width: 214px !important;
    max-width: 214px !important;
    flex: 0 0 214px !important;
  }

  .summary-card {
    height: 118px;

    :deep(.ant-card-body) {
      height: 100%;
      min-height: 0;
      padding: 12px 14px 10px;
    }
  }

  .summary-title {
    font-size: 12px;
  }

  .summary-value {
    margin-top: 5px;
    overflow: hidden;
    font-size: 20px;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
    word-break: keep-all;
  }

  .summary-footer {
    min-height: 18px;
    margin-top: 6px;
  }

  .summary-hint {
    font-size: 12px;
  }
}

.summary-empty {
  margin-bottom: 16px;
  background: var(--admin-surface);
  border: 1px dashed var(--admin-border);
  border-radius: var(--admin-radius);
}

.summary-unavailable {
  margin-bottom: 16px;
}

.summary-card {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: var(--admin-surface);
  border-color: var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  box-shadow: var(--admin-shadow-card);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease;

  &::before {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 3px;
    content: '';
    background: var(--admin-border);
  }

  &.tone-primary::before {
    background: var(--admin-primary);
  }

  &.tone-success::before {
    background: var(--admin-success);
  }

  &.tone-warning::before {
    background: var(--admin-warning);
  }

  &.tone-danger::before {
    background: var(--admin-danger);
  }

  &:hover {
    border-color: var(--admin-border);
    box-shadow: var(--admin-shadow-hover);
  }

  :deep(.ant-card-body) {
    display: flex;
    height: 100%;
    min-height: 124px;
    flex-direction: column;
    justify-content: space-between;
    padding: 18px 20px 16px;
  }
}

.summary-heading {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
}

.summary-card.is-compact {
  :deep(.ant-card-body) {
    min-height: 104px;
    padding: 16px 18px 14px;
  }
}

.summary-title {
  min-width: 0;
  color: var(--admin-text-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.summary-value {
  margin-top: 10px;
  color: var(--admin-text);
  font-size: 26px;
  font-weight: 650;
  line-height: 1.15;
  word-break: break-word;
  font-variant-numeric: tabular-nums;
}

.summary-card.is-compact .summary-value {
  margin-top: 8px;
  font-size: 23px;
}

.summary-footer {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  margin-top: 14px;
}

.summary-card.is-compact .summary-footer {
  margin-top: 10px;
}

.summary-hint {
  min-width: 0;
  overflow: hidden;
  color: var(--admin-muted);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.is-success {
    color: var(--admin-success-text);
  }

  &.is-warning {
    color: var(--admin-warning);
  }

  &.is-danger {
    color: var(--admin-danger);
  }

  &.is-primary {
    color: var(--admin-primary-text);
  }
}

.summary-previous {
  display: inline-flex;
  min-width: 0;
  gap: 5px;
  align-items: baseline;
  color: var(--admin-text-secondary);
  font-size: 12px;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;

  strong {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--admin-text);
    font-size: 13px;
    font-weight: 600;
  }
}

.summary-previous-label {
  flex: 0 0 auto;
  color: var(--admin-muted);
}

.summary-trend {
  display: inline-flex;
  min-height: 24px;
  flex: 0 0 auto;
  gap: 4px;
  align-items: center;
  padding: 2px 8px;
  border: 1px solid var(--admin-border);
  border-radius: 4px;
  color: var(--admin-text-secondary);
  background: var(--admin-surface-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;

  &.is-up {
    border-color: color-mix(in srgb, var(--admin-primary) 28%, transparent);
    color: var(--admin-primary-text);
    background: color-mix(in srgb, var(--admin-primary) 8%, var(--admin-surface));
  }

  &.is-down {
    border-color: color-mix(in srgb, var(--admin-warning) 32%, transparent);
    color: var(--admin-warning-strong);
    background: color-mix(in srgb, var(--admin-warning) 9%, var(--admin-surface));
  }

  &.is-new {
    border-color: color-mix(in srgb, var(--admin-success) 28%, transparent);
    color: var(--admin-success-text);
    background: color-mix(in srgb, var(--admin-success) 8%, var(--admin-surface));
  }
}

.summary-trend-icon {
  flex: 0 0 auto;
  font-size: 11px;
}

.summary-tag {
  flex: 0 0 auto;
  margin-inline-end: 0;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .summary-cards {
    margin-bottom: 12px;
  }

  .summary-card {
    :deep(.ant-card-body) {
      min-height: 104px;
    }
  }

  .summary-value {
    font-size: 23px;
  }

  .summary-footer {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .summary-card {
    transition: none;
  }
}
</style>

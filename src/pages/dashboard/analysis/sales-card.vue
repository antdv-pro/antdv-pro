<script setup lang="ts">
import type { Key } from 'ant-design-vue/es/_util/type'
import { Column } from '@antv/g2plot'
import FinancialPeriodFilter from '~@/components/financial-period-filter/index.vue'
import { useFinancialPeriodFilter } from '~@/composables/financial-period-filter'
import {
  getCurrentFinancialMonthRange,
} from '~@/utils/financialPeriod'

defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})

const rankingListData: { title: string, total: number }[] = []

const currentFinancialMonth = getCurrentFinancialMonthRange()
const {
  model: financialPeriodFilter,
} = useFinancialPeriodFilter({
  financialYear: Number(currentFinancialMonth.key.slice(0, 4)),
  financialMonth: Number(currentFinancialMonth.key.slice(4, 6)),
})

function convertNumber(number: number) {
  return number.toLocaleString()
}

const salesData: any[] = []

const columnPlotContainer1 = ref()
const columnPlotContainer2 = ref()

let renderOnce = false

function changTab(activeKey: Key) {
  if (activeKey === 'views' && !renderOnce) {
    setTimeout(() => {
      new Column(columnPlotContainer2.value, {
        data: salesData,
        xField: 'x',
        yField: 'y',
        height: 300,
        xAxis: {
          label: {
            autoHide: true,
            autoRotate: false,
          },
        },
        meta: {
          y: {
            alias: '销售量',
          },
        },
      }).render()
      renderOnce = true
    })
  }
}

const column = shallowRef<Column>()
onMounted(() => {
  column.value = new Column(columnPlotContainer1.value, {
    data: salesData,
    xField: 'x',
    yField: 'y',
    height: 300,
    xAxis: {
      label: {
        autoHide: true,
        autoRotate: false,
      },
    },
    meta: {
      y: {
        alias: '销售量',
      },
    },
  })
  column.value?.render()
})

onBeforeUnmount(() => {
  column.value?.destroy()
  column.value = undefined
})
</script>

<template>
  <a-card :loading="loading" :bordered="false" :body-style="{ padding: 0 }">
    <div class="salesCard">
      <a-tabs
        size="large"
        :tab-bar-style="{ marginBottom: '24px' }"
        @change="changTab"
      >
        <template #rightExtra>
          <div class="salesExtraWrap">
            <a-form class="salesPeriodForm" :label-col="{ span: 7 }">
              <a-row :gutter="[12, 0]">
                <FinancialPeriodFilter v-model="financialPeriodFilter" />
              </a-row>
            </a-form>
          </div>
        </template>
        <a-tab-pane key="sales" tab="销售额">
          <a-row>
            <a-col :xl="16" :lg="12" :md="12" :sm="24" :xs="24">
              <div class="salesBar">
                <div ref="columnPlotContainer1" />
              </div>
            </a-col>
            <a-col :xl="8" :lg="12" :md="12" :sm="24" :xs="24">
              <div class="salesRank">
                <h4 class="rankingTitle">
                  门店销售额排名
                </h4>
                <ul class="rankingList">
                  <li v-for="(item, index) in rankingListData" :key="index">
                    <span
                      :class="`rankingItemNumber ${index < 3 ? 'active' : ''}`"
                    >
                      {{ index + 1 }}
                    </span>
                    <span class="rankingItemTitle" :title="item.title">
                      {{ item.title }}
                    </span>
                    <span class="rankingItemValue">
                      {{ convertNumber(item.total) }}
                    </span>
                  </li>
                </ul>
              </div>
            </a-col>
          </a-row>
        </a-tab-pane>
        <a-tab-pane key="views" tab="访问量">
          <a-row>
            <a-col :xl="16" :lg="12" :md="12" :sm="24" :xs="24">
              <div class="salesBar">
                <div ref="columnPlotContainer2" />
              </div>
            </a-col>
            <a-col :xl="8" :lg="12" :md="12" :sm="24" :xs="24">
              <div class="salesRank">
                <h4 class="rankingTitle">
                  门店访问量排名
                </h4>
                <ul class="rankingList">
                  <li v-for="(item, index) in rankingListData" :key="index">
                    <span
                      :class="`rankingItemNumber ${index < 3 ? 'active' : ''}`"
                    >
                      {{ index + 1 }}
                    </span>
                    <span class="rankingItemTitle" :title="item.title">
                      {{ item.title }}
                    </span>
                    <span class="rankingItemValue">
                      {{ convertNumber(item.total) }}
                    </span>
                  </li>
                </ul>
              </div>
            </a-col>
          </a-row>
        </a-tab-pane>
      </a-tabs>
    </div>
  </a-card>
</template>

<style scoped lang="less">
.rankingList {
  margin: 25px 0 0;
  padding: 0;
  list-style: none;
  li {
    display: flex;
    align-items: center;
    margin-top: 16px;
    zoom: 1;
    &::before,
    &::after {
      display: table;
      content: ' ';
    }
    &::after {
      clear: both;
      height: 0;
      font-size: 0;
      visibility: hidden;
    }
    span {
      color: var(--text-color);
      font-size: 14px;
      line-height: 22px;
    }
    .rankingItemNumber {
      display: inline-block;
      width: 20px;
      height: 20px;
      margin-top: 1.5px;
      margin-right: 16px;
      font-weight: 600;
      font-size: 12px;
      line-height: 20px;
      text-align: center;
      background-color: #fafafa;
      border-radius: 20px;
      &.active {
        color: #fff;
        background-color: #314659;
      }
    }
    .rankingItemTitle {
      flex: 1;
      margin-right: 8px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }
}

.salesExtra {
  display: inline-block;
  margin-right: 24px;
  a {
    margin-left: 24px;
    color: var(--text-color);
    &:hover {
      color: #1890ff;
    }
    &.currentDate {
      color: #1890ff;
    }
  }
}

.salesCard {
  .salesBar {
    padding: 0 0 32px 32px;
  }
  .salesRank {
    padding: 0 32px 32px 72px;
  }
  :deep(.ant-tabs-nav-wrap) {
    padding-left: 16px;
    .ant-tabs-tab {
      padding-top: 16px;
      padding-bottom: 14px;
      line-height: 24px;
    }
  }
  :deep(.ant-tabs-bar) {
    padding-left: 16px;
    .ant-tabs-tab {
      padding-top: 16px;
      padding-bottom: 14px;
      line-height: 24px;
    }
  }
  :deep(.ant-tabs-extra-content) {
    padding-right: 24px;
    line-height: 55px;
  }
  :deep(.ant-card-head) {
    position: relative;
  }
  :deep(.ant-card-head-title) {
    align-items: normal;
  }
}

.salesCardExtra {
  height: inherit;
}

.salesTypeRadio {
  position: absolute;
  right: 54px;
  bottom: 12px;
}

.offlineCard {
  :deep(.ant-tabs-ink-bar) {
    bottom: auto;
  }
  :deep(.ant-tabs-bar) {
    border-bottom: none;
  }
  :deep(.ant-tabs-nav-container-scrolling) {
    padding-right: 40px;
    padding-left: 40px;
  }
  :deep(.ant-tabs-tab-prev-icon::before) {
    position: relative;
    left: 6px;
  }
  :deep(.ant-tabs-tab-next-icon::before) {
    position: relative;
    right: 6px;
  }
  :deep(.ant-tabs-tab-active h4) {
    color: #1890ff;
  }
}

@media screen and (max-width: 992px) {
  .salesExtra {
    display: none;
  }

  .rankingList {
    li {
      span:first-child {
        margin-right: 8px;
      }
    }
  }
}

@media screen and (max-width: 768px) {
  .rankingTitle {
    margin-top: 16px;
  }

  .salesCard .salesBar {
    padding: 16px;
  }
}

@media screen and (max-width: 576px) {
  .salesExtraWrap {
    display: none;
  }

  .salesCard {
    :deep(.ant-tabs-content) {
      padding-top: 30px;
    }
  }
}
</style>

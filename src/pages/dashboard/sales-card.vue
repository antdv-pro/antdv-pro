<script setup lang="ts">
import { Column } from '@antv/g2plot'
import type { Key } from 'ant-design-vue/es/_util/type'

defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})

const rankingListData: { title: string; total: number }[] = []
for (let i = 0; i < 7; i += 1) {
  rankingListData.push({
    title: `工专路 ${i} 号店`,
    total: 323234,
  })
}

const convertNumber = (number: number) => {
  return number.toLocaleString()
}
const rangePickerValue = ref()

const salesData = [
  {
    x: '1月',
    y: 809,
  },
  {
    x: '2月',
    y: 766,
  },
  {
    x: '3月',
    y: 585,
  },
  {
    x: '4月',
    y: 763,
  },
  {
    x: '5月',
    y: 853,
  },
  {
    x: '6月',
    y: 898,
  },
  {
    x: '7月',
    y: 1096,
  },
  {
    x: '8月',
    y: 452,
  },
  {
    x: '9月',
    y: 244,
  },
  {
    x: '10月',
    y: 838,
  },
  {
    x: '11月',
    y: 673,
  },
  {
    x: '12月',
    y: 431,
  },
]

const columnPlotContainer1 = ref()
const columnPlotContainer2 = ref()

let renderOnce = false

const changTab = (activeKey: Key) => {
  if (activeKey === 'views' && !renderOnce) {
    setTimeout(() => {
      new Column(columnPlotContainer2.value, {
        data: salesData,
        xField: 'x',
        yField: 'y',
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

onMounted(() => {
  new Column(columnPlotContainer1.value, {
    data: salesData,
    xField: 'x',
    yField: 'y',
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
            <div class="salesExtra">
              <a>今日</a>
              <a>本周</a>
              <a>本月</a>
              <a>本年</a>
            </div>
            <a-range-picker
              :value="rangePickerValue"
              :style="{ width: '256px' }"
            />
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
                    <span :class="`rankingItemNumber ${index < 3 ? 'active' : ''}`">
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
                    <span :class="`rankingItemNumber ${index < 3 ? 'active' : ''}`">
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
      //background-color: @tag-default-bg;
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
      //color: @primary-color;
    }
    &.currentDate {
      //color: @primary-color;
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
  //:global {
  //  .ant-tabs-bar,
  //  .ant-tabs-nav-wrap {
  //    padding-left: 16px;
  //    .ant-tabs-nav .ant-tabs-tab {
  //      padding-top: 16px;
  //      padding-bottom: 14px;
  //      line-height: 24px;
  //    }
  //  }
  //  .ant-tabs-extra-content {
  //    padding-right: 24px;
  //    line-height: 55px;
  //  }
  //  .ant-card-head {
  //    position: relative;
  //  }
  //  .ant-card-head-title {
  //    align-items: normal;
  //  }
  //}
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
  //:global {
  //  .ant-tabs-ink-bar {
  //    bottom: auto;
  //  }
  //  .ant-tabs-bar {
  //    border-bottom: none;
  //  }
  //  .ant-tabs-nav-container-scrolling {
  //    padding-right: 40px;
  //    padding-left: 40px;
  //  }
  //  .ant-tabs-tab-prev-icon::before {
  //    position: relative;
  //    left: 6px;
  //  }
  //  .ant-tabs-tab-next-icon::before {
  //    position: relative;
  //    right: 6px;
  //  }
  //  .ant-tabs-tab-active h4 {
  //    //color: @primary-color;
  //  }
  //}
 }

 .trendText {
  margin-left: 8px;
  //color: @heading-color;
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

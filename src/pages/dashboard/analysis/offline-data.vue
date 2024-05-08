<script setup>
import NumberInfo from '~/pages/dashboard/analysis/number-info.vue'
import CustomRingProgress from '~/pages/dashboard/analysis/components/custom-ring-progress.vue'
import CustomLine from '~/pages/dashboard/analysis/components/custom-line.vue'

defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})
const activeKey = ref()
function handleTabChange() {
}
const offlineData = [
  {
    name: 'Stores 0',
    cvr: 0.9,
  },
  {
    name: 'Stores 1',
    cvr: 0.9,
  },
  {
    name: 'Stores 2',
    cvr: 0.2,
  },
  {
    name: 'Stores 3',
    cvr: 0.1,
  },
  {
    name: 'Stores 4',
    cvr: 0.1,
  },
  {
    name: 'Stores 5',
    cvr: 0.2,
  },
  {
    name: 'Stores 6',
    cvr: 0.3,
  },
  {
    name: 'Stores 7',
    cvr: 0.7,
  },
  {
    name: 'Stores 8',
    cvr: 0.9,
  },
  {
    name: 'Stores 9',
    cvr: 0.6,
  },
]
const offlineChartData = [
  {
    date: '03:26',
    type: '客流量',
    value: 36,
  },
  {
    date: '03:26',
    type: '支付笔数',
    value: 53,
  },
  {
    date: '03:56',
    type: '客流量',
    value: 98,
  },
  {
    date: '03:56',
    type: '支付笔数',
    value: 31,
  },
  {
    date: '04:26',
    type: '客流量',
    value: 62,
  },
  {
    date: '04:26',
    type: '支付笔数',
    value: 109,
  },
  {
    date: '04:56',
    type: '客流量',
    value: 76,
  },
  {
    date: '04:56',
    type: '支付笔数',
    value: 11,
  },
  {
    date: '05:26',
    type: '客流量',
    value: 39,
  },
  {
    date: '05:26',
    type: '支付笔数',
    value: 56,
  },
  {
    date: '05:56',
    type: '客流量',
    value: 52,
  },
  {
    date: '05:56',
    type: '支付笔数',
    value: 98,
  },
  {
    date: '06:26',
    type: '客流量',
    value: 29,
  },
  {
    date: '06:26',
    type: '支付笔数',
    value: 101,
  },
  {
    date: '06:56',
    type: '客流量',
    value: 10,
  },
  {
    date: '06:56',
    type: '支付笔数',
    value: 13,
  },
  {
    date: '07:26',
    type: '客流量',
    value: 29,
  },
  {
    date: '07:26',
    type: '支付笔数',
    value: 62,
  },
  {
    date: '07:56',
    type: '客流量',
    value: 70,
  },
  {
    date: '07:56',
    type: '支付笔数',
    value: 20,
  },
  {
    date: '08:26',
    type: '客流量',
    value: 21,
  },
  {
    date: '08:26',
    type: '支付笔数',
    value: 41,
  },
  {
    date: '08:56',
    type: '客流量',
    value: 86,
  },
  {
    date: '08:56',
    type: '支付笔数',
    value: 104,
  },
  {
    date: '09:26',
    type: '客流量',
    value: 91,
  },
  {
    date: '09:26',
    type: '支付笔数',
    value: 76,
  },
  {
    date: '09:56',
    type: '客流量',
    value: 31,
  },
  {
    date: '09:56',
    type: '支付笔数',
    value: 72,
  },
  {
    date: '10:26',
    type: '客流量',
    value: 14,
  },
  {
    date: '10:26',
    type: '支付笔数',
    value: 37,
  },
  {
    date: '10:56',
    type: '客流量',
    value: 45,
  },
  {
    date: '10:56',
    type: '支付笔数',
    value: 106,
  },
  {
    date: '11:26',
    type: '客流量',
    value: 31,
  },
  {
    date: '11:26',
    type: '支付笔数',
    value: 69,
  },
  {
    date: '11:56',
    type: '客流量',
    value: 99,
  },
  {
    date: '11:56',
    type: '支付笔数',
    value: 103,
  },
  {
    date: '12:26',
    type: '客流量',
    value: 49,
  },
  {
    date: '12:26',
    type: '支付笔数',
    value: 33,
  },
  {
    date: '12:56',
    type: '客流量',
    value: 86,
  },
  {
    date: '12:56',
    type: '支付笔数',
    value: 23,
  },
]
</script>

<template>
  <a-card :loading="loading" class="offlineCard" :bordered="false" :style="{ marginTop: '32px' }">
    <a-tabs v-model:active-key="activeKey" @change="handleTabChange">
      <a-tab-pane v-for="(item, index) in offlineData" :key="index">
        <template #tab>
          <a-row :gutter="8" :style="{ width: '138px', margin: '8px 0' }">
            <a-col :span="12">
              <NumberInfo
                :title="item.name"
                :gap="2"
                :total="`${item.cvr * 100}%`"
              >
                <template #subTitle>
                  {{ '转化率' }}
                </template>
              </NumberInfo>
            </a-col>
            <a-col :span="12" :style="{ paddingTop: '36px' }">
              <CustomRingProgress :percent="item.cvr" />
            </a-col>
          </a-row>
        </template>
        <div :style="{ padding: '0 24px' }">
          <CustomLine :offline-chart-data="offlineChartData" />
        </div>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<style scoped lang="less">
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
      //color: @primary-color;
    }

}
</style>

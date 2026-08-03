<script setup lang="ts">
import CustomLine from '~/pages/dashboard/analysis/components/custom-line.vue'
import CustomRingProgress from '~/pages/dashboard/analysis/components/custom-ring-progress.vue'
import NumberInfo from '~/pages/dashboard/analysis/number-info.vue'

defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})

const activeKey = ref()
function handleTabChange() {

}

const offlineData: any[] = []
const offlineChartData: any[] = []
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

<script setup>
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import { Progress, TinyArea, TinyColumn } from '@antv/g2plot'
import ChartCard from '~/pages/dashboard/analysis/components/chart-card.vue'
import Field from '~/pages/dashboard/analysis/components/field.vue'
import Trend from '~/pages/dashboard/analysis/trend.vue'

defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})
function convertNumber(number) {
  return number.toLocaleString()
}
const topColResponsiveProps = {
  xs: 24,
  sm: 12,
  md: 12,
  lg: 12,
  xl: 6,
  style: { marginBottom: '24px' },
}
const tinyAreaContainer = ref()
const tinyColumnContainer = ref()
const progressContainer = ref()
const visitData = [7, 5, 4, 2, 4, 7, 5, 6, 5, 9, 6, 3, 1, 5, 3, 6, 5]
const tinyArea = shallowRef()
const tinyColumn = shallowRef()
const progress = shallowRef()
onMounted(() => {
  tinyArea.value = new TinyArea(tinyAreaContainer.value, {
    height: 46,
    data: visitData,
    smooth: true,
    autoFit: true,
    areaStyle: {
      fill: 'l(270) 0:#ffffff 0.5:#d4bcf2 1:#975FE4',
    },
    line: {
      color: '#975FE4',
    },
  })
  tinyArea.value?.render()
  tinyColumn.value = new TinyColumn(tinyColumnContainer.value, {
    height: 46,
    autoFit: true,
    data: visitData,
  })
  tinyColumn.value?.render()
  progress.value = new Progress(progressContainer.value, {
    height: 46,
    autoFit: true,
    percent: 0.78,
    barWidthRatio: 0.2,
    color: '#13C2C2',
  })
  progress.value?.render()
})
onBeforeUnmount(() => {
  tinyArea.value?.destroy()
  tinyArea.value = void 0
  tinyColumn.value?.destroy()
  tinyColumn.value = void 0
  progress.value?.destroy()
  progress.value = void 0
})
</script>

<template>
  <a-row :gutter="24">
    <a-col v-bind="{ ...topColResponsiveProps }">
      <ChartCard :bordered="false" title="总销售额" :loading="loading" :content-height="46">
        <template #action>
          <a-tooltip title="指标说明">
            <InfoCircleOutlined />
          </a-tooltip>
        </template>
        <template #total>
          <span>{{ `¥${convertNumber(126560)}` }}</span>
        </template>
        <template #footer>
          <Field label="日销售额" value="￥12,423" />
        </template>
        <Trend flag="up" :style="{ marginRight: '16px' } ">
          周同比
          <span class="trendText">12%</span>
        </Trend>
        <Trend flag="down">
          日同比
          <span class="trendText">11%</span>
        </Trend>
      </ChartCard>
    </a-col>

    <a-col v-bind="{ ...topColResponsiveProps }">
      <ChartCard :bordered="false" title="访问量" :loading="loading" :content-height="46">
        <template #action>
          <a-tooltip title="指标说明">
            <InfoCircleOutlined />
          </a-tooltip>
        </template>
        <template #total>
          <span>{{ `${convertNumber(8846)}` }}</span>
        </template>
        <template #footer>
          <Field label="日访问量" :value="convertNumber(1234)" />
        </template>
        <div ref="tinyAreaContainer" />
      </ChartCard>
    </a-col>

    <a-col v-bind="{ ...topColResponsiveProps }">
      <ChartCard :bordered="false" title="支付笔数" :loading="loading" :content-height="46">
        <template #action>
          <a-tooltip title="指标说明">
            <InfoCircleOutlined />
          </a-tooltip>
        </template>
        <template #total>
          <span>{{ `${convertNumber(6560)}` }}</span>
        </template>
        <template #footer>
          <Field label="转化率" value="60%" />
        </template>
        <div ref="tinyColumnContainer" />
      </ChartCard>
    </a-col>

    <a-col v-bind="{ ...topColResponsiveProps }">
      <ChartCard :bordered="false" title="运营活动效果" :loading="loading" :content-height="46">
        <template #action>
          <a-tooltip title="指标说明">
            <InfoCircleOutlined />
          </a-tooltip>
        </template>
        <template #total>
          <span>{{ '78%' }}</span>
        </template>
        <template #footer>
          <div :style="{ whiteSpace: 'nowrap', overflow: 'hidden' }">
            <Trend flag="up" :style="{ marginRight: '16px' } ">
              周同比
              <span class="trendText">12%</span>
            </Trend>
            <Trend flag="down">
              日同比
              <span class="trendText">11%</span>
            </Trend>
          </div>
        </template>
        <div ref="progressContainer" />
      </ChartCard>
    </a-col>
  </a-row>
</template>

<style scoped lang="less">

</style>

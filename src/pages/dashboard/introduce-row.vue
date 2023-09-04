<script setup lang="ts">
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import ChartCard from '~/pages/dashboard/components/chart-card.vue'
const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})

const convertNumber = (number: number) => {
  return number.toLocaleString()
}

const topColResponsiveProps = {
  xs: 24,
  sm: 12,
  md: 12,
  lg: 12,
  xl: 6,
  style: { marginBottom: 24 },
}
</script>

<template>
  <a-row :gutter="24">
    <a-col :bind="topColResponsiveProps">
      <ChartCard :bordered="false" title="总销售额" :loading="loading">
        <template #action>
          <a-tooltip title="指标说明">
            <InfoCircleOutlined />
          </a-tooltip>
        </template>
        <template #total>
          <span>{{ convertNumber(126560) }}</span>
        </template>
        <template #footer>
          <Field label="日销售额" value="12,423" />
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
  </a-row>
</template>

<style scoped lang="less">

</style>

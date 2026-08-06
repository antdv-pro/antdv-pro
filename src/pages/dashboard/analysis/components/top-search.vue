<script setup lang="ts">
import { EllipsisOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import { TinyArea } from '@antv/g2plot'
import NumberInfo from '~/pages/dashboard/analysis/number-info.vue'
import Trend from '~/pages/dashboard/analysis/trend.vue'

defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})

const columns: Record<string, any>[] = [
  {
    title: '排名',
    dataIndex: 'index',
    key: 'index',
  },
  {
    title: '搜索关键词',
    dataIndex: 'keyword',
    key: 'keyword',
  },
  {
    title: '用户数',
    dataIndex: 'count',
    key: 'count',
    sorter: (a: { count: number }, b: { count: number }) => a.count - b.count,
  },
  {
    title: '周涨幅',
    dataIndex: 'range',
    key: 'range',
    sorter: (a: { range: number }, b: { range: number }) => a.range - b.range,
  },
]

const searchData: any[] = []

const visitData2: any[] = []

const tinyAreaContainer1 = ref()
const tinyAreaContainer2 = ref()

onMounted(() => {
  new TinyArea(tinyAreaContainer1.value, {
    height: 45,
    data: visitData2,
    smooth: true,
    autoFit: true,
  }).render()

  new TinyArea(tinyAreaContainer2.value, {
    height: 45,
    data: visitData2,
    smooth: true,
    autoFit: true,
  }).render()
})
</script>

<template>
  <a-card
    :loading="loading"
    :bordered="false"
    title="线上热门搜索"
    :style="{ height: '100%' }"
  >
    <template #extra>
      <span class="iconGroup">
        <a-dropdown placement="bottomRight">
          <template #overlay>
            <a-menu>
              <a-menu-item>操作一</a-menu-item>
              <a-menu-item>操作二</a-menu-item>
            </a-menu>
          </template>
          <EllipsisOutlined />
        </a-dropdown>
      </span>
    </template>
    <a-row :gutter="68">
      <a-col :sm="12" :xs="24" :style="{ marginBottom: '24px' }">
        <NumberInfo
          :gap="8"
          :total="12321"
          status="up"
          :sub-total="17.1"
        >
          <template #subTitle>
            <span>
              人均搜索次数
              <Tooltip title="指标说明">
                <InfoCircleOutlined :style="{ marginLeft: '8px' }" />
              </Tooltip>
            </span>
          </template>
        </NumberInfo>
        <div ref="tinyAreaContainer1" />
      </a-col>
      <a-col :sm="12" :xs="24" :style="{ marginBottom: '24px' }">
        <NumberInfo
          :gap="8"
          :total="2.7"
          status="down"
          :sub-total="26.2"
        >
          <template #subTitle>
            <span>
              搜索用户数
              <Tooltip title="指标说明">
                <InfoCircleOutlined :style="{ marginLeft: '8px' }" />
              </Tooltip>
            </span>
          </template>
        </NumberInfo>
        <div ref="tinyAreaContainer2" />
      </a-col>
    </a-row>
    <a-table
      :row-key="(record:any) => record.index"
      size="small"
      :columns="columns"
      :data-source="searchData"
      :pagination="{
        style: { marginBottom: 0 },
        pageSize: 5,
      }"
    >
      <template #bodyCell="scope">
        <template v-if="scope?.column?.key === 'keyword'">
          <a>
            {{ scope?.record?.keyword }}
          </a>
        </template>
        <template v-else-if="scope?.column?.key === 'range'">
          <Trend :flag="scope?.record?.status === 1 ? 'down' : 'up'">
            <span :style="{ marginRight: '4px' }">{{ scope?.record?.range }}%</span>
          </Trend>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<style scoped lang="less">
.iconGroup {
  span.anticon {
    margin-left: 16px;
    color: inherit;
    cursor: pointer;
    transition: color 0.32s;
    &:hover {
      color: var(--text-color);
    }
  }
}
</style>

<script setup>
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
const columns = [
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
    sorter: (a, b) => a.count - b.count,
  },
  {
    title: '周涨幅',
    dataIndex: 'range',
    key: 'range',
    sorter: (a, b) => {
      return a.range - b.range
    },
  },
]
const searchData = [
  {
    index: 1,
    keyword: '搜索关键词-0',
    count: 286,
    range: 10,
    status: 1,
  },
  {
    index: 2,
    keyword: '搜索关键词-1',
    count: 659,
    range: 9,
    status: 1,
  },
  {
    index: 3,
    keyword: '搜索关键词-2',
    count: 579,
    range: 5,
    status: 0,
  },
  {
    index: 4,
    keyword: '搜索关键词-3',
    count: 369,
    range: 51,
    status: 0,
  },
  {
    index: 5,
    keyword: '搜索关键词-4',
    count: 658,
    range: 11,
    status: 1,
  },
  {
    index: 6,
    keyword: '搜索关键词-5',
    count: 956,
    range: 52,
    status: 0,
  },
  {
    index: 7,
    keyword: '搜索关键词-6',
    count: 607,
    range: 23,
    status: 0,
  },
  {
    index: 8,
    keyword: '搜索关键词-7',
    count: 19,
    range: 22,
    status: 1,
  },
  {
    index: 9,
    keyword: '搜索关键词-8',
    count: 309,
    range: 77,
    status: 1,
  },
  {
    index: 10,
    keyword: '搜索关键词-9',
    count: 382,
    range: 99,
    status: 0,
  },
  {
    index: 11,
    keyword: '搜索关键词-10',
    count: 526,
    range: 58,
    status: 0,
  },
  {
    index: 12,
    keyword: '搜索关键词-11',
    count: 824,
    range: 18,
    status: 0,
  },
  {
    index: 13,
    keyword: '搜索关键词-12',
    count: 140,
    range: 10,
    status: 1,
  },
  {
    index: 14,
    keyword: '搜索关键词-13',
    count: 781,
    range: 82,
    status: 1,
  },
  {
    index: 15,
    keyword: '搜索关键词-14',
    count: 231,
    range: 16,
    status: 1,
  },
  {
    index: 16,
    keyword: '搜索关键词-15',
    count: 672,
    range: 9,
    status: 1,
  },
  {
    index: 17,
    keyword: '搜索关键词-16',
    count: 305,
    range: 52,
    status: 0,
  },
  {
    index: 18,
    keyword: '搜索关键词-17',
    count: 32,
    range: 37,
    status: 1,
  },
  {
    index: 19,
    keyword: '搜索关键词-18',
    count: 596,
    range: 73,
    status: 0,
  },
  {
    index: 20,
    keyword: '搜索关键词-19',
    count: 346,
    range: 82,
    status: 0,
  },
  {
    index: 21,
    keyword: '搜索关键词-20',
    count: 622,
    range: 12,
    status: 1,
  },
  {
    index: 22,
    keyword: '搜索关键词-21',
    count: 845,
    range: 12,
    status: 0,
  },
  {
    index: 23,
    keyword: '搜索关键词-22',
    count: 187,
    range: 37,
    status: 1,
  },
  {
    index: 24,
    keyword: '搜索关键词-23',
    count: 822,
    range: 30,
    status: 1,
  },
  {
    index: 25,
    keyword: '搜索关键词-24',
    count: 733,
    range: 77,
    status: 0,
  },
  {
    index: 26,
    keyword: '搜索关键词-25',
    count: 356,
    range: 91,
    status: 0,
  },
  {
    index: 27,
    keyword: '搜索关键词-26',
    count: 771,
    range: 17,
    status: 1,
  },
  {
    index: 28,
    keyword: '搜索关键词-27',
    count: 50,
    range: 41,
    status: 1,
  },
  {
    index: 29,
    keyword: '搜索关键词-28',
    count: 224,
    range: 1,
    status: 0,
  },
  {
    index: 30,
    keyword: '搜索关键词-29',
    count: 218,
    range: 81,
    status: 1,
  },
  {
    index: 31,
    keyword: '搜索关键词-30',
    count: 696,
    range: 34,
    status: 0,
  },
  {
    index: 32,
    keyword: '搜索关键词-31',
    count: 379,
    range: 56,
    status: 1,
  },
  {
    index: 33,
    keyword: '搜索关键词-32',
    count: 750,
    range: 44,
    status: 1,
  },
  {
    index: 34,
    keyword: '搜索关键词-33',
    count: 905,
    range: 66,
    status: 1,
  },
  {
    index: 35,
    keyword: '搜索关键词-34',
    count: 806,
    range: 41,
    status: 0,
  },
  {
    index: 36,
    keyword: '搜索关键词-35',
    count: 854,
    range: 92,
    status: 1,
  },
  {
    index: 37,
    keyword: '搜索关键词-36',
    count: 887,
    range: 18,
    status: 1,
  },
  {
    index: 38,
    keyword: '搜索关键词-37',
    count: 755,
    range: 24,
    status: 0,
  },
  {
    index: 39,
    keyword: '搜索关键词-38',
    count: 267,
    range: 41,
    status: 1,
  },
  {
    index: 40,
    keyword: '搜索关键词-39',
    count: 34,
    range: 38,
    status: 0,
  },
  {
    index: 41,
    keyword: '搜索关键词-40',
    count: 942,
    range: 16,
    status: 0,
  },
  {
    index: 42,
    keyword: '搜索关键词-41',
    count: 844,
    range: 56,
    status: 0,
  },
  {
    index: 43,
    keyword: '搜索关键词-42',
    count: 559,
    range: 28,
    status: 1,
  },
  {
    index: 44,
    keyword: '搜索关键词-43',
    count: 29,
    range: 97,
    status: 1,
  },
  {
    index: 45,
    keyword: '搜索关键词-44',
    count: 989,
    range: 43,
    status: 0,
  },
  {
    index: 46,
    keyword: '搜索关键词-45',
    count: 377,
    range: 24,
    status: 1,
  },
  {
    index: 47,
    keyword: '搜索关键词-46',
    count: 990,
    range: 47,
    status: 1,
  },
  {
    index: 48,
    keyword: '搜索关键词-47',
    count: 848,
    range: 64,
    status: 1,
  },
  {
    index: 49,
    keyword: '搜索关键词-48',
    count: 549,
    range: 68,
    status: 1,
  },
  {
    index: 50,
    keyword: '搜索关键词-49',
    count: 53,
    range: 47,
    status: 1,
  },
]
const visitData2 = [1, 6, 4, 8, 3, 7, 2]
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
      :row-key="(record) => record.index"
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

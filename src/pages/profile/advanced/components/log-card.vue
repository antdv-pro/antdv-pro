<script setup lang="ts">
import dayjs from 'dayjs'

const { t } = useI18n()

const activeKey = ref()

const columns = ref([
  {
    title: t('profile.advanced.log-type'),
    dataIndex: 'type',
    key: 'type',
    slots: { customRender: 'type' },
  },
  {
    title: t('profile.advanced.log-owner'),
    dataIndex: 'owner',
    key: 'owner',
    width: 100,
  },
  {
    title: t('profile.advanced.log-result'),
    dataIndex: 'result',
    key: 'result',
  },
  {
    title: t('profile.advanced.log-time'),
    dataIndex: 'time',
    key: 'time',
  },
  {
    title: t('profile.advanced.log-info'),
    dataIndex: 'info',
    key: 'info',
  },
])

const data = [
  {
    key: '1',
    type: '创建订单',
    owner: '烟雨',
    result: '成功',
    time: dayjs().format('YYYY-MM-DD hh:mm'),
    info: '无',
  },
  {
    key: '2',
    type: '创建订单',
    owner: '烟雨',
    result: '成功',
    time: dayjs().format('YYYY-MM-DD hh:mm'),
    info: '无',
  },
  {
    key: '3',
    type: '创建订单',
    owner: '烟雨',
    result: '成功',
    time: dayjs().format('YYYY-MM-DD hh:mm'),
    info: '无',
  },
]

function getI18n(key: any) {
  if (key === 'type')
    return t('profile.advanced.log-type')
  else if (key === 'owner')
    return t('profile.advanced.log-owner')
  else if (key === 'result')
    return t('profile.advanced.log-result')
  else if (key === 'time')
    return t('profile.advanced.log-time')
  else if (key === 'info')
    return t('profile.advanced.log-info')
}
const tabItems = computed(() => ([
  { key: '1', label: t('profile.advanced.log') },
  { key: '2', label: t('profile.advanced.log1') },
  { key: '3', label: t('profile.advanced.log2') },
]))
</script>

<template>
  <a-card class="my-6">
    <a-tabs v-model:active-key="activeKey" :items="tabItems">
      <template #contentRender="{ item }">
        <a-table v-if="item.key === '1'" :data-source="data" :columns="columns">
          <template #headerCell="scope">
            {{ getI18n(scope?.column?.key) }}
          </template>
        </a-table>
        <a-table v-else :data-source="data" :columns="columns" />
      </template>
    </a-tabs>
  </a-card>
</template>

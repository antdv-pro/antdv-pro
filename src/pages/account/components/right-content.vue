<script setup lang="ts">
import { ref } from 'vue'
import applicationTab from './application-tab.vue'
import articleTab from './article-tab.vue'
import proTab from './pro-tab.vue'

const { t } = useI18n()

const activeKey = ref()

interface IDataItem {
  title: string
  tags: string[]
  content: string
}

const data = ref<IDataItem[]>([
  {
    title: 'Antdv Pro',
    tags: ['Ant Design Vue', '中后台', '自动化'],
    content: 'AntdvPro是一个基于Vue3、Vite4、antdv-next、Pinia、UnoCSS和Typescript的一整套企业级中后台前端/设计解决方案，它参考了阿里react版本antd-pro的设计模式，使用了最新最流行的前端技术栈，内置了动态路由、多主题、多布局等功能，可以帮助你快速搭建企业级中后台产品原型。',
  },
])

const dataSource = computed(() => {
  const arr = []
  for (let i = 0; i < 10; i++)
    arr.push(...data.value)

  return arr
})
const tabItems = computed(() => ([
  { key: '1', label: t('account.center.article') },
  { key: '2', label: t('account.center.application') },
  { key: '3', label: t('account.center.project') },
]))
</script>

<template>
  <a-card variant="borderless">
    <a-tabs v-model:active-key="activeKey" :items="tabItems">
      <template #contentRender="{ item }">
        <article-tab v-if="item.key === '1'" :data-source="dataSource" />
        <application-tab v-else-if="item.key === '2'" />
        <pro-tab v-else-if="item.key === '3'" />
      </template>
    </a-tabs>
  </a-card>
</template>

<style scoped lang="less">
:deep(.ant-list-item) {
  flex-direction: column !important;
  align-items: normal !important;
}
:deep(.ant-btn) {
  padding-left: 0;
}
</style>

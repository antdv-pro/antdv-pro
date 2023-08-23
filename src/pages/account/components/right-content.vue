<script setup lang="ts">
import { ref } from 'vue'
import articleTab from './article-tab.vue'
import applicationTab from './application-tab.vue'
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
    content: 'AntdvPro是一个基于Vue3、Vite4、ant-design-vue4、Pinia、UnoCSS和Typescript的一整套企业级中后台前端/设计解决方案，它参考了阿里react版本antd-pro的设计模式，使用了最新最流行的前端技术栈，内置了动态路由、多主题、多布局等功能，可以帮助你快速搭建企业级中后台产品原型。',
  },
])

const dataSource = computed(() => {
  const arr = []
  for (let i = 0; i < 10; i++)
    arr.push(...data.value)

  return arr
})
</script>

<template>
  <a-card :borderer="false">
    <a-tabs v-model:activeKey="activeKey">
      <a-tab-pane key="1" :tab="t('account.center.article')">
        <article-tab :data-source="dataSource" />
      </a-tab-pane>
      <a-tab-pane key="2" :tab="t('account.center.application')" force-render>
        <application-tab />
      </a-tab-pane>
      <a-tab-pane key="3" :tab="t('account.center.project')">
        <pro-tab />
      </a-tab-pane>
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

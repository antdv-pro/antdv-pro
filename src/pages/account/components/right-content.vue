<script setup lang="ts">
import applicationTab from './application-tab.vue'
import articleTab from './article-tab.vue'
import proTab from './pro-tab.vue'

const { t } = useI18n()

const activeKey = ref()

const dataSource = computed(() => [])
</script>

<template>
  <a-card :borderer="false">
    <a-tabs v-model:active-key="activeKey">
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

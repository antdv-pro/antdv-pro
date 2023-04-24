<script setup lang="ts">
import Header from '../components/header/index.vue'
withDefaults(defineProps<{
  layout?: 'mix' | 'side' | 'top'
  collapsedWidth?: number
  siderWidth?: number
  collapsed?: boolean
}>(), {
  layout: 'mix',
  collapsedWidth: 60,
  siderWidth: 200,
  collapsed: true,
})
</script>

<template>
  <div class="ant-pro-basicLayout">
    <a-layout>
      <Header />
      <a-layout>
        <a-layout-sider
          theme="light"
          :collapsed="collapsed"
          :trigger="null"
          :collapsed-width="collapsedWidth"
          :width="siderWidth"
          collapsible
        >
          测试
        </a-layout-sider>
        <a-layout-content>
          <router-view />
        </a-layout-content>
      </a-layout>
    </a-layout>
  </div>
</template>

<style lang="less">
@import './index.less';
</style>

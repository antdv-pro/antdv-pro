<script setup lang="ts">
import type { CSSProperties } from 'vue'
import Header from '../components/header/index.vue'
import SiderMenu from '../components/sider-menu/index.vue'
const props = withDefaults(defineProps<{
  layout?: 'mix' | 'side' | 'top'
  collapsedWidth?: number
  siderWidth?: number
  collapsed?: boolean
  headerHeight?: number
}>(), {
  layout: 'mix',
  collapsedWidth: 64,
  siderWidth: 200,
  collapsed: false,
  headerHeight: 48,
})
const siderStyle = computed<CSSProperties>(() => {
  return {
    paddingTop: `${props.headerHeight}px`,
  }
})
</script>

<template>
  <div class="ant-pro-basicLayout">
    <a-layout>
      <a-layout-sider
        theme="light"
        :collapsed="collapsed"
        :trigger="null"
        :collapsed-width="collapsedWidth"
        :width="siderWidth"
        collapsible
        class="ant-pro-sider"
        :style="siderStyle"
      >
        <SiderMenu />
      </a-layout-sider>
      <a-layout>
        <Header :header-height="headerHeight" />
        <a-layout-content>
          <slot />
        </a-layout-content>
      </a-layout>
    </a-layout>
  </div>
</template>

<style lang="less">
@import './index.less';
</style>

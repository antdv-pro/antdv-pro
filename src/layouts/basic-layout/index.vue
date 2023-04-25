<script setup lang="ts">
import type { CSSProperties } from 'vue'
import Header from '../components/header/index.vue'
import SiderMenu from '../components/sider-menu/index.vue'
import type { MenuData } from './typing'
const props = withDefaults(defineProps<{
  layout?: 'mix' | 'side' | 'top'
  collapsedWidth?: number
  siderWidth?: number
  collapsed?: boolean
  headerHeight?: number
  menuData?: MenuData
  fixedHeader?: boolean
  onCollapsed?: (collapsed: boolean) => void
  theme?: 'light' | 'dark'
}>(), {
  layout: 'mix',
  collapsedWidth: 48,
  siderWidth: 200,
  collapsed: false,
  headerHeight: 48,
  theme: 'light',
})

const emit = defineEmits(['update:collapsed'])
/**
 * 处理展开收起的事件参数
 * @param collapsed 展开收起的事件参数
 */
const handleCollapsed = (collapsed: boolean) => {
  emit('update:collapsed', collapsed)
  props?.onCollapsed?.(collapsed)
}

const siderStyle = computed<CSSProperties>(() => {
  return {
    paddingTop: `${props.headerHeight}px`,
  }
})
</script>

<template>
  <div class="ant-pro-basicLayout" :data-theme="theme">
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
        <SiderMenu :collapsed="collapsed" @collapsed="handleCollapsed" />
      </a-layout-sider>
      <a-layout>
        <Header
          :header-height="headerHeight"
          :fixed-header="fixedHeader"
          :layout="layout"
        />
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

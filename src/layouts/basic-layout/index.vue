<script setup lang="ts">
import type { CSSProperties } from 'vue'
import Header from '../components/header/index.vue'
import SiderMenu from '../components/sider-menu/index.vue'
import { proLayoutProps } from './typing'
import { useLayoutProvider } from './context'
const props = defineProps(proLayoutProps)
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

// 依赖注入所有的配置项，对属性进行控制，减少传值
useLayoutProvider(props, {
  handleCollapsed,
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
        <SiderMenu />
      </a-layout-sider>
      <a-layout>
        <Header />
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

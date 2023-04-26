<script setup lang="ts">
import Header from '../components/header/index.vue'
import SiderMenu from '../components/sider-menu/index.vue'
import DrawerMenu from '../components/drawer-menu/index.vue'
import Menu from '../components/menu/index.vue'
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

// 依赖注入所有的配置项，对属性进行控制，减少传值
useLayoutProvider(props, {
  handleCollapsed,
})
</script>

<template>
  <div class="ant-pro-basicLayout" :data-theme="theme">
    <a-layout>
      <SiderMenu v-if="layout !== 'top'" />
      <a-layout>
        <Header>
          <template v-if="$slots.headerActions" #headerActions>
            <slot name="headerActions" />
          </template>
          <template v-if="$slots.headerContent || layout === 'top'" #headerContent>
            <slot name="headerContent">
              <Menu v-if="!isMobile" />
            </slot>
          </template>
        </Header>
        <a-layout-content>
          <slot />
        </a-layout-content>
      </a-layout>
    </a-layout>
    <DrawerMenu />
  </div>
</template>

<style lang="less">
@import './index.less';
</style>

<script setup>
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons-vue'
import { useLayoutState } from '../../basic-layout/context.js'
import GlobalHeaderLogo from './global-header-logo.vue'

const { layout, isMobile, handleMobileCollapsed, theme, menuHeader, collapsed, handleCollapsed, leftCollapsed } = useLayoutState()
const prefixCls = shallowRef('ant-pro-global-header')
const cls = computed(() => ({
  [prefixCls.value]: true,
  [`${prefixCls.value}-layout-${layout.value}`]: !!layout.value,
  [`${prefixCls.value}-inverted`]: theme.value === 'inverted' && layout.value === 'top',
}))
</script>

<template>
  <div :class="[cls]">
    <span
      v-if="layout === 'side' && !isMobile && !leftCollapsed"
      class="ml-0 text-18px"
      @click="handleCollapsed?.(!collapsed)"
    >
      <MenuUnfoldOutlined v-if="collapsed" />
      <MenuFoldOutlined v-else />
    </span>
    <template v-if="menuHeader">
      <GlobalHeaderLogo v-if="layout !== 'side' || isMobile" />
    </template>
    <span v-if="isMobile" class="ant-pro-global-header-collapsed-button" @click="handleMobileCollapsed">
      <MenuFoldOutlined />
    </span>
    <div class="flex-1" :class="layout === 'top' ? `${prefixCls}-top` : 'overflow-x-auto'">
      <slot name="headerContent" />
    </div>
    <a-space align="center" flex-shrink-0>
      <slot name="headerActions" />
    </a-space>
  </div>
</template>

<style lang="less">
@import './index.less';
</style>

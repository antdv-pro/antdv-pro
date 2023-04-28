<script setup lang="ts">
import { MenuFoldOutlined } from '@ant-design/icons-vue'
import { useLayoutState } from '../../basic-layout/context'
import GlobalHeaderLogo from './global-header-logo.vue'
const { layout, isMobile, handleMobileCollapsed, theme, menuHeader } = useLayoutState()
const prefixCls = shallowRef('ant-pro-global-header')
const cls = computed(() => ({
  [prefixCls.value]: true,
  [`${prefixCls.value}-layout-${layout.value}`]: !!layout.value,
  [`${prefixCls.value}-inverted`]: theme.value === 'inverted' && layout.value === 'top',
}))
</script>

<template>
  <div :class="cls">
    <template v-if="menuHeader">
      <GlobalHeaderLogo v-if="layout !== 'side' || isMobile" />
    </template>
    <span v-if="isMobile" class="ant-pro-global-header-collapsed-button" @click="handleMobileCollapsed">
      <MenuFoldOutlined />
    </span>
    <div class="flex-1">
      <slot name="headerContent" />
    </div>
    <a-space align="center" flex-shrink-0>
      <slot name="headerActions" />
    </a-space>
  </div>
</template>

<style lang="less">
@import "./index.less";
</style>

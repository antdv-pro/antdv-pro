<script setup lang="ts">
import { useLayoutState } from '../../basic-layout/context'
import GlobalHeaderLogo from './global-header-logo.vue'
const { layout } = useLayoutState()
const prefixCls = shallowRef('ant-pro-global-header')
const cls = computed(() => ({
  [prefixCls.value]: true,
  [`${prefixCls.value}-layout-${layout.value}`]: !!layout.value,
}))
</script>

<template>
  <div :class="cls">
    <GlobalHeaderLogo v-if="layout !== 'side'" />
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

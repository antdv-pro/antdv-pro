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
    <GlobalHeaderLogo />
  </div>
</template>

<style lang="less">
@import "./index.less";
</style>

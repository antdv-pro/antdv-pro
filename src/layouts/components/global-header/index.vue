<script setup lang="ts">
import GlobalHeaderLogo from './global-header-logo.vue'
const props = defineProps<{
  layout?: 'mix' | 'side' | 'top'
}>()
const prefixCls = shallowRef('ant-pro-global-header')
const cls = computed(() => ({
  [prefixCls.value]: true,
  [`${prefixCls.value}-layout-${props.layout}`]: !!props.layout,
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

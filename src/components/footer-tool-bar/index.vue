<script setup>
import { useLayoutState } from '~/layouts/basic-layout/context.js'

defineOptions({
  name: 'FooterToolBar',
})
const prefixCls = shallowRef('ant-pro-footer-toolbar')
const { siderWidth: layoutSiderWidth, collapsed, collapsedWidth, isMobile, layout } = useLayoutState()
const barWidth = computed(() => {
  if (isMobile.value || layout.value === 'top')
    return void 0
  return `calc(100% - ${collapsed.value ? collapsedWidth.value : layoutSiderWidth.value}px)`
})
</script>

<template>
  <div :class="prefixCls" :style="{ width: barWidth, transition: '0.3s all' }">
    <div class="footer-tool-bar__left">
      <slot name="left" />
    </div>
    <div class="footer-tool-bar__center">
      <slot />
    </div>
    <div class="footer-tool-bar__right">
      <slot name="right" />
    </div>
  </div>
  <div class="h-56px" />
</template>

<style scoped lang="less">
@import "./index.less";

.footer-tool-bar__left {
  float: left;
}
.footer-tool-bar__right {
  float: right;
}
.footer-tool-bar__center {
  float: none;
}
</style>

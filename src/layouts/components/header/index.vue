<script setup lang="ts">
import type { CSSProperties } from 'vue'

const props = withDefaults(defineProps<{
  headerHeight?: number
  fixedHeader?: boolean
}>(), {
  headerHeight: 48,
  fixedHeader: true,
})
const headerStyle = computed<CSSProperties>(() => {
  const defaultStyle: CSSProperties = {
    height: `${props.headerHeight}px`,
    lineHeight: `${props.headerHeight}px`,
  }
  if (props.fixedHeader) {
    defaultStyle.zIndex = 100
    defaultStyle.width = '100%'
    defaultStyle.right = 0
  }

  return defaultStyle
})
const cls = computed(() => {
  const classes = []
  if (props.fixedHeader)
    classes.push('ant-pro-fixed-header')

  return classes
})
</script>

<template>
  <a-layout-header
    v-if="fixedHeader" :style="{
      height: `${props.headerHeight}px`,
      lineHeight: `${props.headerHeight}px`,
      background: 'transparent',
    }"
  />
  <a-layout-header :style="headerStyle" :class="cls">
    <slot />
  </a-layout-header>
</template>

<style lang="less">
@import "./index.less";
</style>

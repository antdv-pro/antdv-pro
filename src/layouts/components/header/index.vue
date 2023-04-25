<script setup lang="ts">
import type { CSSProperties } from 'vue'
import GlobalHeader from '../global-header/index.vue'
import { useLayoutState } from '../../basic-layout/context'
const { headerHeight, fixedHeader, layout } = useLayoutState()

const headerStyle = computed<CSSProperties>(() => {
  const defaultStyle: CSSProperties = {
    height: `${headerHeight.value}px`,
    lineHeight: `${headerHeight.value}px`,
    paddingInline: 0,
  }
  if (fixedHeader.value || layout.value === 'mix') {
    defaultStyle.zIndex = 100
    defaultStyle.width = '100%'
    defaultStyle.right = 0
  }
  return defaultStyle
})
const cls = computed(() => {
  const classes = []
  if (fixedHeader.value || layout.value === 'mix')
    classes.push('ant-pro-fixed-header')

  return classes
})
const needFixed = computed(() =>
  fixedHeader.value || layout.value === 'mix',
)
</script>

<template>
  <a-layout-header
    v-if="needFixed" :style="{
      height: `${headerHeight}px`,
      lineHeight: `${headerHeight}px`,
      background: 'transparent',
    }"
  />
  <a-layout-header :style="headerStyle" :class="cls">
    <GlobalHeader />
    <div class="flex-1">
      <slot name="headerContent" />
    </div>
    <a-space align="center">
      <slot name="headerActions" />
    </a-space>
  </a-layout-header>
</template>

<style lang="less">
@import "./index.less";
</style>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import GlobalHeader from '../global-header/index.vue'
import { useLayoutState } from '../../basic-layout/context'

const {
  headerHeight,
  fixedHeader,
  layout,
  isMobile,
  collapsed,
  collapsedWidth,
  siderWidth,
  menu,
  splitMenus,
  selectedMenus,
} = useLayoutState()

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

  if (layout.value === 'side' && menu.value) {
    if (!isMobile.value && fixedHeader.value) {
      const width = collapsed.value ? collapsedWidth.value : siderWidth.value
      defaultStyle.width = `calc(100% - ${width}px)`
    }
    defaultStyle.zIndex = 19
  }

  return defaultStyle
})
const cls = computed(() => {
  const classes = []
  if (fixedHeader.value || layout.value === 'mix')
    classes.push('ant-pro-fixed-header')

  if (layout.value)
    classes.push('ant-pro-fixed-header-action')

  if (layout.value === 'mix')
    classes.push('ant-pro-fixed-header-inverted')

  return classes
})
const needFixed = computed(
  () =>
    fixedHeader.value || (layout.value === 'mix' && (splitMenus.value ? (selectedMenus.value ?? []).length > 0 : true)),
)
</script>

<template>
  <a-layout-header
    v-if="needFixed"
    :style="{
      height: `${headerHeight}px`,
      lineHeight: `${headerHeight}px`,
      background: 'transparent',
    }"
  />
  <a-layout-header :style="headerStyle" :class="cls">
    <GlobalHeader>
      <template v-if="$slots.headerActions" #headerActions>
        <slot name="headerActions" />
      </template>
      <template v-if="$slots.headerContent" #headerContent>
        <slot name="headerContent" />
      </template>
    </GlobalHeader>
  </a-layout-header>
</template>

<style lang="less">
@import './index.less';
</style>

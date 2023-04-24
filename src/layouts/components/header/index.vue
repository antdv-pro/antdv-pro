<script setup lang="ts">
import type { CSSProperties } from 'vue'

const props = withDefaults(defineProps<{
  headerHeight?: number
}>(), {
  headerHeight: 48,
})
const headerStyle = computed<CSSProperties>(() => ({
  height: `${props.headerHeight}px`,
  lineHeight: `${props.headerHeight}px`,
}))
</script>

<template>
  <a-layout-header :style="headerStyle">
    <slot />
  </a-layout-header>
</template>

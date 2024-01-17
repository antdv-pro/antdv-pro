<script setup lang="ts">
import { useLayoutState } from '../../basic-layout/context'

const { logo, title, layout, isMobile } = useLayoutState()
const cls = computed(() => ({
  'ant-pro-global-header-logo': layout.value === 'mix' || isMobile.value,
  'ant-pro-top-nav-header-logo': layout.value === 'top' && !isMobile.value,
}))
</script>

<template>
  <div :class="cls">
    <a c-primary>
      <img :src="logo">
      <h1 v-if="!isMobile">{{ title }}</h1>
    </a>
  </div>
</template>

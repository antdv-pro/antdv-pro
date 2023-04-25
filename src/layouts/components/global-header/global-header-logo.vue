<script setup lang="ts">
import { useLayoutState } from '../../basic-layout/context'

const { logo, title, layout } = useLayoutState()
</script>

<template>
  <div :class="layout === 'mix' ? 'ant-pro-global-header-logo' : 'ant-pro-top-nav-header-logo'">
    <a>
      <img :src="logo">
      <h1>{{ title }}</h1>
    </a>
  </div>
</template>

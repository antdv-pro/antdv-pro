<script setup lang="ts">
import { useLayoutState } from '../../basic-layout/context'

const { logo, title } = useLayoutState()
</script>

<template>
  <div class="ant-pro-global-header-logo">
    <a>
      <img :src="logo">
      <h1>{{ title }}</h1>
    </a>
  </div>
</template>

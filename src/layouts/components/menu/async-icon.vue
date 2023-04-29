<script setup lang="ts">
import * as icons from '@ant-design/icons-vue'
defineProps<{
  icon: string
}>()
</script>

<template>
  <component :is="(icons as any)[icon]" v-if="icon" />
</template>

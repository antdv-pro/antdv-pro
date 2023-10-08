<script setup lang="ts">
import * as icons from '@ant-design/icons-vue'
import { isFunction } from '@v-c/utils'
import type { VNodeChild } from 'vue'

const props = defineProps<{
  icon: string | ((...args: any[]) => VNodeChild)
}>()
const Comp = computed(() => {
  if (isFunction(props.icon)) {
    const node = props.icon()
    if (node)
      return node
  }
  else {
    return (icons as any)[props.icon]
  }
})
</script>

<template>
  <component :is="Comp" v-if="icon" />
</template>

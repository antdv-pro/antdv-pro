<script setup lang="ts">
import type { PropType } from 'vue'

const props = defineProps({
  options: {
    type: Object as PropType<any>,
    default: () => {},
  },
}) as any

const modelValue = defineModel({
  type: [String, Number, Boolean] as PropType<string | number | boolean>,
  default: '',
})
</script>

<template>
  <a-switch v-bind="props.options" v-model:checked="modelValue" />
</template>

<style scoped lang="less">

</style>

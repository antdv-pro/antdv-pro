<script setup lang="ts">
import type { PropType } from 'vue'

const props = defineProps({
  options: {
    type: Object as PropType<any>,
    default: () => {},
  },
}) as any

const modelValue = defineModel({
  type: [String, Number, Boolean, Object, Array] as PropType<any>,
  default: '',
})

function onUpdateValue(value: any) {
  modelValue.value = value
}
</script>

<template>
  <a-radio-group v-bind="props.options" :value="modelValue" @update:value="onUpdateValue" />
</template>

<style scoped lang="less">

</style>

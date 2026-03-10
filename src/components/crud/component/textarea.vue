<script setup lang="ts">
import type { PropType } from 'vue'

const props = defineProps({
  options: {
    type: Object as PropType<any>,
    default: () => {},
  },
}) as any

const modelValue = defineModel({
  type: String as PropType<string>,
  default: '',
})

function onUpdateValue(e: any) {
  modelValue.value = e
}
</script>

<template>
  <div>
    <a-textarea v-bind="props.options" :value="modelValue" @update:value="onUpdateValue" />
  </div>
</template>

<style scoped lang="less">

</style>

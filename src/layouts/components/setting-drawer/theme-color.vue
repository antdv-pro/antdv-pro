<script setup lang="ts">
import { CheckOutlined } from '@ant-design/icons-vue'

defineProps<{
  colorList: ({ key: string; color: string })[]
  color?: string
  onChange?: (color: string) => void
}>()

const prefixCls = shallowRef('ant-pro-drawer-setting-theme-color')
</script>

<template>
  <div :class="`${prefixCls}`">
    <div :class="`${prefixCls}-content`">
      <div
        v-for="item in colorList"
        :key="item.color"
        :class="`${prefixCls}-block`"
        :style="{ backgroundColor: item.color }"
        @click="onChange?.(item.color)"
      >
        <CheckOutlined v-show="color === item.color" />
      </div>
    </div>
  </div>
</template>

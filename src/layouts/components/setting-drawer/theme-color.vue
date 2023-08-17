<script setup lang="ts">
import { CheckOutlined } from '@ant-design/icons-vue'

defineProps<{
  colorList: ({ key: string; color: string })[]
  color?: string
  onChange?: (color: string) => void
  t?: (key: string, ...args: any[]) => string
}>()

const prefixCls = shallowRef('ant-pro-drawer-setting-theme-color')
</script>

<template>
  <div :class="`${prefixCls}`">
    <div :class="`${prefixCls}-content`">
      <a-tooltip
        v-for="item in colorList"
        :key="item.color"
      >
        <template #title>
          {{ t?.(`app.setting.themecolor.${item.key}`) }}
        </template>
        <div
          :class="`${prefixCls}-block`"
          :style="{ backgroundColor: item.color }"
          @click="onChange?.(item.color)"
        >
          <CheckOutlined v-show="color === item.color" />
        </div>
      </a-tooltip>
    </div>
  </div>
</template>

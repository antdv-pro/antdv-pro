<script setup>
import { CheckOutlined } from '@ant-design/icons-vue'

defineProps({
  colorList: { type: Array, required: true },
  color: { type: String, required: false },
  onChange: { type: Function, required: false },
  t: { type: Function, required: false },
})
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

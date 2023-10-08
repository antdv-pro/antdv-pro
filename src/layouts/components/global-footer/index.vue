<script setup lang="ts">
import { CopyrightCircleOutlined } from '@ant-design/icons-vue'

defineProps<{
  copyright?: string
}>()

const prefixCls = shallowRef('ant-pro-global-footer')
</script>

<template>
  <div :class="prefixCls">
    <div v-if="$slots.renderFooterLinks" :class="`${prefixCls}-links`">
      <slot name="renderFooterLinks" />
    </div>
    <div v-if="copyright" :class="`${prefixCls}-copyright`">
      <CopyrightCircleOutlined /> {{ copyright }}
    </div>
  </div>
</template>

<style lang="less">
@import "index";
</style>

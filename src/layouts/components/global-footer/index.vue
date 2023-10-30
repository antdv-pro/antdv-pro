<script setup lang="ts">
import { CopyrightCircleOutlined } from '@ant-design/icons-vue'

defineOptions({
  name: 'GlobalFooter',
})

defineProps<{
  copyright?: string
  icp?: string
}>()

const prefixCls = shallowRef('ant-pro-global-footer')
</script>

<template>
  <div :class="prefixCls">
    <div v-if="$slots.renderFooterLinks" :class="`${prefixCls}-links`">
      <slot name="renderFooterLinks" />
    </div>
    <div v-if="copyright" :class="`${prefixCls}-copyright`">
      <a v-if="icp" href="https://beian.miit.gov.cn/" target="_blank">{{ icp }}</a> <CopyrightCircleOutlined /> {{ copyright }}
    </div>
  </div>
</template>

<style lang="less">
@import "index";
</style>

<script setup lang="ts">
import './index.less'
import { CopyrightCircleOutlined } from '@ant-design/icons-vue'
import { useLayoutState } from '~@/layouts/basic-layout/context'

const prefixCls = shallowRef('ant-pro-global-footer')
const { copyright } = useLayoutState()
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

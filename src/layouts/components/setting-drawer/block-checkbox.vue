<script setup lang="ts">
import { CheckOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  theme?: 'light' | 'dark' | 'inverted' | 'top' | 'side' | 'mix'
  isDark?: boolean
  checked?: boolean
}>()
const prefixCls = shallowRef('ant-pro-drawer-setting-block-checkbox')
const cls = computed(() => {
  return {
    [`${prefixCls.value}-item`]: true,
    [`${prefixCls.value}-theme-item`]: props.isDark,
    [`${prefixCls.value}-item-${props.theme}`]: !!props.theme,
    [`${prefixCls.value}-theme-item-${props.theme}`]: props.isDark,
  }
})

const token = useAntdToken()
</script>

<template>
  <div :class="cls">
    <CheckOutlined v-show="checked" :style="{ color: token?.colorPrimary }" :class="`${prefixCls}-selectIcon`" />
  </div>
</template>

<script setup lang="ts">
import { CheckOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  theme?: 'light' | 'dark' | 'inverted' | 'top' | 'side' | 'mix'
  isDark?: boolean
  checked?: boolean
  t?: (key: string, ...args: any[]) => string
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

const { token } = useAntdToken()
</script>

<template>
  <a-tooltip>
    <template #title>
      {{ t?.(`app.setting.pagestyle.${theme}` ?? '') }}
    </template>
    <div :class="cls">
      <CheckOutlined v-show="checked" :style="{ color: token?.colorPrimary }" :class="`${prefixCls}-selectIcon`" />
    </div>
  </a-tooltip>
</template>

<script setup lang="ts">
import { CloseOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { useConfigContextInject } from 'ant-design-vue/es/config-provider/context'
import type { ThemeType } from '../../basic-layout/typing'
withDefaults(defineProps<{
  open?: boolean
  theme?: ThemeType
}>(), {
  theme: 'light',
})
const emit = defineEmits(['update:open'])
const prefixCls = shallowRef('ant-pro-drawer-setting')
const handleVisible = (open: boolean) => {
  emit('update:open', open)
}
const { theme } = useConfigContextInject()
</script>

<template>
  <div
    :class="`${prefixCls}-handle`"
    :style="{
      backgroundColor: theme.token?.colorPrimary,
      borderEndStartRadius: `${theme.token?.borderRadius}px`,
      borderStartStartRadius: `${theme.token?.borderRadius}px`,
    }" @click="handleVisible(!open)"
  >
    <CloseOutlined v-if="open" :class="`${prefixCls}-handle-icon${theme === 'light' ? '' : '-dark'}`" style="font-size: 20px;" />
    <SettingOutlined v-else :class="`${prefixCls}-handle-icon${theme === 'light' ? '' : '-dark'}`" style="font-size: 20px;" />
  </div>
  <a-drawer
    :open="open"
    :width="300"
    placement="right"
    :closable="false"
    @update:open="handleVisible"
  >
    <template #handle>
      <div
        :class="`${prefixCls}-handle`"
        :style="{
          position: 'absolute',
          top: '240px',
          right: '300px',
          backgroundColor: theme.token?.colorPrimary,
          borderEndStartRadius: `${theme.token?.borderRadius}px`,
          borderStartStartRadius: `${theme.token?.borderRadius}px`,
        }" @click="handleVisible(!open)"
      >
        <CloseOutlined v-if="open" :class="`${prefixCls}-handle-icon${theme === 'light' ? '' : '-dark'}`" style="font-size: 20px;" />
        <SettingOutlined v-else :class="`${prefixCls}-handle-icon${theme === 'light' ? '' : '-dark'}`" style="font-size: 20px;" />
      </div>
    </template>
    <div>
      Ces
    </div>
  </a-drawer>
</template>

<style lang="less">
@import "./index.less";
</style>

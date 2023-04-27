<script setup lang="ts">
import { CloseOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { useConfigContextInject } from 'ant-design-vue/es/config-provider/context'
import type { ThemeType } from '../../basic-layout/typing'
import Body from './body.vue'
import BlockCheckbox from './block-checkbox.vue'
const props = withDefaults(defineProps<{
  open?: boolean
  theme?: ThemeType
  colorList?: ({ key: string; color: string })[]
}>(), {
  theme: 'light',
  colorList: () => [
    { key: 'techBlue', color: '#1677FF' },
    { key: 'daybreak', color: '#1890ff' },
    { key: 'dust', color: '#F5222D' },
    { key: 'volcano', color: '#FA541C' },
    { key: 'sunset', color: '#FAAD14' },
    { key: 'cyan', color: '#13C2C2' },
    { key: 'green', color: '#52C41A' },
    { key: 'geekblue', color: '#2F54EB' },
    { key: 'purple', color: '#722ED1' },
  ],
})
const emit = defineEmits(['update:open', 'settingChange'])
const prefixCls = shallowRef('ant-pro-drawer-setting')
const handleVisible = (open: boolean) => {
  emit('update:open', open)
}

const changeTheme = (theme: ThemeType) => {
  emit('settingChange', 'theme', theme)
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
        <CloseOutlined v-if="open" :class="`${prefixCls}-handle-icon${props.theme === 'light' ? '' : '-dark'}`" style="font-size: 20px;" />
        <SettingOutlined v-else :class="`${prefixCls}-handle-icon${props.theme === 'light' ? '' : '-dark'}`" style="font-size: 20px;" />
      </div>
    </template>
    <div :class="`${prefixCls}-content`">
      <Body title="整体风格设计">
        <div :class="`${prefixCls}-block-checkbox`">
          <BlockCheckbox :checked="props.theme === 'light'" theme="light" :is-dark="props.theme === 'dark'" @click="changeTheme('light')" />
          <BlockCheckbox :checked="props.theme === 'inverted'" theme="inverted" :is-dark="props.theme === 'dark'" @click="changeTheme('inverted')" />
          <BlockCheckbox :checked="props.theme === 'dark'" theme="dark" :is-dark="props.theme === 'dark'" @click="changeTheme('dark')" />
        </div>
      </Body>
      <Body title="主题色">
        <div class="theme-color">
          <div class="theme-color-content">
            <!--  -->
          </div>
        </div>
      </Body>
    </div>
  </a-drawer>
</template>

<style lang="less">
@import "./index.less";
</style>

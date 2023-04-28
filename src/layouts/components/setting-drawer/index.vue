<script setup lang="ts">
import { CloseOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { useConfigContextInject } from 'ant-design-vue/es/config-provider/context'
import type { ContentWidth, LayoutType, ThemeType } from '../../basic-layout/typing'
import Body from './body.vue'
import BlockCheckbox from './block-checkbox.vue'
import ThemeColor from './theme-color.vue'
import LayoutSetting from './layout-setting.vue'
const props = withDefaults(defineProps<{
  open?: boolean
  theme?: ThemeType
  colorPrimary?: string
  colorList?: ({ key: string; color: string })[]
  layout?: LayoutType
  contentWidth?: ContentWidth
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

const changeColor = (color: string) => {
  emit('settingChange', 'colorPrimary', color)
}

const changeLayout = (layout: string) => {
  emit('settingChange', 'layout', layout)
}
const changeSettingLayout = (key: string, value: any) => {
  emit('settingChange', key, value)
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
          <BlockCheckbox v-if="layout !== 'mix'" :checked="props.theme === 'inverted'" theme="inverted" :is-dark="props.theme === 'dark'" @click="changeTheme('inverted')" />
          <BlockCheckbox :checked="props.theme === 'dark'" theme="dark" :is-dark="props.theme === 'dark'" @click="changeTheme('dark')" />
        </div>
      </Body>
      <Body title="主题色">
        <ThemeColor :color-list="colorList" :color="colorPrimary" @change="changeColor" />
      </Body>
      <a-divider />
      <Body title="导航模式">
        <div :class="`${prefixCls}-block-checkbox`">
          <BlockCheckbox theme="side" :checked="layout === 'side'" :is-dark="props.theme === 'dark'" @click="changeLayout('side')" />
          <BlockCheckbox theme="top" :checked="layout === 'top'" :is-dark="props.theme === 'dark'" @click="changeLayout('top')" />
          <BlockCheckbox theme="mix" :checked="layout === 'mix'" :is-dark="props.theme === 'dark'" @click="changeLayout('mix')" />
        </div>
      </Body>
      <LayoutSetting :layout="layout" :content-width="contentWidth" @change-setting="changeSettingLayout" />
    </div>
  </a-drawer>
</template>

<style lang="less">
@import "./index.less";
</style>

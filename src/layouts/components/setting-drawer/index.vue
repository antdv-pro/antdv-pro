<script setup lang="ts">
import { CloseOutlined, SettingOutlined } from '@ant-design/icons-vue'
import type { ContentWidth, LayoutType, ThemeType } from '../../basic-layout/typing'
import Body from './body.vue'
import BlockCheckbox from './block-checkbox.vue'
import ThemeColor from './theme-color.vue'
import LayoutSetting from './layout-setting.vue'
import RegionalSetting from './regional-setting.vue'
import OtherSetting from './other-setting.vue'
const props = withDefaults(defineProps<{
  open?: boolean
  theme?: ThemeType
  colorPrimary?: string
  colorList?: ({ key: string; color: string })[]
  layout?: LayoutType
  contentWidth?: ContentWidth
  fixedHeader?: boolean
  fixedSider?: boolean
  splitMenus?: boolean
  keepAlive?: boolean
  header?: boolean
  footer?: boolean
  menu?: boolean
  menuHeader?: boolean
  colorWeak?: boolean
  multiTab?: boolean
  multiTabFixed?: boolean
  t?: (key: string, ...args: any[]) => string
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

const { token } = useAntdToken()
</script>

<template>
  <div
    :class="`${prefixCls}-handle`"
    :style="{
      backgroundColor: token?.colorPrimary,
      borderEndStartRadius: `${token?.borderRadius}px`,
      borderStartStartRadius: `${token?.borderRadius}px`,
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
          backgroundColor: token?.colorPrimary,
          borderEndStartRadius: `${token?.borderRadius}px`,
          borderStartStartRadius: `${token?.borderRadius}px`,
        }" @click="handleVisible(!open)"
      >
        <CloseOutlined v-if="open" :class="`${prefixCls}-handle-icon${props.theme === 'light' ? '' : '-dark'}`" style="font-size: 20px;" />
        <SettingOutlined v-else :class="`${prefixCls}-handle-icon${props.theme === 'light' ? '' : '-dark'}`" style="font-size: 20px;" />
      </div>
    </template>
    <div :class="`${prefixCls}-content`">
      <Body :title="t?.('app.setting.pagestyle') ?? '整体风格设计'">
        <div :class="`${prefixCls}-block-checkbox`">
          <BlockCheckbox :t="t" :checked="props.theme === 'light'" theme="light" :is-dark="props.theme === 'dark'" @click="changeTheme('light')" />
          <BlockCheckbox v-if="layout !== 'mix'" :t="t" :checked="props.theme === 'inverted'" theme="inverted" :is-dark="props.theme === 'dark'" @click="changeTheme('inverted')" />
          <BlockCheckbox :t="t" :checked="props.theme === 'dark'" theme="dark" :is-dark="props.theme === 'dark'" @click="changeTheme('dark')" />
        </div>
      </Body>
      <Body :title="t?.('app.setting.themecolor') ?? '主题色'">
        <ThemeColor :t="t" :color-list="colorList" :color="colorPrimary" @change="changeColor" />
      </Body>
      <a-divider />
      <Body :title="t?.('app.setting.pagestyle.mode') ?? '导航模式'">
        <div :class="`${prefixCls}-block-checkbox`">
          <BlockCheckbox :t="t" theme="side" :checked="layout === 'side'" :is-dark="props.theme === 'dark'" @click="changeLayout('side')" />
          <BlockCheckbox :t="t" theme="top" :checked="layout === 'top'" :is-dark="props.theme === 'dark'" @click="changeLayout('top')" />
          <BlockCheckbox :t="t" theme="mix" :checked="layout === 'mix'" :is-dark="props.theme === 'dark'" @click="changeLayout('mix')" />
        </div>
      </Body>
      <LayoutSetting
        :layout="layout"
        :t="t"
        :content-width="contentWidth"
        :fixed-header="fixedHeader"
        :fixed-sider="fixedSider"
        :split-menus="splitMenus"
        :keep-alive="keepAlive"
        @change-setting="changeSettingLayout"
      />
      <a-divider />
      <Body :title="t?.('app.setting.content-area.title') ?? '内容区域'">
        <RegionalSetting
          :t="t"
          :layout="layout"
          :header="header"
          :menu-header="menuHeader"
          :footer="footer"
          :multi-tab="multiTab"
          :multi-tab-fixed="multiTabFixed"
          :menu="menu"
          @change-setting="changeSettingLayout"
        />
      </Body>
      <a-divider />
      <Body :title="t?.('app.setting.othersettings') ?? '其他设置'">
        <OtherSetting
          :t="t"
          :color-weak="colorWeak"
          @change-setting="changeSettingLayout"
        />
      </Body>
    </div>
  </a-drawer>
</template>

<style lang="less">
@import "./index.less";
</style>

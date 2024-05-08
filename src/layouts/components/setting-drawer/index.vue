<script setup>
import { CloseOutlined, CopyOutlined, NotificationOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { useClipboard } from '@v-c/utils'
import Body from './body.vue'
import BlockCheckbox from './block-checkbox.vue'
import ThemeColor from './theme-color.vue'
import LayoutSetting from './layout-setting.vue'
import RegionalSetting from './regional-setting.vue'
import OtherSetting from './other-setting.vue'

defineOptions({
  name: 'SettingDrawer',
})
const props = defineProps({
  open: { type: Boolean, required: false },
  theme: { type: String, required: false, default: 'light' },
  colorPrimary: { type: String, required: false },
  colorList: { type: Array, required: false, default: () => [
    { key: 'techBlue', color: '#1677FF' },
    { key: 'daybreak', color: '#1890ff' },
    { key: 'dust', color: '#F5222D' },
    { key: 'volcano', color: '#FA541C' },
    { key: 'sunset', color: '#FAAD14' },
    { key: 'cyan', color: '#13C2C2' },
    { key: 'green', color: '#52C41A' },
    { key: 'geekblue', color: '#2F54EB' },
    { key: 'purple', color: '#722ED1' },
  ] },
  layout: { type: String, required: false },
  contentWidth: { type: String, required: false },
  fixedHeader: { type: Boolean, required: false },
  fixedSider: { type: Boolean, required: false },
  splitMenus: { type: Boolean, required: false },
  keepAlive: { type: Boolean, required: false },
  accordionMode: { type: Boolean, required: false },
  leftCollapsed: { type: Boolean, required: false },
  watermark: { type: Boolean, required: false },
  header: { type: Boolean, required: false },
  footer: { type: Boolean, required: false },
  menu: { type: Boolean, required: false },
  menuHeader: { type: Boolean, required: false },
  colorWeak: { type: Boolean, required: false },
  colorGray: { type: Boolean, required: false },
  multiTab: { type: Boolean, required: false },
  multiTabFixed: { type: Boolean, required: false },
  compactAlgorithm: { type: Boolean, required: false },
  animationName: { type: String, required: false },
  animationNameList: { type: Array, required: false },
  layoutSetting: { type: Object, required: false },
  t: { type: Function, required: false },
})
const emit = defineEmits(['update:open', 'settingChange'])
const { copy } = useClipboard()
const prefixCls = shallowRef('ant-pro-drawer-setting')
const { message } = useGlobalConfig()
function copySetting() {
  copy(JSON.stringify(props.layoutSetting ?? {}))
  message?.success(props?.t?.('app.setting.copyinfo', '拷贝成功，请到 config/default-settings.js 中替换默认配置'))
}
function handleVisible(open) {
  emit('update:open', open)
}
function changeTheme(theme) {
  emit('settingChange', 'theme', theme)
}
function changeColor(color) {
  emit('settingChange', 'colorPrimary', color)
}
function changeLayout(layout) {
  emit('settingChange', 'layout', layout)
}
function changeSettingLayout(key, value) {
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
    }"
    @click="handleVisible(!open)"
  >
    <CloseOutlined
      v-if="open"
      :class="`${prefixCls}-handle-icon${theme === 'light' ? '' : '-dark'}`"
      style="font-size: 20px"
    />
    <SettingOutlined
      v-else
      :class="`${prefixCls}-handle-icon${theme === 'light' ? '' : '-dark'}`"
      style="font-size: 20px"
    />
  </div>
  <a-drawer :open="open" :width="300" placement="right" :closable="false" @update:open="handleVisible">
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
        }"
        @click="handleVisible(!open)"
      >
        <CloseOutlined
          v-if="open"
          :class="`${prefixCls}-handle-icon${props.theme === 'light' ? '' : '-dark'}`"
          style="font-size: 20px"
        />
        <SettingOutlined
          v-else
          :class="`${prefixCls}-handle-icon${props.theme === 'light' ? '' : '-dark'}`"
          style="font-size: 20px"
        />
      </div>
    </template>
    <div :class="`${prefixCls}-content`">
      <Body :title="t?.('app.setting.pagestyle') ?? '整体风格设计'">
        <div :class="`${prefixCls}-block-checkbox`">
          <BlockCheckbox
            :t="t"
            :checked="props.theme === 'light'"
            theme="light"
            :is-dark="props.theme === 'dark'"
            @click="changeTheme('light')"
          />
          <BlockCheckbox
            v-if="layout !== 'mix'"
            :t="t"
            :checked="props.theme === 'inverted'"
            theme="inverted"
            :is-dark="props.theme === 'dark'"
            @click="changeTheme('inverted')"
          />
          <BlockCheckbox
            :t="t"
            :checked="props.theme === 'dark'"
            theme="dark"
            :is-dark="props.theme === 'dark'"
            @click="changeTheme('dark')"
          />
        </div>
      </Body>
      <Body :title="t?.('app.setting.themecolor') ?? '主题色'">
        <ThemeColor :t="t" :color-list="colorList" :color="colorPrimary" @change="changeColor" />
      </Body>
      <a-divider />
      <Body :title="t?.('app.setting.pagestyle.mode') ?? '导航模式'">
        <div :class="`${prefixCls}-block-checkbox`">
          <BlockCheckbox
            :t="t"
            theme="side"
            :checked="layout === 'side'"
            :is-dark="props.theme === 'dark'"
            @click="changeLayout('side')"
          />
          <BlockCheckbox
            :t="t"
            theme="top"
            :checked="layout === 'top'"
            :is-dark="props.theme === 'dark'"
            @click="changeLayout('top')"
          />
          <BlockCheckbox
            :t="t"
            theme="mix"
            :checked="layout === 'mix'"
            :is-dark="props.theme === 'dark'"
            @click="changeLayout('mix')"
          />
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
        :accordion-mode="accordionMode"
        :left-collapsed="leftCollapsed"
        :compact-algorithm="compactAlgorithm"
        @change-setting="changeSettingLayout"
      />
      <a-divider />
      <Body :title="t?.('app.setting.content-area.title') ?? '内容区域'">
        <RegionalSetting
          :t="t"
          :layout="layout"
          :header="header"
          :watermark="watermark"
          :menu-header="menuHeader"
          :footer="footer"
          :animation-name="animationName"
          :animation-name-list="animationNameList"
          :multi-tab="multiTab"
          :multi-tab-fixed="multiTabFixed"
          :menu="menu"
          @change-setting="changeSettingLayout"
        />
      </Body>
      <a-divider />
      <Body :title="t?.('app.setting.othersettings') ?? '其他设置'">
        <OtherSetting :t="t" :color-weak="colorWeak" :color-gray="colorGray" @change-setting="changeSettingLayout" />
      </Body>
      <a-divider />
      <Body>
        <div flex gap-2 flex-col>
          <a-alert
            type="warning"
            show-icon
            :message="
              t?.('app.setting.production.hint')
                ?? '配置栏只在开发环境用于预览，生产环境不会展现，请拷贝后手动修改配置文件'
            "
          >
            <template #icon>
              <NotificationOutlined />
            </template>
          </a-alert>
          <a-button @click="copySetting">
            <CopyOutlined /> {{ t?.('app.setting.copy', '拷贝设置') }}
          </a-button>
        </div>
      </Body>
    </div>
  </a-drawer>
</template>

<style lang="less">
@import './index.less';
</style>

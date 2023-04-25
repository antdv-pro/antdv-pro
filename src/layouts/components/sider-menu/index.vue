<script setup lang="ts">
import { MenuFoldOutlined, MenuUnfoldOutlined, UploadOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons-vue'
const props = defineProps<{
  collapsed?: boolean
  collapsedWidth?: number
  menuData?: any
  onCollapsed?: (collapsed: boolean) => void
}>()

const selectedKeys = ref<string[]>([])

const handleCollapsed = () => {
  props?.onCollapsed?.(!props.collapsed)
}
</script>

<template>
  <div class="flex-1 of-x-hidden of-y-auto">
    <a-menu
      v-model:selectedKeys="selectedKeys"
      mode="inline"
      :collapsed="collapsed"
      class="ant-pro-sider-menu"
    >
      <a-menu-item key="1">
        <UserOutlined />
        <span>nav 1</span>
      </a-menu-item>
      <a-menu-item key="2">
        <VideoCameraOutlined />
        <span>nav 2</span>
      </a-menu-item>
      <a-menu-item key="3">
        <UploadOutlined />
        <span>nav 3</span>
      </a-menu-item>
    </a-menu>
  </div>
  <div class="w-100% flex-shrink-0 ant-pro-sider-collapsed-button">
    <a-menu
      class="ant-pro-sider-menu"
      mode="inline"
      :selectable="false"
      @click="handleCollapsed"
    >
      <a-menu-item>
        <template #icon>
          <MenuFoldOutlined v-if="collapsed" />
          <MenuUnfoldOutlined v-else />
        </template>
      </a-menu-item>
    </a-menu>
  </div>
</template>

<style lang="less">
@import "./index.less";
</style>

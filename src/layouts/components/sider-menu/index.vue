<script setup lang="ts">
import { ExpandOutlined, UploadOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons-vue'
defineProps<{
  collapsed?: boolean
  collapsedWidth?: number
  menuData?: any
}>()

const selectedKeys = ref<string[]>([])
</script>

<template>
  <div class="flex-1 of-x-hidden of-y-auto">
    <a-menu
      v-model:selectedKeys="selectedKeys"
      mode="inline"
      :inline-collapsed="collapsed"
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
    >
      <a-menu-item>
        <template #icon>
          <ExpandOutlined />
        </template>
      </a-menu-item>
    </a-menu>
  </div>
</template>

<style lang="less">
@import "./index.less";
</style>

<script setup lang="ts">
import { UploadOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons-vue'
defineProps<{
  collapsed?: boolean
  collapsedWidth?: number
  menuData?: any
}>()

const selectedKeys = ref<string[]>([])
</script>

<template>
  <div>
    <a-menu
      v-model:selectedKeys="selectedKeys"
      mode="inline"
      :inline-collapsed="collapsed"
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
</template>

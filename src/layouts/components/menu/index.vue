<script setup lang="ts">
import { UploadOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons-vue'
import { useLayoutState } from '../../basic-layout/context'

const { theme, collapsed, layout, isMobile } = useLayoutState()
const selectedKeys = ref<string[]>([])
const menuTheme = computed(() => {
  if (layout.value === 'side' && theme.value === 'inverted')
    return 'dark'

  if (layout.value === 'mix' && theme.value === 'light')
    return 'light'

  if (layout.value === 'top' && theme.value === 'dark')
    return 'light'

  return theme.value
})
</script>

<template>
  <a-menu
    v-model:selectedKeys="selectedKeys"
    :mode="(layout === 'top' && !isMobile) ? 'horizontal' : 'inline'"
    :theme="menuTheme"
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
</template>

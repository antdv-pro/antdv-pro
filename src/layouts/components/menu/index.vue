<script setup lang="ts">
import { useLayoutState } from '../../basic-layout/context'
import SubMenu from './sub-menu.vue'

const { theme, collapsed, layout, isMobile, selectedMenus, selectedKeys, openKeys, handleOpenKeys, handleSelectedKeys, handleMenuSelect } = useLayoutState()
const menuTheme = computed(() => {
  if (theme.value === 'inverted')
    return 'dark'
  return theme.value
})
</script>

<template>
  <a-menu
    :selected-keys="selectedKeys"
    :open-keys="collapsed ? [] : openKeys"
    :mode="(layout === 'top' && !isMobile) ? 'horizontal' : 'inline'"
    :theme="menuTheme"
    :collapsed="collapsed"
    class="ant-pro-sider-menu"
    @update:open-keys="handleOpenKeys"
    @update:selected-keys="handleSelectedKeys"
    @select="handleMenuSelect"
  >
    <template v-for="item in selectedMenus">
      <template v-if="!item.hideInMenu">
        <SubMenu :key="item.path" :item="item" />
      </template>
    </template>
  </a-menu>
</template>

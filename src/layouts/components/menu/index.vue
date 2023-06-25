<script setup lang="ts">
import { useLayoutState } from '../../basic-layout/context'
import SubMenu from './sub-menu.vue'
import { useLayoutMenu } from '~/stores/layout-menu.ts'

const { theme, collapsed, layout, isMobile, menuData, selectedKeys, openKeys, handleOpenKeys, handleSelectedKeys, handleMenuSelect } = useLayoutState()
const menuTheme = computed(() => {
  if (theme.value === 'inverted')
    return 'dark'
  return theme.value
})

const layoutMenu = useLayoutMenu()
</script>

<template>
  <a-menu
    :selected-keys="selectedKeys"
    :open-keys="openKeys"
    :mode="(layout === 'top' && !isMobile) ? 'horizontal' : 'inline'"
    :theme="menuTheme"
    :collapsed="collapsed"
    class="ant-pro-sider-menu"
    @update:open-keys="handleOpenKeys"
    @update:selected-keys="handleSelectedKeys"
    @openChange="layoutMenu.handleAccordionMode"
    @select="handleMenuSelect"
  >
    <template v-for="item in menuData" :key="item.path">
      <template v-if="!item.hideInMenu">
        <SubMenu :item="item" />
      </template>
    </template>
  </a-menu>
</template>

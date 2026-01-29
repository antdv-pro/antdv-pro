<script setup lang="ts">
import { useLayoutState } from '../../basic-layout/context'
import { createMenuItems } from './menu-items'

const { theme, collapsed, layout, isMobile, selectedMenus, selectedKeys, openKeys, handleOpenKeys, handleSelectedKeys, handleMenuSelect } = useLayoutState()
const menuTheme = computed(() => {
  if (theme.value === 'inverted')
    return 'dark'
  return theme.value
})
const menuItems = computed(() => createMenuItems(selectedMenus.value ?? []))
const resolveLabel = (label: any) => (typeof label === 'function' ? label() : label)
</script>

<template>
  <a-menu
    :items="menuItems"
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
    <template #labelRender="item">
      <span v-if="item?.children?.length || item?.link === false">
        {{ resolveLabel(item.label) }}
      </span>
      <RouterLink v-else-if="!item.isUrl" :to="item.path">
        {{ resolveLabel(item.label) }}
      </RouterLink>
      <a v-else :href="item.path" :target="item.target ?? '_blank'">
        {{ resolveLabel(item.label) }}
      </a>
    </template>
  </a-menu>
</template>

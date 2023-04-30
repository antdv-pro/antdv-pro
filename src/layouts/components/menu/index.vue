<script setup lang="ts">
import { useLayoutState } from '../../basic-layout/context'
import SubMenu from './sub-menu.vue'

const { theme, collapsed, layout, isMobile, menuData } = useLayoutState()
const selectedKeys = ref<string[]>([])
const menuTheme = computed(() => {
  if (theme.value === 'inverted')
    return 'dark'

  // if (layout.value === 'mix' && theme.value === 'light')
  //   return 'light'

  // if (layout.value === 'top' && theme.value === 'dark')
  //   return 'light'

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
    <template v-for="item in menuData" :key="item.path">
      <SubMenu :item="item" />
    </template>
  </a-menu>
</template>

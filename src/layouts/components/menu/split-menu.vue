<script setup lang="ts">
import { useLayoutState } from '../../basic-layout/context'
import { createMenuItems } from './menu-items'

const { splitState, menuData, handleSplitSelectedKeys } = useLayoutState()

const menuItems = computed(() => createMenuItems(menuData.value ?? [], {
  link: item => (item.children ?? []).length <= 0 || item.hideChildrenInMenu,
}))
const resolveLabel = (label: any) => (typeof label === 'function' ? label() : label)
</script>

<template>
  <a-menu
    :items="menuItems"
    mode="horizontal"
    theme="dark"
    class="ant-pro-sider-menu-header"
    :selected-keys="splitState.selectedKeys"
    @update:selected-keys="handleSplitSelectedKeys"
  >
    <template #labelRender="item">
      <span v-if="item.children?.length || item.link === false">
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

<style lang="less">
.ant-pro-sider-menu-header {
  margin-left: 14px;
}
[data-theme='dark'] {
  .ant-pro-sider-menu-header {
    background: transparent;
  }
}
</style>

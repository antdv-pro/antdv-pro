<script setup lang="ts">
import { omit } from '@v-c/utils'
import { useLayoutState } from '../../basic-layout/context'
import SubMenu from './sub-menu.vue'

const { splitState, menuData, handleSplitSelectedKeys } = useLayoutState()

const menuDataList = computed(() => menuData.value?.map(v => omit(v, ['children'])))
</script>

<template>
  <a-menu
    mode="horizontal"
    theme="dark"
    class="ant-pro-sider-menu-header"
    :selected-keys="splitState.selectedKeys"
    @update:selected-keys="handleSplitSelectedKeys"
  >
    <template v-for="item in menuDataList" :key="item.path">
      <template v-if="!item.hideInMenu">
        <SubMenu :item="item" :link="false" />
      </template>
    </template>
  </a-menu>
</template>

<style lang="less">
.ant-pro-sider-menu-header{
  margin-left: 14px;
}
[data-theme='dark']{
  .ant-pro-sider-menu-header{
    background: transparent;
  }
}
</style>

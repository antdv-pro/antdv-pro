<script setup>
import { useLayoutState } from '../../basic-layout/context.js'
import SideMenu from '../sider-menu/index.vue'

const { mobileCollapsed, siderWidth } = useLayoutState()
</script>

<template>
  <a-drawer
    v-model:open="mobileCollapsed"
    :closable="false"
    placement="left"
    :width="siderWidth"
  >
    <SideMenu />
  </a-drawer>
</template>

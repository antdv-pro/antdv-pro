<script setup lang="ts">
import { pick } from '@v-c/utils'
import BasicLayout from './basic-layout/index.vue'
import SettingDrawer from './components/setting-drawer/index.vue'
const appStore = useAppStore()
const userStore = useUserStore()
const layoutMenu = useLayoutMenu()
const { selectedKeys, openKeys } = storeToRefs(layoutMenu)
const { isMobile, isPad } = useQueryBreakpoints()
watch(isPad, (val) => {
  if (val)
    appStore.toggleCollapsed(true)
  else
    appStore.toggleCollapsed(false)
})
const layoutProps = computed(() => pick(appStore.layoutSetting, ['fixedHeader', 'fixedSider', 'splitMenus', 'menuHeader', 'header', 'menu', 'layout', 'footer']))
</script>

<template>
  <BasicLayout
    :collapsed="appStore.layoutSetting.collapsed"
    :theme="appStore.layoutSetting.theme"
    :menu-data="userStore.menuData"
    v-bind="layoutProps"
    :selected-keys="selectedKeys"
    :open-keys="openKeys"
    :is-mobile="isMobile"
    :logo="appStore.layoutSetting.logo"
    :title="appStore.layoutSetting.title"
    @update:open-keys="layoutMenu.handleOpenKeys"
    @update:selected-keys="layoutMenu.handleSelectedKeys"
    @update:collapsed="appStore.toggleCollapsed"
  >
    <template #headerActions>
      <UserAvatar />
    </template>
    <a-watermark class="h-100%" content="Antdv Admin Pro">
      <RouterView />
    </a-watermark>
  </BasicLayout>
  <SettingDrawer
    v-model:open="appStore.layoutSetting.drawerVisible"
    :theme="appStore.layoutSetting.theme"
    :color-primary="appStore.layoutSetting.colorPrimary"
    :color-weak="appStore.layoutSetting.colorWeak"
    v-bind="layoutProps"
    @setting-change="appStore.changeSettingLayout"
  />
</template>

<style scoped>

</style>

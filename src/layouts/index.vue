<script setup lang="ts">
import { pick } from '@v-c/utils'
import BasicLayout from './basic-layout/index.vue'
import SettingDrawer from './components/setting-drawer/index.vue'
const appStore = useAppStore()
const userStore = useUserStore()
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
  <!-- <a-watermark class="h-100%" content="Antdv Admin Pro"> -->
  <BasicLayout
    :collapsed="appStore.layoutSetting.collapsed"
    :theme="appStore.layoutSetting.theme"
    :menu-data="userStore.menuData"
    v-bind="layoutProps"
    :is-mobile="isMobile"
    @update:collapsed="appStore.toggleCollapsed"
  >
    <template #headerActions>
      <UserAvatar />
    </template>
    <RouterView />
  </BasicLayout>
  <SettingDrawer
    v-model:open="appStore.layoutSetting.drawerVisible"
    :theme="appStore.layoutSetting.theme"
    :color-primary="appStore.layoutSetting.colorPrimary"
    :color-weak="appStore.layoutSetting.colorWeak"
    v-bind="layoutProps"
    @setting-change="appStore.changeSettingLayout"
  />
  <!-- </a-watermark> -->
</template>

<style scoped>

</style>

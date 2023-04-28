<script setup lang="ts">
import BasicLayout from './basic-layout/index.vue'
import SettingDrawer from './components/setting-drawer/index.vue'
const appStore = useAppStore()
const { isMobile, isPad } = useQueryBreakpoints()
watch(isPad, (val) => {
  if (val)
    appStore.toggleCollapsed(true)
  else
    appStore.toggleCollapsed(false)
})
</script>

<template>
  <!-- <a-watermark class="h-100%" content="Antdv Admin Pro"> -->
  <BasicLayout
    :collapsed="appStore.layoutSetting.collapsed"
    :theme="appStore.layoutSetting.theme"
    :layout="appStore.layoutSetting.layout"
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
    :layout="appStore.layoutSetting.layout"
    :color-primary="appStore.layoutSetting.colorPrimary"
    :content-width="appStore.layoutSetting.contentWidth"
    @setting-change="appStore.changeSettingLayout"
  />
  <!-- </a-watermark> -->
</template>

<style scoped>

</style>

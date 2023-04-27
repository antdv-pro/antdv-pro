<script setup lang="ts">
import BasicLayout from './basic-layout/index.vue'
import SettingDrawer from './components/setting-drawer/index.vue'
const appStore = useAppStore()
</script>

<template>
  <!-- <a-watermark class="h-100%" content="Antdv Admin Pro"> -->
  <BasicLayout v-model:collapsed="appStore.layoutSetting.collapsed" :theme="appStore.layoutSetting.theme">
    <template #headerActions>
      <UserAvatar />
    </template>
    <RouterView />
  </BasicLayout>
  <SettingDrawer v-model:open="appStore.layoutSetting.drawerVisible" :theme="appStore.layoutSetting.theme" @setting-change="appStore.changeSettingLayout" />
  <!-- </a-watermark> -->
</template>

<style scoped>

</style>

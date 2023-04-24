<script setup lang="ts">
import BasicLayout from './basic-layout/index.vue'
const appStore = useAppStore()
</script>

<template>
  <a-watermark class="h-100%" content="Antdv Admin Pro">
    <BasicLayout :collapsed="appStore.layoutSetting.collapsed">
      <RouterView />
    </BasicLayout>
  </a-watermark>
</template>

<style scoped>

</style>

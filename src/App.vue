<script setup lang="ts">
const appStore = useAppStore()
const { theme } = storeToRefs(appStore)
const { antd } = useI18nLocale()
</script>

<template>
  <a-config-provider :theme="theme" :locale="antd">
    <RouterView />
  </a-config-provider>
</template>

<script setup lang="ts">
const appStore = useAppStore()
const { theme } = storeToRefs(appStore)
const { antd } = useI18nLocale()
</script>

<template>
  <a-config-provider :theme="theme" :locale="antd">
    <TokenProvider>
      <RouterView />
    </TokenProvider>
  </a-config-provider>
</template>

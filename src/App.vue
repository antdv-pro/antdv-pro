<script setup lang="ts">
const appStore = useAppStore()
const { theme } = storeToRefs(appStore)
const { antd } = useI18nLocale()
</script>

<template>
  <a-config-provider :theme="theme" :locale="antd">
    <a-app class="h-full font-chinese antialiased">
      <TokenProvider>
        <RouterView />
      </TokenProvider>
    </a-app>
  </a-config-provider>
</template>

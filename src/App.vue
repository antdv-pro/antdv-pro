<script setup lang="ts">
const appStore = useAppStore()
const { theme } = storeToRefs(appStore)
</script>

<template>
  <a-config-provider :theme="theme">
    <RouterView />
  </a-config-provider>
</template>

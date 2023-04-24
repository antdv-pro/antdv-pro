<script setup lang="ts">
const appStore = useAppStore()
</script>

<template>
  <a-config-provider
    :theme="appStore.theme"
  >
    <RouterView />
  </a-config-provider>
</template>

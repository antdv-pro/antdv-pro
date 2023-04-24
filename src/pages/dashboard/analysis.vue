<script setup lang="ts">
const appStore = useAppStore()
</script>

<template>
  <div>
    <a-button @click="appStore.toggleTheme('light')">
      亮色
    </a-button>
    <a-button @click="appStore.toggleTheme('dark')">
      暗色
    </a-button>
  </div>
</template>

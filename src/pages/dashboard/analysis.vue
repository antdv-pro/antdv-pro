<script setup lang="ts">
const appStore = useAppStore()
</script>

<template>
  <div p-2>
    <a-space>
      <a-button type="primary" @click="appStore.toggleTheme('light')">
        亮色
      </a-button>
      <a-button @click="appStore.toggleTheme('dark')">
        暗色
      </a-button>
      <a-checkbox />
    </a-space>
  </div>
</template>

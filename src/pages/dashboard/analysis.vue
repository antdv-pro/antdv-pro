<script setup lang="ts">
const appStore = useAppStore()
</script>

<template>
  <div p-2>
    <a-space>
      <a-button @click="appStore.toggleTheme('light')">
        亮色
      </a-button>
      <a-button @click="appStore.toggleTheme('dark')">
        暗色
      </a-button>
    </a-space>
    <div class="h-500px w-100% bg-red">
      red
    </div>
    <div class="h-500px w-100% bg-green">
      green
    </div>
  </div>
</template>

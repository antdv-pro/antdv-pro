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
    <div mt-2>
      <a-space>
        <a-button @click="appStore.toggleCollapsed(false)">
          展开
        </a-button>
        <a-button @click="appStore.toggleCollapsed(true)">
          收起
        </a-button>
      </a-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import BasicLayout from './basic-layout/index.vue'
</script>

<template>
  <a-watermark class="h-100%" content="Antdv Admin Pro">
    <BasicLayout>
      <RouterView />
    </BasicLayout>
  </a-watermark>
</template>

<style scoped>

</style>

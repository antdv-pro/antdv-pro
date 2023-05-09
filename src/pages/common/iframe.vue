<script setup lang="ts">
const route = useRoute()
const url = computed(() => route?.meta?.url)
</script>

<template>
  <div
    :key="url"
    class="bg-[var(--bg-color)]"
    w-full h-full b-rd-8px of-hidden
    flex flex-col flex-1
  >
    <iframe w-full h-full flex flex-col flex-1 :src="url" style="border: none" />
  </div>
</template>

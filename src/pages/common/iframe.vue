<script setup lang="ts">
const route = useRoute()
const url = route?.meta?.url
</script>

<template>
  <div class="bg-[var(--bg-color)] w-100% h-100%" b-rd-8px of-hidden>
    <iframe class=" w-100% h-100%" :src="url" style="border: none" />
  </div>
</template>

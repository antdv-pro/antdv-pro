<script setup lang="ts">
</script>

<template>
  <RouterView>
    <template #default="{ Component, route }">
      <Transition appear name="slide-fadein-right" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </Transition>
    </template>
  </RouterView>
</template>

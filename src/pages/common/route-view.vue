<script setup lang="ts">
</script>

<template>
  <RouterView>
    <template #default="{ Component }">
      <Transition appear name="slide-fadein-right">
        <component :is="Component" />
      </Transition>
    </template>
  </RouterView>
</template>

<script setup lang="ts">
</script>

<template>
  <RouterView>
    <template #default="{ Component, route }">
      <Transition appear name="slide-fadein-right">
        <KeepAlive>
          <component :is="Component" :key="route.fullPath" />
        </KeepAlive>
      </Transition>
    </template>
  </RouterView>
</template>

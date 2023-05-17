<script setup lang="ts">
const appStore = useAppStore()
const { layoutSetting } = storeToRefs(appStore)
const multiTabStore = useMultiTab()
const { cacheList } = storeToRefs(multiTabStore)
</script>

<template>
  <RouterView>
    <template #default="{ Component, route }">
      <Transition appear name="slide-fadein-right">
        <KeepAlive v-if="layoutSetting.keepAlive" :include="cacheList">
          <component :is="Component" :key="route.fullPath" />
        </KeepAlive>
        <component :is="Component" v-else :key="route.fullPath" />
      </Transition>
    </template>
  </RouterView>
</template>

<script setup lang="ts">
defineOptions({
  name: 'CustomRouteView',
})

const appStore = useAppStore()
const { layoutSetting } = storeToRefs(appStore)
const multiTabStore = useMultiTab()
const { cacheList } = storeToRefs(multiTabStore)
const { getComp } = useCompConsumer()
</script>

<template>
  <!-- <ParentCompConsumer> -->
  <RouterView>
    <template #default="{ Component, route }">
      <Transition appear :name="layoutSetting.animationName" mode="out-in">
        <KeepAlive v-if="layoutSetting.keepAlive">
          <component :is="Component" />
        </KeepAlive>
        <component :is="Component" v-else :key="route.fullPath" />
      </Transition>
    </template>
  </RouterView>
  <!-- </ParentCompConsumer> -->
</template>

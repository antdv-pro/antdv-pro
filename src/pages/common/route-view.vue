<script setup lang="ts">
import { CompConsumer } from '@/layouts/basic-layout/comp-consumer'
const appStore = useAppStore()
const { layoutSetting } = storeToRefs(appStore)
</script>

<template>
  <RouterView>
    <template #default="{ Component, route }">
      <Transition appear :name="layoutSetting.animationName" mode="out-in">
        <CompConsumer v-if="layoutSetting.keepAlive" :component="Component" />
        <component :is="Component" v-else :key="route.fullPath" />
      </Transition>
    </template>
  </RouterView>
</template>

<script setup lang="ts">
import { CompConsumer } from '@/layouts/basic-layout/comp-consumer'
import { ParentCompConsumer } from '@/layouts/basic-layout/parent-comp-consumer'
const appStore = useAppStore()
const { layoutSetting } = storeToRefs(appStore)
</script>

<template>
  <ParentCompConsumer>
    <RouterView>
      <template #default="{ Component, route }">
        <Transition appear :name="layoutSetting.animationName" mode="out-in">
          <CompConsumer v-if="layoutSetting.keepAlive" :component="Component" />
          <component :is="Component" v-else :key="route.fullPath" />
        </Transition>
      </template>
    </RouterView>
  </ParentCompConsumer>
</template>

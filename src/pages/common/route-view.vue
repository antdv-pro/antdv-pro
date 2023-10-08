<script setup lang="ts">
import { ParentCompConsumer } from '@/layouts/basic-layout/parent-comp-consumer'

const appStore = useAppStore()
const { layoutSetting } = storeToRefs(appStore)
const multiTabStore = useMultiTab()
const { cacheList } = storeToRefs(multiTabStore)
const { getComp } = useCompConsumer()
</script>

<template>
  <ParentCompConsumer>
    <RouterView>
      <template #default="{ Component, route }">
        <Transition appear :name="layoutSetting.animationName" mode="out-in">
          <KeepAlive v-if="layoutSetting.keepAlive" :include="cacheList">
            <component :is="getComp(Component)" :key="route.fullPath" />
          </KeepAlive>
          <component :is="Component" v-else :key="route.fullPath" />
        </Transition>
      </template>
    </RouterView>
  </ParentCompConsumer>
</template>

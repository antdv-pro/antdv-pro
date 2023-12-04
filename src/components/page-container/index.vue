<script setup lang="ts">
import { isFunction } from '@v-c/utils'
import type { VNodeChild } from 'vue'
import { useLayoutState } from '~/layouts/basic-layout/context'

defineProps<{
  title?: string
}>()
defineSlots<{
  default(props: any): any
  title(props: any): any
  content(props: any): any
  extraContent(props: any): any
  extra(props: any): any
  footer(props: any): any
}>()
const layoutMenuStore = useLayoutMenu()
const appStore = useAppStore()
const { layoutSetting } = storeToRefs(appStore)
const { menuDataMap, selectedKeys } = storeToRefs(layoutMenuStore)
const currentItem = computed(() => {
  const key: string = selectedKeys.value.length ? selectedKeys.value[0] : ''
  if (key && menuDataMap.value.has(key))
    return menuDataMap.value.get(key)
  return {} as any
})
const { contentWidth, hasPageContainer } = useLayoutState()
hasPageContainer.value = true

onUnmounted(() => {
  setTimeout(() => {
    hasPageContainer.value = false
  }, 280)
})

onActivated(() => {
  hasPageContainer.value = true
})
onDeactivated(() => {
  setTimeout(() => {
    hasPageContainer.value = false
  }, 280)
})
const contentCls = computed(() => {
  const cls: string[] = [
    'flex flex-col flex-1',
  ]
  if (contentWidth.value === 'Fluid')
    cls.push('w-full')

  else if (contentWidth.value === 'Fixed')
    cls.push(...['max-w-1200px w-1200px', 'mx-auto'])

  return cls
})
function renderTitle(title: VNodeChild | (() => VNodeChild)) {
  if (isFunction(title))
    return title()

  return title
}
</script>

<template>
  <div>
    <div v-if="hasPageContainer" class="bg-[var(--bg-color)]" :class="layoutSetting.multiTab ? 'pb-16px' : 'py-16px'" px-24px mb-24px mx--24px mt--24px>
      <a-breadcrumb v-if="!currentItem.hideInBreadcrumb">
        <template v-if="currentItem.matched?.length">
          <a-breadcrumb-item v-for="item in currentItem.matched" :key="item.path">
            {{ renderTitle(item.title) }}
          </a-breadcrumb-item>
        </template>
        <a-breadcrumb-item>
          {{ renderTitle(currentItem.title) }}
        </a-breadcrumb-item>
      </a-breadcrumb>
      <div flex mt-8px justify-between>
        <div flex items-center my-4px of-hidden>
          <slot name="title">
            <span text-20px line-height-32px mr-12px mb-0 truncate font-600>{{ renderTitle(title ?? currentItem.title) }}</span>
          </slot>
        </div>
        <div>
          <slot name="extra" />
        </div>
      </div>
      <div v-if="$slots.content || $slots.extraContent" pt-12px>
        <div flex w-full>
          <div flex-auto>
            <slot name="content" />
          </div>
          <div flex-shrink-0>
            <slot name="extraContent" />
          </div>
        </div>
      </div>
      <slot name="footer" />
    </div>
    <div :class="contentCls">
      <slot />
    </div>
  </div>
</template>

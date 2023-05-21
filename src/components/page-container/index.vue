<script setup lang="ts">
import { delayTimer } from '@v-c/utils'
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
}>()
const layoutMenuStore = useLayoutMenu()
const { menuDataMap, selectedKeys } = storeToRefs(layoutMenuStore)
const currentItem = computed(() => {
  const key: string = selectedKeys.value.length ? selectedKeys.value[0] : ''
  if (key && menuDataMap.value.has(key))
    return menuDataMap.value.get(key)
  return {} as any
})
const { contentWidth, hasPageContainer } = useLayoutState()

onMounted(async () => {
  await delayTimer(300)
  hasPageContainer.value = true
})
onUnmounted(async () => {
  await delayTimer(300)
  hasPageContainer.value = false
})
onActivated(async () => {
  await delayTimer(300)
  hasPageContainer.value = true
})
onDeactivated(async () => {
  await delayTimer(300)
  hasPageContainer.value = false
})
const contentCls = computed(() => {
  const cls: string[] = [
    'h-full flex flex-col flex-1',
  ]
  if (contentWidth.value === 'Fluid')
    cls.push('w-full')

  else if (contentWidth.value === 'Fixed')
    cls.push(...['max-w-1200px w-1200px', 'mx-auto'])

  return cls
})
</script>

<template>
  <div>
    <div class="bg-[var(--bg-color)]" px-24px pb-16px mb-24px mx--24px mt--24px>
      <a-breadcrumb v-if="!currentItem.hideInBreadcrumb">
        <template v-if="currentItem.matched?.length">
          <a-breadcrumb-item v-for="item in currentItem.matched" :key="item.path">
            {{ item.title }}
          </a-breadcrumb-item>
        </template>
        <a-breadcrumb-item>
          {{ currentItem.title }}
        </a-breadcrumb-item>
      </a-breadcrumb>
      <div flex mt-8px justify-between>
        <div flex items-center my-4px of-hidden>
          <slot name="title">
            <span text-20px line-height-32px mr-12px mb-0 truncate font-600>{{ title ?? currentItem.title }}</span>
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
    </div>
    <div :class="contentCls">
      <slot />
    </div>
  </div>
</template>

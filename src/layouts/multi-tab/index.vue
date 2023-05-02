<script lang="ts" setup>
import type { CSSProperties } from 'vue'
import { CloseOutlined, ReloadOutlined } from '@ant-design/icons-vue'

const { list, activeKey } = storeToRefs(useMultiTab())
const { layoutSetting } = storeToRefs(useAppStore())
const tabStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {}
  if (layoutSetting.value.multiTabFixed) {
    style.position = 'fixed'
    style.top = `${layoutSetting.value.headerHeight}px`
  }

  return style
})
const tabsRef = shallowRef()
const { height } = useElementSize(tabsRef)
</script>

<template>
  <div v-if="layoutSetting.multiTabFixed" :style="{ height: `${height + 10}px` }" />
  <a-tabs
    ref="tabsRef"
    v-model:activeKey="activeKey"
    :style="tabStyle"
    class="bg-white dark:bg-#242525 w-100%"
    pt-10px
    type="card"
    :tab-bar-gutter="5"
  >
    <a-tab-pane v-for="item in list" :key="item.fullPath">
      <template #tab>
        {{ item.title }}
        <button class="ant-tabs-tab-remove" style="margin: 0;">
          <ReloadOutlined :spin="item.loading" />
        </button>
        <button v-if="!item.affix && list.length > 1" class="ant-tabs-tab-remove" style="margin: 0;">
          <CloseOutlined />
        </button>
      </template>
    </a-tab-pane>
    <template #leftExtra>
      <div class="w-24px" />
    </template>
    <template #rightExtra>
      <div class="w-48px" />
    </template>
  </a-tabs>
</template>

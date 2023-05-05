<script lang="ts" setup>
import type { CSSProperties } from 'vue'
import { CloseOutlined, ReloadOutlined } from '@ant-design/icons-vue'
const multiTabStore = useMultiTab()
const { list, activeKey } = storeToRefs(multiTabStore)
const { layoutSetting } = storeToRefs(useAppStore())
const tabStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {}
  if (layoutSetting.value.multiTabFixed) {
    style.position = 'fixed'
    style.top = `${layoutSetting.value.headerHeight}px`
    style.zIndex = 1
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
    :active-key="activeKey"
    :style="tabStyle"
    class="bg-white dark:bg-#242525 w-100%"
    pt-10px
    type="card"
    :tab-bar-gutter="5"
    @update:active-key="multiTabStore.switchTab"
  >
    <a-tab-pane v-for="item in list" :key="item.fullPath">
      <template #tab>
        {{ item.title }}
        <button v-if="activeKey === item.fullPath" class="ant-tabs-tab-remove" style="margin: 0;" @click.stop="multiTabStore.refresh(item.fullPath)">
          <ReloadOutlined :spin="item.loading" />
        </button>
        <button v-if="!item.affix && list.length > 1" class="ant-tabs-tab-remove" style="margin: 0;" @click.stop="multiTabStore.close(item.fullPath)">
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

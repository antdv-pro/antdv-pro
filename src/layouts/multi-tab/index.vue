<script lang="ts" setup>
import type { CSSProperties } from 'vue'
import { CloseOutlined, MoreOutlined, ReloadOutlined } from '@ant-design/icons-vue'
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

const handleSwitch = ({ key }: any, current: string) => {
  if (key === 'closeCurrent')
    multiTabStore.close(activeKey.value)
  else if (key === 'closeLeft')
    multiTabStore.closeLeft(current)
  else if (key === 'closeRight')
    multiTabStore.closeRight(current)
  else if (key === 'closeOther')
    multiTabStore.closeOther(current)
  else if (key === 'refresh')
    multiTabStore.refresh(activeKey.value)
}

const isCurrentDisabled = computed(() => {
  return list.value.length === 1 || (list.value.filter(v => !v.affix).length <= 1)
})

const leftDisabled = (key: string) => {
  // 判断左侧是否还有可关闭的
  const index = list.value.findIndex(v => v.fullPath === key)
  return index === 0 || (list.value.filter(v => !v.affix).length <= 1)
}

const rightDisabled = (key: string) => {
  // 判断右侧是否还有可关闭的
  const index = list.value.findIndex(v => v.fullPath === key)
  return index === list.value.length - 1 || (list.value.filter(v => !v.affix).length <= 1)
}
const otherDisabled = computed(() => {
  return list.value.length === 1 || (list.value.filter(v => !v.affix).length <= 1)
})
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
    size="small"
    :tab-bar-gutter="5"
    @update:active-key="multiTabStore.switchTab"
  >
    <a-tab-pane v-for="item in list" :key="item.fullPath">
      <template #tab>
        <a-dropdown :trigger="['contextmenu']">
          <div>
            {{ item.title }}
            <button v-if="activeKey === item.fullPath" class="ant-tabs-tab-remove" style="margin: 0;" @click.stop="multiTabStore.refresh(item.fullPath)">
              <ReloadOutlined :spin="item.loading" />
            </button>
            <button v-if="!item.affix && list.length > 1" class="ant-tabs-tab-remove" style="margin: 0;" @click.stop="multiTabStore.close(item.fullPath)">
              <CloseOutlined />
            </button>
          </div>
          <template #overlay>
            <a-menu @click="handleSwitch($event, item.fullPath)">
              <a-menu-item key="closeCurrent" :disabled="isCurrentDisabled || activeKey !== item.fullPath">
                关闭当前
              </a-menu-item>
              <a-menu-item key="closeLeft" :disabled="isCurrentDisabled || leftDisabled(item.fullPath)">
                关闭左侧
              </a-menu-item>
              <a-menu-item key="closeRight" :disabled="isCurrentDisabled || rightDisabled(item.fullPath)">
                关闭右侧
              </a-menu-item>
              <a-menu-item key="closeOther" :disabled="isCurrentDisabled || otherDisabled">
                关闭其他
              </a-menu-item>
              <a-menu-item key="refresh">
                刷新当前
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </template>
    </a-tab-pane>
    <template #leftExtra>
      <div class="w-24px" />
    </template>
    <template #rightExtra>
      <div class="w-48px">
        <a-dropdown :trigger="['hover']">
          <MoreOutlined class="text-16px" />
          <template #overlay>
            <a-menu @click="handleSwitch($event, activeKey)">
              <a-menu-item key="closeOther" :disabled="isCurrentDisabled || otherDisabled">
                关闭其他
              </a-menu-item>
              <a-menu-item key="refresh">
                刷新当前
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </template>
  </a-tabs>
</template>

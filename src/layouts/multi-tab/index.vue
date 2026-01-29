<script lang="ts" setup>
import type { CSSProperties } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'
import {
  CloseOutlined,
  MoreOutlined,
  ReloadOutlined,
} from '@antdv-next/icons'
import { listenerRouteChange, removeRouteListener } from '~@/utils/route-listener'
import { useLayoutState } from '~/layouts/basic-layout/context'

const multiTabStore = useMultiTab()
const { list, activeKey } = storeToRefs(multiTabStore)
const { layoutSetting } = storeToRefs(useAppStore())
const { t } = useI18n()
const {
  layout,
} = useLayoutState()
const tabStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {}
  if (layoutSetting.value.multiTabFixed) {
    style.position = 'sticky'
    style.top = `${layoutSetting.value.headerHeight}px`
    style.zIndex = 3
    style.right = 0
  }
  // bugfix https://github.com/antdv-pro/antdv-pro/issues/173
  if (layoutSetting.value.header === false || (layout.value !== 'mix' && layoutSetting.value.fixedHeader === false))
    style.top = '0px'

  return style
})
const tabsRef = shallowRef()
const tabItems = computed(() =>
  list.value.map(item => ({
    key: item.fullPath,
    label: item.locale ? t(item.locale) : item.title,
    tabData: item,
  })),
)
const resolveTabTitle = (item: any) => (item?.locale ? t(item.locale) : item?.title)

function handleSwitch({ key }: any, current: string) {
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
  return (
    list.value.length === 1 || list.value.filter(v => !v.affix).length <= 1
  )
})

function leftDisabled(key: string) {
  // 判断左侧是否还有可关闭的
  const index = list.value.findIndex(v => v.fullPath === key)
  return index === 0 || list.value.filter(v => !v.affix).length <= 1
}

function rightDisabled(key: string) {
  // 判断右侧是否还有可关闭的
  const index = list.value.findIndex(v => v.fullPath === key)
  return (
    index === list.value.length - 1
    || list.value.filter(v => !v.affix).length <= 1
  )
}
const otherDisabled = computed(() => {
  return (
    list.value.length === 1 || list.value.filter(v => !v.affix).length <= 1
  )
})

function contextMenuItems(current: string) {
  return [
    {
      key: 'closeCurrent',
      label: t('app.multiTab.closeCurrent'),
      disabled: isCurrentDisabled.value || activeKey.value !== current,
    },
    {
      key: 'closeLeft',
      label: t('app.multiTab.closeLeft'),
      disabled: isCurrentDisabled.value || leftDisabled(current),
    },
    {
      key: 'closeRight',
      label: t('app.multiTab.closeRight'),
      disabled: isCurrentDisabled.value || rightDisabled(current),
    },
    {
      key: 'closeOther',
      label: t('app.multiTab.closeOther'),
      disabled: isCurrentDisabled.value || otherDisabled.value,
    },
    {
      key: 'refresh',
      label: t('app.multiTab.refresh'),
      disabled: !isCurrentDisabled.value,
    },
  ]
}

const moreMenuItems = computed(() => [
  {
    key: 'closeOther',
    label: t('app.multiTab.closeOther'),
    disabled: isCurrentDisabled.value || otherDisabled.value,
  },
  {
    key: 'refresh',
    label: t('app.multiTab.refresh'),
  },
])
listenerRouteChange((route: RouteLocationNormalized) => {
  if (route.fullPath.startsWith('/redirect'))
    return
  const item = list.value.find(item => item.fullPath === route.fullPath)

  if (route.fullPath === activeKey.value && !item?.loading)
    return
  activeKey.value = route.fullPath
  multiTabStore.addItem(route)
}, true)
onUnmounted(() => {
  removeRouteListener()
})
</script>

<template>
  <a-tabs
    ref="tabsRef"
    :active-key="activeKey"
    :style="tabStyle"
    class=" bg-white dark:bg-#242525 w-100% pro-ant-multi-tab"
    pt-10px
    type="card"
    size="small"
    :tab-bar-gutter="5"
    :items="tabItems"
    @update:active-key="multiTabStore.switchTab"
  >
    <template #labelRender="{ item }">
      <a-dropdown :trigger="['contextMenu']">
        <div>
          {{ resolveTabTitle(item.tabData) }}
          <button
            v-if="activeKey === item.key"
            class="ant-tabs-tab-remove"
            style="margin: 0"
            @click.stop="multiTabStore.refresh(item.key)"
          >
            <ReloadOutlined :spin="item.tabData?.loading" />
          </button>
          <button
            v-if="!item.tabData?.affix && list.length > 1"
            class="ant-tabs-tab-remove"
            style="margin: 0"
            @click.stop="multiTabStore.close(item.key)"
          >
            <CloseOutlined />
          </button>
        </div>
        <template #overlay>
          <a-menu
            :items="contextMenuItems(item.key)"
            @click="handleSwitch($event, item.key)"
          />
        </template>
      </a-dropdown>
    </template>
    <template #leftExtra>
      <div class="w-24px" />
    </template>
    <template #rightExtra>
      <div class="w-48px flex item-center justify-center">
        <a-dropdown :trigger="['hover']">
          <MoreOutlined class="text-16px" />
          <template #overlay>
            <a-menu
              :items="moreMenuItems"
              @click="handleSwitch($event, activeKey)"
            />
          </template>
        </a-dropdown>
      </div>
    </template>
  </a-tabs>
</template>

<style lang="less">
.pro-ant-multi-tab {
  transition: all 0.3s;
  .ant-tabs-nav-operations {
    display: none !important;
  }
}
</style>

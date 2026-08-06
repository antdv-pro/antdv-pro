<script setup lang="ts">
import type { VNodeChild } from 'vue'
import type { MenuDataItem } from '~@/layouts/basic-layout/typing'
import { isFunction, isUrl } from '@v-c/utils'
import AsyncIcon from './async-icon.vue'

withDefaults(defineProps<{ item: MenuDataItem, link?: boolean }>(), {
  link: true,
})
function renderTitle(title: VNodeChild | (() => VNodeChild)) {
  if (isFunction(title))
    return title()

  return title
}

function hasVisibleChildren(item: MenuDataItem) {
  return (item.children ?? []).some(menu => !menu.hideInMenu)
}

function visibleChildren(item: MenuDataItem) {
  return (item.children ?? []).filter(menu => !menu.hideInMenu)
}
</script>

<template>
  <template v-if="hasVisibleChildren(item) && !item.hideChildrenInMenu">
    <a-sub-menu :key="item.path">
      <template v-if="item.icon" #icon>
        <AsyncIcon :icon="item.icon" />
      </template>
      <template #title>
        {{ renderTitle(item.title) }}
      </template>
      <template v-for="menu in visibleChildren(item)" :key="menu.path">
        <sub-menu v-if="hasVisibleChildren(menu) && !menu.hideChildrenInMenu" :item="menu" />
        <a-menu-item v-else :key="menu.path">
          <template v-if="menu.icon" #icon>
            <AsyncIcon :icon="menu.icon" />
          </template>
          <template v-if="!isUrl(menu.path)">
            <RouterLink v-if="link" :to="menu.path">
              {{ renderTitle(menu.title) }}
            </RouterLink>
            <template v-else>
              {{ renderTitle(menu.title) }}
            </template>
          </template>
          <template v-else>
            <a :href="menu.path" :target="menu.target ?? '_blank'">
              {{ renderTitle(menu.title) }}
            </a>
          </template>
        </a-menu-item>
      </template>
    </a-sub-menu>
  </template>
  <template v-else>
    <a-menu-item :key="item.path">
      <template v-if="item.icon" #icon>
        <AsyncIcon :icon="item.icon" />
      </template>
      <template v-if="!isUrl(item.path)">
        <RouterLink v-if="link" :to="item.path">
          {{ renderTitle(item.title) }}
        </RouterLink>
        <template v-else>
          {{ renderTitle(item.title) }}
        </template>
      </template>
      <template v-else>
        <a :href="item.path" :target="item.target ?? '_blank'">
          {{ renderTitle(item.title) }}
        </a>
      </template>
    </a-menu-item>
  </template>
</template>

<script setup lang="ts">
import AsyncIcon from './async-icon.vue'
import type { MenuDataItem } from '~@/layouts/basic-layout/typing'
defineProps<{ item: MenuDataItem }>()
</script>

<template>
  <template v-if="item.children && !item.hideChildrenInMenu">
    <a-sub-menu :key="item.path">
      <template v-if="item.icon" #icon>
        <AsyncIcon :icon="item.icon" />
      </template>
      <template #title>
        {{ item.title }}
      </template>
      <template v-for="menu in item.children">
        <template v-if="!menu.hideInMenu">
          <template v-if="menu.children">
            <sub-menu :key="menu.path" :item="menu" />
          </template>
          <template v-else>
            <a-menu-item :key="menu.path">
              <template v-if="menu.icon" #icon>
                <AsyncIcon :icon="menu.icon" />
              </template>
              <RouterLink :to="menu.path">
                {{ menu.title }}
              </RouterLink>
            </a-menu-item>
          </template>
        </template>
      </template>
    </a-sub-menu>
  </template>
  <template v-else>
    <a-menu-item :key="item.path">
      <template v-if="item.icon" #icon>
        <AsyncIcon :icon="item.icon" />
      </template>
      {{ item.title }}
    </a-menu-item>
  </template>
</template>

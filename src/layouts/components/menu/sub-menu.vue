<script setup>
import { isFunction, isUrl } from '@v-c/utils'
import AsyncIcon from './async-icon.vue'

defineProps({
  item: { type: Object, required: true },
  link: { type: Boolean, required: false, default: true },
})
function renderTitle(title) {
  if (isFunction(title))
    return title()
  return title
}
</script>

<template>
  <template v-if="item.children && !item.hideChildrenInMenu">
    <a-sub-menu :key="item.path">
      <template v-if="item.icon" #icon>
        <AsyncIcon :icon="item.icon" />
      </template>
      <template #title>
        {{ renderTitle(item.title) }}
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
        </template>
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

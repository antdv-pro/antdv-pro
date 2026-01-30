<script setup lang="ts">
import { h } from 'vue'

const { locale, setLocale } = useI18nLocale()
function handleClick({ key }: any) {
  setLocale(key)
}

const menuItems = [
  {
    key: 'zh-CN',
    label: '简体中文',
    icon: h('span', '🇨🇳'),
  },
  {
    key: 'en-US',
    label: 'English',
    icon: h('span', '🇺🇸'),
  },
]
</script>

<template>
  <a-dropdown>
    <span hover="bg-[var(--hover-color)]" flex items-center h-48px px-12px text-16px cursor-pointer class="transition-all-300">
      <CarbonLanguage class="anticon" />
    </span>
    <template #popupRender>
      <a-menu :selected-keys="[locale]" :items="menuItems" @click="handleClick" />
    </template>
  </a-dropdown>
</template>

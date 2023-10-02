<script setup lang="ts">
// @unocss-include
import { icons as vscodeIcons } from '@iconify-json/vscode-icons'
defineOptions({
  name: 'FeatIcon',
})

const icons = computed(() => {
  const iconsNames = Object.keys(vscodeIcons.icons)
  return iconsNames.slice(0, 21).map(icon => `i-vscode-icons:${icon}`)
})
console.log(icons)
</script>

<template>
  <div>
    <a-card title="unocss使用svg">
      <a-card-grid style="width: 25%">
        <div class="flex justify-between items-center">
          <span>使用本地图标</span>
          <span class="i-custom:10k" />
        </div>
      </a-card-grid>
      <a-card-grid style="width: 25%">
        <div class="flex justify-between items-center">
          <span>使用本地图标</span>
          <span class="i-custom:10k?mask text-red-300" />
        </div>
      </a-card-grid>
      <a-card-grid style="width: 25%; text-align: center">
        <div class="flex justify-between items-center">
          <span>使用iconify 图标集</span>

          <div class="i-vscode-icons:file-type-light-pnpm" />
        </div>
      </a-card-grid>
      <a-card-grid style="width: 25%; text-align: center">
        <div class="flex justify-between items-center">
          <span>使用iconify 图标集</span>

          <div class="i-vscode-icons:file-type-light-pnpm?mask text-red-300" />
        </div>
      </a-card-grid>
    </a-card>

    <a-card title="iconify-json/vscode-icons 图标集" class="mt5">
      <a-card-grid v-for="(icon, idx) in icons" :key="idx" style="width: 25%">
        <div :class="[icon]" />
      </a-card-grid>
    </a-card>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { icons as vscodeIcons } from '@iconify-json/vscode-icons'
defineOptions({
  name: 'FeatIcon',
})

const dynamicIcons = computed(() => {
  const iconsNames = Object.keys(vscodeIcons.icons)
  return iconsNames.slice(0, 21).map(icon => `i-${vscodeIcons.prefix}:${icon}`)
})

const icons = [
  'i-vscode-icons:file-type-antlr',
  'i-vscode-icons:file-type-anyscript',
  'i-vscode-icons:file-type-apache',
  'i-vscode-icons:file-type-apex',
  'i-vscode-icons:file-type-api-extractor',
  'i-vscode-icons:file-type-apib',
  'i-vscode-icons:file-type-apib2',
  'i-vscode-icons:file-type-apl',
  'i-vscode-icons:file-type-applescript',
  'i-vscode-icons:file-type-appscript',
  'i-vscode-icons:file-type-appsemble',
  'i-vscode-icons:file-type-appveyor',
  'i-vscode-icons:file-type-arduino',
  'i-vscode-icons:file-type-asciidoc',
  'i-vscode-icons:file-type-asp',
  'i-vscode-icons:file-type-aspx',
  'i-vscode-icons:file-type-assembly',
  'i-vscode-icons:file-type-astro',
  'i-vscode-icons:file-type-astroconfig',
  'i-vscode-icons:file-type-ats',
  'i-vscode-icons:file-type-audio',
  'i-vscode-icons:file-type-aurelia',
  'i-vscode-icons:file-type-autohotkey',
  'i-vscode-icons:file-type-autoit',
  'i-vscode-icons:file-type-avif',
  'i-vscode-icons:file-type-avro',
  'i-vscode-icons:file-type-awk',
  'i-vscode-icons:file-type-aws',
  'i-vscode-icons:file-type-azure',
  'i-vscode-icons:file-type-azurepipelines',
]
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
          <span>使用iconify 动态图标集</span>

          <div class="i-vscode-icons:file-type-light-pnpm?mask text-red-300" />
        </div>
      </a-card-grid>
    </a-card>

    <a-card title="动态加载 iconify-json/vscode-icons 图标集" class="mt5">
      <a-card-grid v-for="(icon, idx) in dynamicIcons" :key="idx" style="width: 25%">
        <div :class="[icon]" />
      </a-card-grid>
    </a-card>

    <a-card title="批量固定引入 iconify-json/vscode-icons 图标集" class="mt5">
      <a-card-grid v-for="(icon, idx) in icons" :key="idx" style="width: 25%">
        <div :class="[icon]" />
      </a-card-grid>
    </a-card>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import type { ContentWidth, LayoutType } from '../../basic-layout/typing'

const props = defineProps<{
  contentWidth?: ContentWidth
  layout?: LayoutType
}>()

const emit = defineEmits(['changeSetting'])
const list = computed(() => ([
  {
    title: '内容区域宽度',
    key: 'contentWidth',
    disabled: false,
    disabledReason: '',
  },
  {
    title: '固定 Header',
    key: 'fixedHeader',
    disabled: props.layout === 'mix',
    disabledReason: '',
  },
  {
    title: '固定侧边菜单',
    key: 'fixSiderbar',
    disabled: false,
    disabledReason: '',
  },
  {
    title: '自动分割菜单',
    key: 'splitMenus',
    disabled: false,
    disabledReason: '',
  },
]))
const handleChangeSetting = (key: string, value: any) => {
  emit('changeSetting', key, value)
}
</script>

<template>
  <a-list :data-source="list" :split="false">
    <template #renderItem="{ item }">
      <a-tooltip :title="item.disabled ? item.disabledReason : ''" placement="left">
        <a-list-item>
          <template #actions>
            <template v-if="item.key === 'contentWidth'">
              <a-select :value="contentWidth || 'Fluid'" @update:value="(e:string) => handleChangeSetting('contentWidth', e)">
                <a-select-option v-if="layout !== 'side'" value="Fixed">
                  Fixed
                </a-select-option>
                <a-select-option value="Fluid">
                  Fluid
                </a-select-option>
              </a-select>
            </template>
          </template>
          <span :style="{ opacity: item.disabled ? '0.5' : '1' }">
            {{ item.title }}
          </span>
        </a-list-item>
      </a-tooltip>
    </template>
  </a-list>
</template>

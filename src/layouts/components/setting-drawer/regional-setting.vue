<script setup lang="ts">
import type { LayoutType } from '../../basic-layout/typing'

const props = defineProps<{
  layout?: LayoutType
  header?: boolean
  footer?: boolean
  menu?: boolean
  menuHeader?: boolean

}>()

const emit = defineEmits(['changeSetting'])
const list = computed(() => ([
  {
    title: '顶栏',
    key: 'header',
    disabled: false,
    disabledReason: '',
  },
  {
    title: '页脚',
    key: 'footer',
    disabled: false,
    disabledReason: '',
  },
  {
    title: '菜单',
    key: 'menu',
    disabled: props.layout === 'top',
    disabledReason: '',
  },
  {
    title: '菜单头',
    key: 'menuHeader',
    disabled: props.layout !== 'mix',
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
            <a-switch
              size="small"
              :checked="(props as any)[item.key]"
              :disabled="item.disabled"
              @update:checked="(e:boolean) => handleChangeSetting(item.key, e)"
            />
          </template>
          <span :style="{ opacity: item.disabled ? '0.5' : '1' }">
            {{ item.title }}
          </span>
        </a-list-item>
      </a-tooltip>
    </template>
  </a-list>
</template>

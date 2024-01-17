<script setup lang="ts">
import type { CheckedType } from '~@/layouts/basic-layout/typing'

const props = defineProps<{
  colorWeak?: boolean
  colorGray?: boolean
  t?: (key: string, ...args: any[]) => string
}>()
const emit = defineEmits(['changeSetting'])
const list = computed(() => ([
  {
    title: 'weakmode',
    key: 'colorWeak',
    disabled: false,
    disabledReason: '',
  },
  {
    title: 'graymode',
    key: 'colorGray',
    disabled: false,
    disabledReason: '',
  },
]))
function handleToggleChange(key: string, value: CheckedType) {
  emit('changeSetting', key, value)
}
function isToggleChecked(key: string) {
  return Reflect.get(props, key)
}
</script>

<template>
  <a-list :data-source="list" :split="false">
    <template #renderItem="{ item }">
      <a-list-item>
        <template #actions>
          <a-switch
            size="small"
            :checked="isToggleChecked(item.key)"
            :disabled="item.disabled"
            @update:checked="handleToggleChange(item.key, $event)"
          />
        </template>
        <span :style="{ opacity: item.disabled ? '0.5' : '1' }">
          {{ t?.(`app.setting.${item.title}`, item.title) ?? item.title }}
        </span>
      </a-list-item>
    </template>
  </a-list>
</template>

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
  <div class="ant-list">
    <div
      v-for="item in list"
      :key="item.key"
      class="ant-list-item"
    >
      <div class="flex items-center justify-between w-full">
        <span :style="{ opacity: item.disabled ? '0.5' : '1' }">
          {{ t?.(`app.setting.${item.title}`, item.title) ?? item.title }}
        </span>
        <div class="ant-list-item-action">
          <a-switch
            size="small"
            :checked="isToggleChecked(item.key)"
            :disabled="item.disabled"
            @update:checked="handleToggleChange(item.key, $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

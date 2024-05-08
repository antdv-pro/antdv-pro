<script setup>
const props = defineProps({
  colorWeak: { type: Boolean, required: false },
  colorGray: { type: Boolean, required: false },
  t: { type: Function, required: false },
})
const emit = defineEmits(['changeSetting'])
const list = computed(() => [
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
])
function handleToggleChange(key, value) {
  emit('changeSetting', key, value)
}
function isToggleChecked(key) {
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

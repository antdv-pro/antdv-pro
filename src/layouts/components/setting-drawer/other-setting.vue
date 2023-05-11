<script setup lang="ts">
defineProps<{
  colorWeak?: boolean
  t?: (key: string, ...args: any[]) => string
}>()
const emit = defineEmits(['changeSetting'])
const list = computed(() => ([
  {
    title: '色弱模式',
    key: 'colorWeak',
    disabled: false,
    disabledReason: '',
  },
]))
const handleChangeWeak = (value: boolean) => {
  emit('changeSetting', 'colorWeak', value)

  const dom = document.querySelector('body')
  if (dom) {
    if (value) {
      dom.dataset.prosettingdrawer = dom.style.filter
      dom.style.filter = 'invert(80%)'
    }
    else {
      dom.style.filter = dom.dataset.prosettingdrawer || 'none'
      delete dom.dataset.prosettingdrawer
    }
  }
}
</script>

<template>
  <a-list :data-source="list" :split="false">
    <template #renderItem="{ item }">
      <a-list-item>
        <template #actions>
          <a-switch
            size="small"
            :checked="colorWeak"
            :disabled="item.disabled"
            @update:checked="handleChangeWeak"
          />
        </template>
        <span :style="{ opacity: item.disabled ? '0.5' : '1' }">
          {{ t?.("app.setting.weakmode", item.title) ?? item.title }}
        </span>
      </a-list-item>
    </template>
  </a-list>
</template>

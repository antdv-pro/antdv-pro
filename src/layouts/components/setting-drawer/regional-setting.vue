<script setup>
const props = defineProps({
  layout: { type: String, required: false },
  header: { type: Boolean, required: false },
  footer: { type: Boolean, required: false },
  menu: { type: Boolean, required: false },
  watermark: { type: Boolean, required: false },
  menuHeader: { type: Boolean, required: false },
  multiTab: { type: Boolean, required: false },
  multiTabFixed: { type: Boolean, required: false },
  animationName: { type: String, required: false },
  animationNameList: { type: Array, required: false },
  t: { type: Function, required: false },
})
const emit = defineEmits(['changeSetting'])
const list = computed(() => [
  {
    title: '动画',
    key: 'animationName',
    disabled: false,
    disabledReason: '',
  },
  {
    title: '水印',
    key: 'watermark',
    disabled: false,
    disabledReason: '',
  },
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
    disabled: false,
    disabledReason: '',
  },
  {
    title: '多页签',
    key: 'multiTab',
    disabled: false,
    disabledReason: '',
  },
  {
    title: '固定多页签',
    key: 'multiTabFixed',
    disabled: false,
    disabledReason: '多页签开启后功能正常使用',
  },
])
function handleChangeSetting(key, value) {
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
              v-if="item.key !== 'animationName'"
              size="small"
              :checked="props[item.key]"
              :disabled="item.disabled"
              @update:checked="(e) => handleChangeSetting(item.key, e)"
            />
            <a-select
              v-else style="width: 120px;"
              :value="animationName"
              :options="animationNameList" size="small"
              @update:value="(e) => handleChangeSetting(item.key, e)"
            />
          </template>
          <span :style="{ opacity: item.disabled ? '0.5' : '1' }">
            {{ t?.(`app.setting.content-area.${item.key}`, item.title) ?? item.title }}
          </span>
        </a-list-item>
      </a-tooltip>
    </template>
  </a-list>
</template>

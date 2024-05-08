<script setup>
const props = defineProps({
  contentWidth: { type: String, required: false },
  layout: { type: String, required: false },
  fixedHeader: { type: Boolean, required: false },
  fixedSider: { type: Boolean, required: false },
  splitMenus: { type: Boolean, required: false },
  keepAlive: { type: Boolean, required: false },
  accordionMode: { type: Boolean, required: false },
  leftCollapsed: { type: Boolean, required: false },
  compactAlgorithm: { type: Boolean, required: false },
  t: { type: Function, required: false },
})
const emit = defineEmits(['changeSetting'])
const list = computed(() => [
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
    disabled: props.layout !== 'mix',
    disabledReason: '',
  },
  {
    title: '缓存功能',
    key: 'keepAlive',
    disabled: false,
    disabledReason: '',
  },
  {
    title: '菜单手风琴模式',
    key: 'accordionMode',
    disabled: false,
    disabledReason: '',
  },
  {
    title: '侧边菜单折叠 左侧',
    key: 'leftCollapsed',
    disabled: props.layout !== 'side',
    disabledReason: '',
  },
  {
    title: '紧凑模式',
    key: 'compactAlgorithm',
    disabled: false,
    disabledReason: '',
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
            <template v-if="item.key === 'contentWidth'">
              <a-select
                size="small"
                :disabled="item.disabled"
                :value="contentWidth || 'Fluid'"
                @update:value="(e) => handleChangeSetting('contentWidth', e)"
              >
                <a-select-option v-if="layout === 'top'" value="Fixed">
                  {{ t?.('app.setting.content-width.fixed') ?? 'Fixed' }}
                </a-select-option>
                <a-select-option value="Fluid">
                  {{ t?.('app.setting.content-width.fluid') ?? 'Fluid' }}
                </a-select-option>
              </a-select>
            </template>
            <template v-if="item.key === 'fixedHeader'">
              <a-switch
                size="small"
                :checked="fixedHeader"
                :disabled="item.disabled"
                @update:checked="(e) => handleChangeSetting('fixedHeader', e)"
              />
            </template>
            <template v-if="item.key === 'fixSiderbar'">
              <a-switch
                size="small"
                :checked="fixedSider"
                :disabled="item.disabled"
                @update:checked="(e) => handleChangeSetting('fixedSider', e)"
              />
            </template>
            <template v-if="item.key === 'splitMenus'">
              <a-switch
                size="small"
                :checked="splitMenus"
                :disabled="item.disabled"
                @update:checked="(e) => handleChangeSetting('splitMenus', e)"
              />
            </template>
            <template v-if="item.key === 'keepAlive'">
              <a-switch
                size="small"
                :checked="keepAlive"
                :disabled="item.disabled"
                @update:checked="(e) => handleChangeSetting('keepAlive', e)"
              />
            </template>
            <template v-if="item.key === 'accordionMode'">
              <a-switch
                size="small"
                :checked="accordionMode"
                :disabled="item.disabled"
                @update:checked="(e) => handleChangeSetting('accordionMode', e)"
              />
            </template>
            <template v-if="item.key === 'leftCollapsed'">
              <a-switch
                size="small"
                :checked="leftCollapsed"
                :disabled="item.disabled"
                @update:checked="(e) => handleChangeSetting('leftCollapsed', e)"
              />
            </template>
            <template v-if="item.key === 'compactAlgorithm'">
              <a-switch
                size="small"
                :checked="compactAlgorithm"
                :disabled="item.disabled"
                @update:checked="(e) => handleChangeSetting('compactAlgorithm', e)"
              />
            </template>
          </template>
          <span :style="{ opacity: item.disabled ? '0.5' : '1' }">
            {{ t?.(`app.setting.content-width.${item.key}`, item.title) ?? item.title }}
          </span>
        </a-list-item>
      </a-tooltip>
    </template>
  </a-list>
</template>

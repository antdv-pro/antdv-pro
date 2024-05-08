<script setup>
import { CaretDownOutlined, CaretUpOutlined } from '@ant-design/icons-vue'

defineProps({
  flag: {
    type: String,
    default: void 0,
  },
  children: {
    type: String,
    default: void 0,
  },
})
</script>

<template>
  <div
    :title="children"
    class="trendItem"
  >
    <slot />
    <span :class="flag">
      <CaretUpOutlined v-if="flag === 'up'" />
      <CaretDownOutlined v-else />
    </span>
  </div>
</template>

<style scoped lang="less">
.trendItem {
  display: inline-block;
  font-size: 14px;
  line-height: 22px;

  .up,
  .down {
    position: relative;
    top: 1px;
    margin-left: 4px;
    span {
      font-size: 12px;
      transform: scale(0.83);
    }
  }
  .up {
    color: #f5222d;
  }
  .down {
    top: -1px;
    color: #52c41a;
  }

  &.trendItemGrey .up,
  &.trendItemGrey .down {
    color: var(--text-color);
  }

  &.reverseColor .up {
    color: #52c41a;
  }
  &.reverseColor .down {
    color: #f5222d;
  }
}
</style>

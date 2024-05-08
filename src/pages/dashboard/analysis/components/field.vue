<script setup>
defineProps({
  label: {
    type: String,
    default: '',
  },
  value: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="field">
    <span class="label">{{ label }}</span>
    <span class="number">{{ value }}</span>
  </div>
</template>

<style scoped lang="less">
.field {
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  .label,
  .number {
    font-size: 14px;
    line-height: 22px;
  }
  .number {
    margin-left: 8px;
    // color: rgba(0,0,0,.85);
  }
}
</style>

<script lang="ts" setup>
defineProps({
  color: {
    type: String,
    default: '#3ff9dc',
  },
})
</script>

<template>
  <div class="plane-wrapper" />
</template>

<style lang="less" scoped>
.plane-wrapper {
  display: inline-block;
  width: 60px;
  height: 60px;
  background-color: v-bind(color);
  animation: plane-loader 1.2s infinite ease-in-out;
}

@keyframes plane-loader {
  0% {
    transform: perspective(120px);
  }

  50% {
    transform: perspective(120px) rotateY(180deg);
  }

  100% {
    transform: perspective(120px) rotateY(180deg) rotateX(180deg);
  }
}
</style>

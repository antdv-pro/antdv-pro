<script setup>
defineProps({
  color: {
    type: String,
    default: '#3ff9dc',
  },
})
</script>

<template>
  <div class="rect-wrapper">
    <div class="rect-item rect1" />
    <div class="rect-item rect2" />
    <div class="rect-item rect3" />
    <div class="rect-item rect4" />
    <div class="rect-item rect5" />
  </div>
</template>

<style lang="less" scoped>
.rect-item {
  display: inline-block;
  width: 6px;
  height: 60px;
  margin: 0 4px;
  background-color: v-bind(color);
  animation: rect-loader 1.2s infinite ease-in-out;
}

.rect2 {
  animation-delay: -1.1s;
}

.rect3 {
  animation-delay: -1s;
}

.rect4 {
  animation-delay: -0.9s;
}

.rect5 {
  animation-delay: -0.8s;
}

@keyframes rect-loader {
  0%,
  40%,
  100% {
    transform: scaleY(0.4);
  }

  20% {
    transform: scaleY(1);
  }
}
</style>

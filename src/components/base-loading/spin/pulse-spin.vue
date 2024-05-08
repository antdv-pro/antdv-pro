<script setup>
defineProps({
  color: {
    type: String,
    default: '#3ff9dc',
  },
})
</script>

<template>
  <div class="pulse-wrapper">
    <div class="pulse-item one" />
    <div class="pulse-item two" />
    <div class="pulse-item three" />
  </div>
</template>

<style lang="less" scoped>
.pulse-item {
  position: relative;
  display: inline-block;
  width: 20px;
  height: 20px;
  background-color: v-bind(color);
  border-radius: 50%;
  animation: pulse-loader 0.4s ease 0s infinite alternate;
}

.two {
  margin: 0 15px;
  animation: pulse-loader 0.4s ease 0.2s infinite alternate;
}

.three {
  animation: pulse-loader 0.4s ease 0.4s infinite alternate;
}

@keyframes pulse-loader {
  0% {
    opacity: 1;
    transform: scale(1);
  }

  100% {
    opacity: 0.5;
    transform: scale(0.75);
  }
}
</style>

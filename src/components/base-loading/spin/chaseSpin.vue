<script lang="ts" setup>
defineProps({
  color: {
    type: String,
    default: '#3ff9dc',
  },
})
</script>

<template>
  <div class="chase-wrapper">
    <div class="chase-item" />
    <div class="chase-item" />
    <div class="chase-item" />
    <div class="chase-item" />
    <div class="chase-item" />
    <div class="chase-item" />
  </div>
</template>

<style lang="less" scoped>
.chase-wrapper {
  display: inline-block;
  width: 60px;
  height: 60px;
  animation: chase-loader 2.5s infinite linear both;
}

.chase-item {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  animation: chase-dot 2s infinite ease-in-out both;
}

.chase-item::before {
  display: block;
  width: 25%;
  height: 25%;
  content: '';
  background-color: v-bind(color);
  border-radius: 100%;
  animation: chase-dot-before 2s infinite ease-in-out both;
}

.chase-item:nth-child(1),
.chase-item:nth-child(1)::before {
  animation-delay: -1.1s;
}

.chase-item:nth-child(2),
.chase-item:nth-child(2)::before {
  animation-delay: -1s;
}

.chase-item:nth-child(3),
.chase-item:nth-child(3)::before {
  animation-delay: -0.9s;
}

.chase-item:nth-child(4),
.chase-item:nth-child(4)::before {
  animation-delay: -0.8s;
}

.chase-item:nth-child(5),
.chase-item:nth-child(5)::before {
  animation-delay: -0.7s;
}

.chase-item:nth-child(6),
.chase-item:nth-child(6)::before {
  animation-delay: -0.6s;
}

@keyframes chase-loader {
  100% {
    transform: rotate(1turn);
  }
}

@keyframes chase-dot {
  80%,
  100% {
    transform: rotate(360deg);
  }
}

@keyframes chase-dot-before {
  50% {
    transform: scale(0.4);
  }

  100%,
  0% {
    transform: scale(1);
  }
}
</style>

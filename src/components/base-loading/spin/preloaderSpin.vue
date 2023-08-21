<script lang="ts" setup></script>

<template>
  <div class="preloader-wrapper" />
</template>

<style lang="less" scoped>
.preloader-wrapper {
  position: relative;
  display: inline-block;
  width: 20px;
  height: 20px;
}

.preloader-wrapper::before {
  position: absolute;
  width: 20px;
  height: 20px;
  content: '';
  background: blue;
  background: #9b59b6;
  border-radius: 20px;
  animation: preloader-before 2s infinite ease-in-out;
}

.preloader-wrapper::after {
  position: absolute;
  left: 22px;
  width: 20px;
  height: 20px;
  content: '';
  background: blue;
  background: #2ecc71;
  border-radius: 20px;
  animation: preloader-after 1.5s infinite ease-in-out;
}

@keyframes preloader-before {
  0% {
    transform: translateX(0) rotate(0deg);
  }

  50% {
    background: #2ecc71;
    border-radius: 0;
    transform: translateX(50px) scale(1.2) rotate(260deg);
  }

  100% {
    transform: translateX(0) rotate(0deg);
  }
}
@keyframes preloader-after {
  0% {
    transform: translateX(0);
  }

  50% {
    background: #9b59b6;
    border-radius: 0;
    transform: translateX(-50px) scale(1.2) rotate(-260deg);
  }

  100% {
    transform: translateX(0);
  }
}
</style>

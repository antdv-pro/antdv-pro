<script setup lang="ts">
import { notification } from 'ant-design-vue'
const openNotification = () => {
  notification.info({
    message: '测试',
    description: '测试的内容',
    placement: 'topLeft',
    duration: 0,
  })
}
</script>

<template>
  <div p-2>
    Analysis
    <a-button @click="openNotification">
      notification
    </a-button>
  </div>
</template>

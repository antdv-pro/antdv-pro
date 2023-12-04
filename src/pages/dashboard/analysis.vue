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
const router = useRouter()
const onOpenLik = (id: string) => {
  router.push({
    path: '/form/edit',
    query: {
      id,
    },
  })
}
</script>

<template>
  <div p-2>
    Analysis
    <a-button @click="openNotification">
      notification
    </a-button>
    <a-button @click="onOpenLik('111')">
      按钮1
    </a-button>
    <a-button @click="onOpenLik('22')">
      按钮2
    </a-button>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
function back() {
  router.replace({
    path: '/',
  })
}
</script>

<template>
  <a-result status="404" title="404" sub-title="对不起，当前访问的页面不存在！">
    <template #extra>
      <a-button type="primary" @click="back">
        返回首页
      </a-button>
    </template>
  </a-result>
</template>

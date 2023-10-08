<script setup lang="ts">
const router = useRouter()
function login() {
  router.replace({
    path: '/login',
  })
}
</script>

<template>
  <a-result status="404" title="401" sub-title="登录已过期，请重新登陆">
    <template #extra>
      <a-button type="primary" @click="login">
        跳转登录
      </a-button>
    </template>
  </a-result>
</template>

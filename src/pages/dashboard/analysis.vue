<script setup lang="ts">
import { loginApi } from '~/api/common/login'

const handleLogin = async () => {
  const { data } = await loginApi({
    username: 'admin',
    password: 'admin',
  })

  console.log(data)
}
</script>

<template>
  <div p-2>
    Analysis
    <a-button @click="handleLogin">
      登录
    </a-button>
  </div>
</template>

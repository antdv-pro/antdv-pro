<script setup lang="ts">
import { theme } from 'ant-design-vue'
const { token } = theme.useToken()
const { setToken } = useAntdToken()
watchEffect(() => {
  setToken(token.value)
})
</script>

<template>
  <slot />
</template>

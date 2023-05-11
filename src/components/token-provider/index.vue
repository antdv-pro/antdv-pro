<script setup lang="ts">
import { theme } from 'ant-design-vue'
import { registerTokenToCSSVar } from './token-to-cssvar'
const { token } = theme.useToken()
const { setToken } = useAntdToken()
watchEffect(() => {
  setToken(token.value)
  registerTokenToCSSVar(token.value)
})
</script>

<template>
  <slot />
</template>

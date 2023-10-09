<script setup lang="ts">
import { App, theme } from 'ant-design-vue'
import { registerTokenToCSSVar } from './token-to-cssvar'

defineOptions({
  name: 'TokenProvider',
})
const { token } = theme.useToken()
const { setToken } = useAntdToken()
const { message, modal, notification } = App.useApp()

useSetGlobalConfig({
  message,
  modal,
  notification,
} as any)
watchEffect(() => {
  setToken(token.value)
  registerTokenToCSSVar(token.value)
})
</script>

<template>
  <slot />
</template>

<script setup>
import { App, theme } from 'ant-design-vue'
import { registerTokenToCSSVar } from './token-to-cssvar.js'

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
})
watchEffect(() => {
  setToken(token.value)
  registerTokenToCSSVar(token.value)
})
</script>

<template>
  <slot />
</template>

<script setup lang="ts">
import { Modal, message, notification, theme } from 'ant-design-vue'
import { registerTokenToCSSVar } from './token-to-cssvar'
const { token } = theme.useToken()
const { setToken } = useAntdToken()
const [messageInst, MessageHolder] = message.useMessage()
const [modalInst, ModalHolder] = Modal.useModal()
const [notificationInst, NotificationHolder] = notification.useNotification()
useSetGlobalConfig({
  message: messageInst as any,
  modal: modalInst as any,
  notification: notificationInst as any,
})
watchEffect(() => {
  setToken(token.value)
  registerTokenToCSSVar(token.value)
})
</script>

<template>
  <slot />
  <MessageHolder />
  <ModalHolder />
  <NotificationHolder />
</template>

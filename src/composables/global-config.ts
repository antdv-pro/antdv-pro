import type { message, notification } from 'ant-design-vue'
import type { ModalFunc } from 'ant-design-vue/es/modal/Modal'

interface GlobalConfigIntl {
  message?: Omit<typeof message, 'useMessage'>
  modal?: {
    readonly info: ModalFunc
    readonly success: ModalFunc
    readonly error: ModalFunc
    readonly warning: ModalFunc
    readonly confirm: ModalFunc
  }
  notification?: Omit<typeof notification, 'useNotification'>
}
const globalConfig = reactive<GlobalConfigIntl>({})

export function useGlobalConfig() {
  return globalConfig
}
export function useSetGlobalConfig(config: GlobalConfigIntl) {
  globalConfig.message = config.message
  globalConfig.modal = config.modal
  globalConfig.notification = config.notification
}

export function useMessage() {
  return globalConfig.message!
}

export function useModal() {
  return globalConfig.modal!
}

export function useNotification() {
  return globalConfig.notification!
}

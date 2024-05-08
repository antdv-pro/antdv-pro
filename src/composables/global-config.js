const globalConfig = reactive({})
export function useGlobalConfig() {
  return globalConfig
}
export function useSetGlobalConfig(config) {
  globalConfig.message = config.message
  globalConfig.modal = config.modal
  globalConfig.notification = config.notification
}
export function useMessage() {
  return globalConfig.message
}
export function useModal() {
  return globalConfig.modal
}
export function useNotification() {
  return globalConfig.notification
}

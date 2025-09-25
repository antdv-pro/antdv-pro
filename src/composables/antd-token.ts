import type { GlobalToken } from 'ant-design-vue/es/theme'
import { theme } from 'ant-design-vue'

export const useAntdToken = createSharedComposable(() => {
  const { token: antdToken } = theme.useToken()
  const token = ref<GlobalToken>(antdToken.value)
  const setToken = (globalToken: GlobalToken) => {
    token.value = globalToken
  }
  return {
    token,
    setToken,
  }
})

import { theme } from 'ant-design-vue'

export const useAntdToken = createSharedComposable(() => {
  const { token: antdToken } = theme.useToken()
  const token = ref(antdToken.value)
  const setToken = (globalToken) => {
    token.value = globalToken
  }
  return {
    token,
    setToken,
  }
})

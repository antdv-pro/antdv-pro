import type { GlobalToken } from 'antdv-next/dist/theme/interface/cssinjs-utils'
import { theme } from 'antdv-next'

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

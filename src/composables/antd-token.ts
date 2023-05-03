import { theme } from 'ant-design-vue/es'
export const useAntdToken = () => {
  const { token } = theme.useToken()
  return token
}

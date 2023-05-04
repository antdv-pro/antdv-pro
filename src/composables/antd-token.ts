import { theme } from 'ant-design-vue'
export const useAntdToken = () => {
  const { token } = theme.useToken()
  return token
}

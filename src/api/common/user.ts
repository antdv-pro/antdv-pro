export interface UserInfo {
  id: number | string
  username: string
  nickname: string
  avatar: string
}

export const getUserInfoApi = () => {
  return useGet<any, UserInfo>('/user/info')
}

export interface UserInfo {
  id: number | string
  username: string
  nickname: string
  avatar: string
  roles?: (string | number)[]
}

export const getUserInfoApi = () => {
  return useGet<UserInfo>('/user/info')
}

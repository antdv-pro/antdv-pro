export interface UserInfo {
  id: number | string
  username: string
  nickname: string
  avatar: string
  roles?: (string | number)[]
  postName?: string
  deptName?: string
}

export interface SystemUser {
  id: number | string
  username: string
  nickname: string
  mobile?: string
  wecomUserId?: string
  wecomDepartmentId?: string
  deptId?: string | number
  deptName?: string
  postId?: string | number
  postName?: string
  roles?: string[]
  status?: string
}

export function getUserInfoApi() {
  return useGet<UserInfo>('/user/info')
}

export function getUserListApi(params?: { keyword?: string, deptId?: string | number, status?: string }) {
  return useGet<SystemUser[]>('/users', params)
}

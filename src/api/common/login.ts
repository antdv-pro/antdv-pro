export interface LoginParams {
  username: string
  password: string
}

export interface LoginResultModel {
  token: string
}

export const loginApi = (params: LoginParams) => {
  return usePost<LoginParams, LoginResultModel>('/login', params)
}

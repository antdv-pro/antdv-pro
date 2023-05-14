export interface ListResultModel {
  id: number
  title: string
  username: string
  password: string
}

export type ListResultParams = Partial<Omit<ListResultModel, 'id' | 'password'>>

export const getListApi = async (params?: ListResultParams) => {
  return usePost<ListResultModel[]>('/list', params)
}

export type CreateListParams = Partial<Omit<ListResultModel, 'id'>>

export const createListApi = async (params: CreateListParams) => {
  return usePost('/list/create', params)
}

export const editListApi = async (params: ListResultModel) => {
  return usePut('/list', params)
}

export const delListApi = async (id: string | number) => {
  return useDelete(`/list/${id}`)
}

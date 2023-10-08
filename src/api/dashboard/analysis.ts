export interface ListResultModel {
  id: number
  title: string
  username: string
  password: string
}

export type ListResultParams = Partial<Omit<ListResultModel, 'id' | 'password'>>

export async function getListApi(params?: ListResultParams) {
  return usePost<ListResultModel[]>('/list', params)
}

export type CreateListParams = Partial<Omit<ListResultModel, 'id'>>

export async function createListApi(params: CreateListParams) {
  return usePost('/list/create', params)
}

export async function editListApi(params: ListResultModel) {
  return usePut('/list', params)
}

export async function delListApi(id: string | number) {
  return useDelete(`/list/${id}`)
}

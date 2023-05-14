export interface ListResultModel {
  id: number
  title: string
  username: string
  password: string
}

export const getListApi = async () => {
  return useGet<ListResultModel[]>('/list')
}

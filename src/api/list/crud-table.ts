interface CrudTableModel {
  id?: number
  /**
   * 名称
   */
  name: string
  /**
   * 值
   */
  value: string
  /**
   * 描述
   */
  remark?: string
}

type CrudTableParams = Partial<Omit<CrudTableModel, 'id'>>

export async function getListApi(params?: CrudTableParams) {
  return usePost<CrudTableModel[]>('/list/crud-table', params)
}

export async function deleteApi(id: string | number) {
  return useDelete(`/list/${id}`)
}

export type{
  CrudTableParams,
  CrudTableModel,
}

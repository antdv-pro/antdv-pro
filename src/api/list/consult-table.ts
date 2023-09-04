import type { STATUS } from '~@/utils/constant'
interface ConsultTableModel {
  id: number
  /**
   * 服务名称
   */
  name: string
  /**
   * 服务调用次数
   */
  callNo: 805
  /**
   * 描述
   */
  desc: string
  /**
   * 状态
   */
  status: STATUS
  /**
   * 上次调用时间
   */
  updatedAt: string

}

type ConsultTableParams = Partial<Omit<ConsultTableModel, 'id'>>

export const getListApi = async (params?: ConsultTableParams) => {
  return usePost<ConsultTableModel[]>('/list/consult-list', params)
}

export const deleteApi = async (id: string | number) => {
  return useDelete(`/list/${id}`)
}

export type{
  ConsultTableParams,
  STATUS,
  ConsultTableModel,
}

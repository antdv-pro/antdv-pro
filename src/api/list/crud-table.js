export async function getListApi(params) {
  return usePost('/list/crud-table', params)
}
export async function deleteApi(id) {
  return useDelete(`/list/${id}`)
}

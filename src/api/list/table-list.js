export async function getListApi(params) {
  return usePost('/list/consult-list', params)
}
export async function deleteApi(id) {
  return useDelete(`/list/${id}`)
}

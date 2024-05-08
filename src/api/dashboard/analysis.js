export async function getListApi(params) {
  return usePost('/list', params)
}
export async function createListApi(params) {
  return usePost('/list/create', params)
}
export async function editListApi(params) {
  return usePut('/list', params)
}
export async function delListApi(id) {
  return useDelete(`/list/${id}`)
}

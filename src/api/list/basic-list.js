export async function getListApi(params) {
  return usePost('/list/basic-list', params)
}

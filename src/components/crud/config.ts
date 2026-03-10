export default {
  requestHandler(params: any): any {
    return params
  },
  responseHandler(data: any): any {
    return data.data || []
  },
  countName: 'count',
}

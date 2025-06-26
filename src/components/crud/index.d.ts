declare interface columnItem {
  title: string
  dataIndex: string
  width?: string | number
  display?: boolean
  addDisplay?: boolean
  editDisplay?: boolean
  search?: boolean
  formType?: string
  rules?: object[]
}

declare interface crudOptionsForm {
  width?: string | number
}

declare interface crudOptions {
  api: Function
  addApi?: Function
  editApi?: Function
  deleteApi?: Function
  updateApi?: Function
  requestParams?: object
  form?: crudOptionsForm
  deleteParams?: Function
}

export function useTransportQueryState() {
  const queryModel = reactive({
    keyword: '',
    status: undefined as string | undefined,
    vehicle: undefined as string | undefined,
    customer: undefined as string | undefined,
  })
  const tablePagination = reactive({
    current: 1,
    pageSize: 10,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100', '200'],
    showTotal: (total: number) => `共 ${total} 条`,
    onChange(current: number, pageSize: number) {
      tablePagination.current = current
      tablePagination.pageSize = pageSize
    },
    onShowSizeChange(_current: number, pageSize: number) {
      tablePagination.pageSize = pageSize
      tablePagination.current = 1
    },
  })

  return {
    queryModel,
    baseDataQueryModel: reactive<Record<string, string>>({}),
    tablePagination,
  }
}

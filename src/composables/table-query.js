import { assign } from 'lodash'

export function useTableQuery(_options) {
  const state = reactive(assign({
    queryApi: () => Promise.resolve(),
    loading: false,
    queryParams: {},
    dataSource: [],
    rowSelections: {
      selectedRowKeys: [],
      selectedRows: [],
      onChange(selectedRowKeys, selectedRows) {
        state.rowSelections.selectedRowKeys = selectedRowKeys
        state.rowSelections.selectedRows = selectedRows
      },
    },
    queryOnMounted: true,
    pagination: assign({
      pageSize: 10,
      pageSizeOptions: ['10', '20', '30', '40'],
      current: 1,
      total: 0,
      order: 'desc',
      column: 'createTime',
      showSizeChanger: true,
      showQuickJumper: true,
      showTotal: total => `总数据位：${total}`,
      onChange(current, pageSize) {
        state.pagination.pageSize = pageSize
        state.pagination.current = current
        query()
      },
    }, _options.pagination),
    expand: false,
    expandChange() {
      state.expand = !state.expand
    },
    beforeQuery() {
    },
    afterQuery(data) {
      return data
    },
  }, _options))
  async function query() {
    if (state.loading)
      return
    state.loading = true
    try {
      await state.beforeQuery()
      const { data } = await state.queryApi({
        current: state.pagination.current,
        pageSize: state.pagination.pageSize,
        column: state.pagination.column,
        order: state.pagination.order,
        ...state.queryParams,
      })
      if (data) {
        const _data = await state.afterQuery(data)
        state.dataSource = _data.records ?? []
        state.pagination.total = _data.total ?? 0
      }
    }
    catch (e) {
      throw new Error(`Query Failed: ${e}`)
    }
    finally {
      state.loading = false
    }
  }
  function resetQuery() {
    state.pagination.current = 1
    state.queryParams = {}
    query()
  }
  function initQuery() {
    state.pagination.current = 1
    query()
  }
  onMounted(() => {
    if (!state.queryOnMounted)
      return
    query()
  })
  return {
    query,
    resetQuery,
    initQuery,
    state,
  }
}

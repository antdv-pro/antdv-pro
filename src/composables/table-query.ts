import type { PaginationProps } from 'ant-design-vue'
import type { TableRowSelection } from 'ant-design-vue/es/table/interface'
import { assign } from 'lodash'

/**
 * 表格分页扩展类型
 */
export interface TablePaginationProps extends PaginationProps {
  /**
   * 排序字段
   */
  column: string
  /**
   * 排序方式
   */
  order: string
}

/**
 * 表格选择框扩展类型
 */
export interface TableRowSelectionsProps extends TableRowSelection {
  /**
   * 选择行
   */
  selectedRows: any[]
  /**
   * 选择行key
   */
  selectedRowKeys: any[]
}

interface TableQueryResult<D = any> {
  records: D[]
  total: number
  [key: string]: any
}

/**
 * 表格查询配置
 */
export interface TableQueryOptions<D = any> {
  /**
   *查询接口
   */
  queryApi: (params?: any) => Promise<any>
  /**
   * 是否加载中
   */
  loading: boolean
  /**
   * 数据源
   */
  dataSource: D[]
  /**
   * 查询参数
   */
  queryParams: Record<string, any>
  /**
   * 选择配置
   */
  rowSelections: TableRowSelectionsProps
  /**
   * 挂载时进行查询
   */
  queryOnMounted: boolean
  /**
   *  分页配置
   */
  pagination: TablePaginationProps
  /**
   * 是否展开
   */
  expand: boolean
  /**
   * 展开变化
   */
  expandChange: () => void
  /**
   * 查询前回调
   */
  beforeQuery: () => void | Promise<void>
  /**
   * 查询后回调
   */
  afterQuery: <R extends TableQueryResult<D> = any>(data: R) => R | Promise<R>
}

/**
 * 表格查询方法
 */
export function useTableQuery(_options: Partial<TableQueryOptions>) {
  const state = reactive<TableQueryOptions>(assign({
    queryApi: () => Promise.resolve(),
    loading: false,
    queryParams: {},
    dataSource: [],
    rowSelections: {
      selectedRowKeys: [],
      selectedRows: [],
      onChange(selectedRowKeys: any[], selectedRows: any[]) {
        state.rowSelections.selectedRowKeys = selectedRowKeys
        state.rowSelections.selectedRows = selectedRows
      },
    },
    queryOnMounted: true,
    pagination:
      assign({
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
          state.pagination!.pageSize = pageSize
          state.pagination!.current = current
          query()
        },
      } as TablePaginationProps, _options.pagination),
    expand: false,
    expandChange() {
      state.expand = !state.expand
    },
    beforeQuery() {
    },
    afterQuery(data: TablePaginationProps) {
      return data
    },
  }, _options))

  // 查询方法
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

  // 重置方法
  function resetQuery() {
    state.pagination.current = 1
    state.queryParams = {}
    query()
  }

  // 初始化查询
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

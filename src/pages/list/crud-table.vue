<script setup lang="ts">
import type { CrudTableModel } from '~@/api/list/crud-table'
import { DownloadOutlined, PlusOutlined } from '@ant-design/icons-vue'
import * as XLSX from 'xlsx'
import { deleteApi, getListApi } from '~@/api/list/crud-table'
import FinancialPeriodFilter from '~@/components/financial-period-filter/index.vue'
import { useFinancialPeriodFilter } from '~@/composables/financial-period-filter'
import { useTableQuery } from '~@/composables/table-query'
import CrudTableModal from './components/crud-table-modal.vue'

const message = useMessage()
const {
  model: financialPeriodFilter,
  queryParams: financialQueryParams,
  resetFinancialPeriodFilter,
} = useFinancialPeriodFilter()

const columns = shallowRef([
  {
    title: '名',
    dataIndex: 'name',
  },
  {
    title: '值',
    dataIndex: 'value',
  },
  {
    title: '描述',
    dataIndex: 'remark',
  },
  {
    title: '操作',
    dataIndex: 'action',
    width: 180,
  },
])

const { state, initQuery, query } = useTableQuery({
  queryApi: getListApi,
  queryParams: {
    name: undefined,
    value: undefined,
    remark: undefined,
    ...financialQueryParams.value,
  },
  beforeQuery: () => {
    Object.assign(state.queryParams, financialQueryParams.value)
  },
  afterQuery: (res) => {
    console.log(res)
    return res
  },
})

const crudTableModal = ref<InstanceType<typeof CrudTableModal>>()

async function handleDelete(record: CrudTableModel) {
  if (!record.id)
    return message.error('id 不能为空')
  try {
    const res = await deleteApi(record.id)
    if (res.code === 200)
      await query()
    message.success('删除成功')
  }
  catch (e) {
    console.log(e)
  }
  finally {
    close()
  }
}

function handleAdd() {
  crudTableModal.value?.open()
}

function handleEdit(record: CrudTableModel) {
  crudTableModal.value?.open(record)
}

function handleReset() {
  resetFinancialPeriodFilter()
  state.queryParams = {
    name: undefined,
    value: undefined,
    remark: undefined,
    ...financialQueryParams.value,
  }
  initQuery()
}

function exportCurrentRows() {
  const payload = financialQueryParams.value
  const workbook = XLSX.utils.book_new()
  const conditionSheet = XLSX.utils.json_to_sheet([
    {
      名: state.queryParams.name ?? '',
      值: state.queryParams.value ?? '',
      备注: state.queryParams.remark ?? '',
      startDate: payload.startDate,
      endDate: payload.endDate,
      查询周期: payload.periodType,
    },
  ])
  const dataSheet = XLSX.utils.json_to_sheet(state.dataSource.map(row => ({ ...row })))

  XLSX.utils.book_append_sheet(workbook, conditionSheet, '筛选条件')
  XLSX.utils.book_append_sheet(workbook, dataSheet, '导出数据')
  XLSX.writeFile(workbook, `增删改查表格_${payload.startDate}_${payload.endDate}.xlsx`)
}
</script>

<template>
  <page-container>
    <a-card mb-4>
      <a-form class="system-crud-wrapper" :label-col="{ span: 7 }" :model="state.queryParams">
        <a-row :gutter="[15, 0]">
          <a-col :span="6">
            <a-form-item name="name" label="名">
              <a-input v-model:value="state.queryParams.name" placeholder="请输入名" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item name="value" label="值">
              <a-input v-model:value="state.queryParams.value" placeholder="请输入值" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item name="remark" label="备注">
              <a-input v-model:value="state.queryParams.remark" placeholder="请输入备注" />
            </a-form-item>
          </a-col>
          <FinancialPeriodFilter v-model="financialPeriodFilter" />
          <a-col :xs="24" :md="8" :xl="6">
            <a-space flex justify-end w-full>
              <a-button :loading="state.loading" type="primary" @click="initQuery">
                查询
              </a-button>
              <a-button :loading="state.loading" @click="handleReset">
                重置
              </a-button>
            </a-space>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <a-card title="增删改查表格">
      <template #extra>
        <a-space size="middle">
          <a-button type="primary" @click="handleAdd">
            <template #icon>
              <PlusOutlined />
            </template>
            新增
          </a-button>
          <a-button @click="exportCurrentRows">
            <template #icon>
              <DownloadOutlined />
            </template>
            导出
          </a-button>
        </a-space>
      </template>
      <a-table
        row-key="id" :row-selection="state.rowSelections" :loading="state.loading" :columns="columns"
        :data-source="state.dataSource" :pagination="state.pagination"
      >
        <template #bodyCell="scope">
          <template v-if="scope?.column?.dataIndex === 'action'">
            <a-space>
              <a-button type="link" size="small">
                查看
              </a-button>
              <a-button type="link" size="small">
                审核
              </a-button>
              <a-dropdown>
                <a-button type="link" size="small">
                  更多
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item>
                      <a @click="handleEdit(scope?.record as CrudTableModel)">编辑</a>
                    </a-menu-item>
                    <a-menu-item>
                      <a-popconfirm
                        title="确定删除该条数据？" ok-text="确定" cancel-text="取消"
                        @confirm="handleDelete(scope?.record as CrudTableModel)"
                      >
                        <span>删除</span>
                      </a-popconfirm>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <CrudTableModal ref="crudTableModal" />
  </page-container>
</template>

<style lang="less" scoped>
.system-crud-wrapper {
  .ant-form-item {
    margin: 0;
  }
}
</style>

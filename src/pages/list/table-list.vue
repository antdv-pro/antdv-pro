<script setup lang="ts">
import { DownOutlined, UpOutlined } from '@ant-design/icons-vue'
import type { PaginationProps } from 'ant-design-vue'
import type { ConsultTableModel, ConsultTableParams } from '~@/api/list/table-list'
import { deleteApi, getListApi } from '~@/api/list/table-list'

const statusMap = {
  O: '关闭',
  1: '运行中',
  2: '上线',
  3: '错误',
}
const message = useMessage()
const columns = shallowRef([
  {
    title: '#',
    dataIndex: 'id',
  },
  {
    title: '规则名称',
    dataIndex: 'name',
  },
  {
    title: '描述',
    dataIndex: 'desc',
  },
  {
    title: '服务调用次数',
    dataIndex: 'callNo',
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 100,
  },
  {
    title: '上次调度时间',
    dataIndex: 'updatedAt',
    width: 200,
  },
  {
    title: '操作',
    dataIndex: 'action',
    width: 200,
  },
])
const loading = shallowRef(false)
const pagination = reactive<PaginationProps>({
  pageSize: 10,
  pageSizeOptions: ['10', '20', '30', '40'],
  current: 1,
  total: 100,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: total => `总数据位：${total}`,
  onChange(current, pageSize) {
    pagination.pageSize = pageSize
    pagination.current = current
    init()
  },
})
const dataSource = shallowRef<ConsultTableModel[]>([])
const formModel = reactive<ConsultTableParams>({
  name: undefined,
  callNo: undefined,
  desc: undefined,
  status: undefined,
  updatedAt: undefined,
})

async function init() {
  if (loading.value)
    return
  loading.value = true
  try {
    const { data } = await getListApi({
      ...formModel,
      current: pagination.current,
      pageSize: pagination.pageSize,
    })
    dataSource.value = data ?? []
  }
  catch (e) {
    console.log(e)
  }
  finally {
    loading.value = false
  }
}

async function onSearch() {
  pagination.current = 1
  await init()
}

async function onReset() {
  // 清空所有参数重新请求
  formModel.name = undefined
  formModel.desc = undefined
  await init()
}

/**
 * 删除功能
 *  @param record
 *
 */
async function handleDelete(record: ConsultTableModel) {
  const close = message.loading('删除中......')
  try {
    const res = await deleteApi(record!.id)
    if (res.code === 200)
      await init()
    message.success('删除成功')
  }
  catch (e) {
    console.log(e)
  }
  finally {
    close()
  }
}

onMounted(() => {
  init()
})

const expand = ref(false)
</script>

<template>
  <page-container>
    <a-card mb-4>
      <a-form :label-col="{ span: 7 }" :model="formModel">
        <a-row :gutter="[15, 0]">
          <a-col :span="8">
            <a-form-item name="name" label="规则名称">
              <a-input v-model:value="formModel.name" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item name="desc" label="描述">
              <a-input v-model:value="formModel.desc" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item name="updatedAt" label="上次调用时间">
              <a-date-picker v-model:value="formModel.updatedAt" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="expand" :gutter="[15, 0]">
          <a-col :span="8">
            <a-form-item name="status" label="状态">
              <a-select
                v-model:value="formModel.status"
              >
                <a-select-option value="0">
                  关闭
                </a-select-option>
                <a-select-option value="1">
                  运行中
                </a-select-option>
                <a-select-option value="2">
                  上线
                </a-select-option>
                <a-select-option value="3">
                  错误
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item name="callNo" label="服务调用次数">
              <a-input-number v-model:value="formModel.callNo" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :span="24" style="text-align: right">
          <a-col :span="24">
            <a-space flex justify-end w-full>
              <a-button :loading="loading" type="primary" @click="onSearch">
                查询
              </a-button>
              <a-button :loading="loading" @click="onReset">
                重置
              </a-button>
              <a-button type="link" @click="expand = !expand">
                {{ expand ? '收起' : '展开' }}
                <UpOutlined v-if="expand" />
                <DownOutlined v-else />
              </a-button>
            </a-space>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <a-card title="查询表格">
      <a-table :loading="loading" :columns="columns" :data-source="dataSource" :pagination="pagination">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'action'">
            <div flex gap-2>
              <a c-error @click="handleDelete(record as ConsultTableModel)">
                删除
              </a>
            </div>
          </template>
          <template v-if="column.dataIndex === 'status'">
            <div gap-2>
              {{ statusMap[record.status as keyof typeof statusMap] as string }}
            </div>
          </template>
        </template>
      </a-table>
    </a-card>
  </page-container>
</template>

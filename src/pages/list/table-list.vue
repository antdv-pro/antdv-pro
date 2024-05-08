<script setup>
import { Modal } from 'ant-design-vue'
import { ColumnHeightOutlined, DownOutlined, PlusOutlined, ReloadOutlined, SettingOutlined, UpOutlined } from '@ant-design/icons-vue'
import { deleteApi, getListApi } from '~@/api/list/table-list'

const statusMap = {
  0: '关闭',
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
const pagination = reactive({
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
const dataSource = shallowRef([])
const formModel = reactive({
  name: void 0,
  callNo: void 0,
  desc: void 0,
  status: void 0,
  updatedAt: void 0,
})
const tableSize = ref(['large'])
const sizeItems = ref([
  {
    key: 'large',
    label: '默认',
    title: '默认',
  },
  {
    key: 'middle',
    label: '中等',
    title: '中等',
  },
  {
    key: 'small',
    label: '紧凑',
    title: '紧凑',
  },
])
const open = ref(false)
const options = computed(() => {
  return columns.value.map((item) => {
    if (item.dataIndex === 'action') {
      return {
        label: item.title,
        value: item.dataIndex,
        disabled: true,
      }
    }
    return {
      label: item.title,
      value: item.dataIndex,
    }
  })
})
const dropdownVisible = ref(false)
const getCheckList = computed(() => columns.value.map(item => item.dataIndex))
const state = reactive({
  indeterminate: false,
  checkAll: true,
  checkList: getCheckList.value,
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
  formModel.name = void 0
  formModel.desc = void 0
  await init()
}
async function handleDelete(record) {
  const close = message.loading('删除中......')
  try {
    const res = await deleteApi(record.id)
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
function handleOk() {
  open.value = false
  Modal.destroyAll()
  onSearch()
}
function handleSizeChange(e) {
  tableSize.value[0] = e.key
}
function filterAction(value) {
  return columns.value.filter((item) => {
    if (value.includes(item.dataIndex))
      return true

    return false
  })
}
const filterColumns = ref(filterAction(getCheckList.value))
function handleCheckAllChange(e) {
  Object.assign(state, {
    checkList: e.target.checked ? getCheckList.value : [],
    indeterminate: true,
  })
  filterColumns.value = e.target.checked ? filterAction(getCheckList.value) : filterColumns.value.filter(item => item.dataIndex === 'action')
}
watch(
  () => state.checkList,
  (val) => {
    state.indeterminate = !!val.length && val.length < getCheckList.value.length
    state.checkAll = val.length === getCheckList.value.length
  },
)
function handleResetChange() {
  state.checkList = getCheckList.value
  filterColumns.value = filterAction(getCheckList.value)
}
function handleCheckChange(value) {
  const filterValue = filterAction(value)
  filterColumns.value = filterValue
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
      <template #extra>
        <a-space size="middle">
          <a-button type="primary" @click="() => open = true">
            <template #icon>
              <PlusOutlined />
            </template>
            新增
          </a-button>
          <a-tooltip title="刷新">
            <ReloadOutlined @click="onSearch" />
          </a-tooltip>
          <a-tooltip title="密度">
            <a-dropdown trigger="click">
              <ColumnHeightOutlined />
              <template #overlay>
                <a-menu v-model:selected-keys="tableSize" :items="sizeItems" @click="handleSizeChange" />
              </template>
            </a-dropdown>
          </a-tooltip>
          <a-tooltip title="列设置">
            <a-dropdown v-model:open="dropdownVisible" trigger="click">
              <SettingOutlined />
              <template #overlay>
                <a-card>
                  <template #title>
                    <a-checkbox v-model:checked="state.checkAll" :indeterminate="state.indeterminate" @change="handleCheckAllChange">
                      列选择
                    </a-checkbox>
                  </template>
                  <template #extra>
                    <a-button type="link" @click="handleResetChange">
                      重置
                    </a-button>
                  </template>
                  <a-checkbox-group v-model:value="state.checkList" :options="options" style="display: flex; flex-direction: column;" @change="handleCheckChange" />
                </a-card>
              </template>
            </a-dropdown>
          </a-tooltip>
        </a-space>
      </template>
      <a-table :loading="loading" :columns="filterColumns" :data-source="dataSource" :pagination="pagination" :size="tableSize[0]">
        <template #bodyCell="scope">
          <template v-if="scope?.column?.dataIndex === 'action'">
            <div flex gap-2>
              <a c-error @click="handleDelete(scope?.record)">
                删除
              </a>
            </div>
          </template>
          <template v-if="scope?.column?.dataIndex === 'status'">
            <div gap-2>
              {{ statusMap[scope?.record?.status ] }}
            </div>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="open" title="新建规则" width="400px" @ok="handleOk">
      <a-space direction="vertical" size="large" class="w-full">
        <a-input placeholder="请输入" />
        <a-textarea placeholder="请输入" />
      </a-space>
    </a-modal>
  </page-container>
</template>

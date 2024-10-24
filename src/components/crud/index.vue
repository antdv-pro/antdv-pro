<script setup lang="ts">
import type { MenuProps, PaginationProps, TableProps } from 'ant-design-vue'
import {
  ColumnHeightOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue'
import type { PropType } from 'vue'
import { isFunction } from 'lodash'
import fields from './component/fields.ts'
import config from './config.ts'
import type { ConsultTableModel } from '~@/api/list/table-list'

const props = defineProps({
  columns: {
    type: Array as PropType<columnItem[]>,
    default: () => [],
  },
  options: {
    type: Object as PropType<crudOptions>,
    default: () => {},
  },
})
const slots = defineSlots()
const searchFormModel = defineModel('search', {
  type: Object as PropType<any>,
  default: reactive({}),
})
const formModel = defineModel('form', {
  type: Object as PropType<any>,
  default: reactive({}),
})
const message = useMessage()
const loading = shallowRef(false)
const searchFormRef = shallowRef()
const formRef = shallowRef()
const tableRef = shallowRef()
const dataSource = shallowRef<ConsultTableModel[]>([])
const tableSize = ref<string[]>(['large'])
const sizeItems = ref<MenuProps['items']>([
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
const openType = ref('')
const dropdownVisible = ref(false)
const getCheckList = computed(() => props.columns.filter(item => item.display === undefined || item.display).map(item => item.dataIndex))
const getColumnsList = computed(() => props.columns.map(item => item.dataIndex))
const state = reactive({
  indeterminate: !!getCheckList.value.length && getCheckList.value.length < getColumnsList.value.length,
  checkAll: getCheckList.value.length === getColumnsList.value.length,
  allList: getColumnsList.value,
  checkList: getCheckList.value,
})
const options = computed(() => {
  return props.columns.map((item) => {
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
const pagination = reactive<PaginationProps>({
  pageSize: 10,
  pageSizeOptions: ['10', '20', '30', '40'],
  current: 1,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: total => `总数据位：${total}`,
  onChange(current, pageSize) {
    pagination.pageSize = pageSize
    pagination.current = current
    request()
  },
})
const searchFields = computed(() => {
  return props.columns.filter(item => item?.search && item?.formType)
})
const addFields = computed(() => {
  return props.columns.filter(item => item?.formType && item?.formType !== 'action' && (item.addDisplay === undefined || item.addDisplay))
})
const editFields = computed(() => {
  return props.columns.filter(item => item?.formType && item?.formType !== 'action' && (item.editDisplay === undefined || item.editDisplay))
})
async function request() {
  if (loading.value)
    return
  loading.value = true
  try {
    const { data } = await props.options.api(config.requestHandler({
      ...searchFormModel.value,
      ...props.options.requestParams,
      page: pagination.current,
      size: pagination.pageSize,
    }))
    dataSource.value = config.responseHandler(data)
    pagination.total = Number.parseInt(data[config.countName])
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
  await request()
}

async function onReset() {
  searchFormRef.value.resetFields()
  await request()
}

function handleDeleteParams(params: any) {
  if (typeof props.options.deleteParams === 'function')
    return props.options.deleteParams(params)
  else
    return params.id
}

/**
 * 删除功能
 *  @param record
 *
 */
async function handleDelete(record: ConsultTableModel) {
  const close = message.loading('删除中......')
  try {
    if (props?.options?.deleteApi) {
      const res = await props.options.deleteApi(handleDeleteParams(record))
      if (res.code === 0)
        await request()
      message.success('删除成功')
    }
  }
  catch (e) {
    console.log(e)
  }
  finally {
    close()
  }
}

/**
 * 新增事件
 *
 */
async function handleOk() {
  try {
    await formRef.value.validateFields()
    if (isFunction(props.options.addApi)) {
      if (openType.value === 'add' && props.options?.addApi) {
        await props.options.addApi(formModel.value).then(async (res: any) => {
          if (res.code === 0) {
            message.success('新增成功')
            open.value = false
            await onSearch()
          }
          else {
            message.error('新增失败')
          }
        }).catch(() => {
          message.error('新增失败')
        })
      }
      if (openType.value === 'edit' && props.options?.editApi) {
        await props.options.editApi(formModel.value).then(async (res: any) => {
          console.log(res)
          if (res.code === 0) {
            message.success('修改成功')
            open.value = false
            await onSearch()
          }
          else {
            message.error('修改失败')
          }
        }).catch(() => {
          message.error('修改失败')
        })
      }
    }
    else {
      message.error('未配置新增接口')
    }
  }
  catch (errorInfo) {
    message.warning('请完善表单！')
  }
}

function handleClose() {
  formRef.value.resetFields()
}

/**
 * 密度切换
 *
 */
const handleSizeChange: MenuProps['onClick'] = (e) => {
  tableSize.value[0] = e.key as string
}

/**
 * 过滤
 *
 */
function filterAction(value: string[]) {
  return props.columns.filter((item) => {
    return value.includes(item.dataIndex)
  })
}

// 备份columns
const filterColumns = ref(filterAction(getCheckList.value))

/**
 * 全选/反选事件
 *
 */

function handleCheckAllChange(e: any) {
  Object.assign(state, {
    checkList: e.target.checked ? getColumnsList.value : [],
    indeterminate: true,
  })
  filterColumns.value = e.target.checked ? filterAction(getColumnsList.value) : filterColumns.value.filter(item => item.dataIndex === 'action')
}

/**
 * 重置事件
 *
 */
function handleResetChange() {
  state.checkList = getCheckList.value
  filterColumns.value = filterAction(getCheckList.value)
}

/**
 * checkbox点击事件
 *
 */
function handleCheckChange(value: any) {
  filterColumns.value = filterAction(value)
}

function addOpen() {
  formModel.value = reactive({})
  openType.value = 'add'
  open.value = true
}

function editOpen(record: ConsultTableModel) {
  openType.value = 'edit'
  open.value = true
  formModel.value = Object.assign(formModel.value, record)
}

watch(() => state.checkList, (val) => {
  state.indeterminate = !!val.length && val.length < getColumnsList.value.length
  state.checkAll = val.length === getColumnsList.value.length
})

onMounted(() => {
  request()
})

defineExpose({
  request,
  onSearch,
  onReset,
  handleDelete,
  handleOk,
  handleClose,
  formRef,
  tableRef,
  searchFormRef,
})
</script>

<template>
  <div>
    <a-card mb-4>
      <slot name="slot-search">
        <a-form ref="searchFormRef" :label-col="{ span: 7 }" :model="searchFormModel">
          <a-row :gutter="[15, 0]">
            <template v-for="searchField in searchFields" :key="searchField.dataIndex">
              <a-col v-if="searchField?.formType" :span="6">
                <a-form-item :name="searchField.dataIndex" :label="searchField.title">
                  <slot v-if="slots[`search-${searchField.dataIndex}`]" :name="`search-${searchField.dataIndex}`" />
                  <component :is="fields[searchField.formType]" v-else v-model="searchFormModel[searchField.dataIndex]" v-bind="searchField" />
                </a-form-item>
              </a-col>
            </template>
            <a-col :span="6">
              <a-space flex justify-start w-full>
                <a-button :loading="loading" type="primary" @click="onSearch">
                  查询
                </a-button>
                <a-button :loading="loading" @click="onReset">
                  重置
                </a-button>
              </a-space>
            </a-col>
          </a-row>
        </a-form>
      </slot>
    </a-card>

    <a-card title="查询表格">
      <template #extra>
        <a-space size="middle">
          <a-button v-if="typeof props?.options?.addApi === 'function'" type="primary" @click="addOpen">
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
      <a-table
        ref="tableRef"
        :loading="loading"
        :columns="filterColumns"
        :data-source="dataSource"
        :pagination="pagination"
        :size="tableSize[0] as TableProps['size']"
      >
        <template #bodyCell="scope">
          <template v-if="scope?.column?.dataIndex && slots?.[scope.column.dataIndex as string]">
            <slot :name="scope.column.dataIndex as string" :record="scope.record" :index="scope.index" />
          </template>
          <template v-if="scope?.column?.dataIndex === 'action'">
            <a-space>
              <div v-if="typeof props?.options?.editApi === 'function'" flex gap-2>
                <a c-error @click="editOpen(scope?.record as ConsultTableModel)">
                  编辑
                </a>
              </div>
              <div v-if="typeof props?.options?.deleteApi === 'function'" flex gap-2>
                <a-popconfirm title="是否确认删除？" @confirm="handleDelete(scope?.record as ConsultTableModel)">
                  <a href="#" c-error>删除</a>
                </a-popconfirm>
              </div>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
    <a-modal v-model:open="open" :title="openType === 'add' ? '新增' : '编辑'" :width="props.options.form?.width || '40%'" @ok="handleOk" @cancel="handleClose">
      <slot name="slot-form">
        <a-form ref="formRef" :label-col="{ span: 7 }" :model="formModel">
          <template v-for="addField in addFields" :key="addField.dataIndex">
            <template v-if="addField?.formType && openType === 'add'">
              <a-form-item :name="addField.dataIndex" :label="addField.title" :rules="addField?.rules || []">
                <slot v-if="slots[`form-${addField.dataIndex}`]" :name="`form-${addField.dataIndex}`" />
                <component :is="fields[addField.formType]" v-else v-model="formModel[addField.dataIndex]" v-bind="addField" />
              </a-form-item>
            </template>
          </template>
          <template v-for="editField in editFields" :key="editField.dataIndex">
            <template v-if="editField?.formType && openType === 'edit'">
              <a-form-item :name="editField.dataIndex" :label="editField.title" :rules="editField?.rules || []">
                <slot v-if="slots[`form-${editField.dataIndex}`]" :name="`form-${editField.dataIndex}`" />
                <component :is="fields[editField.formType]" v-else v-model="formModel[editField.dataIndex]" v-bind="editField" />
              </a-form-item>
            </template>
          </template>
        </a-form>
      </slot>
    </a-modal>
  </div>
</template>

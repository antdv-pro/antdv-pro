<script setup lang="ts">
import { message } from 'ant-design-vue'
import AnalysisModal from './components/analysis-modal.vue'
import type { AnalysisModalProps } from './components/interface'
import type { ListResultModel, ListResultParams } from '~@/api/dashboard/analysis'
import { delListApi, getListApi } from '~@/api/dashboard/analysis'
const columns = shallowRef([
  {
    title: '#',
    dataIndex: 'id',
  },
  {
    title: '标题',
    dataIndex: 'title',
  },
  {
    title: '账号',
    dataIndex: 'username',
  },
  {
    title: '密码',
    dataIndex: 'password',
  },
  {
    title: '操作',
    dataIndex: 'action',
    width: 200,
  },
])
const loading = shallowRef(false)
const dataSource = shallowRef<ListResultModel[]>([])
const formModel = reactive<ListResultParams>({
  username: undefined,
  title: undefined,
})

const actionModalRef = shallowRef()
const modalState = reactive<AnalysisModalProps>({
  title: '创建数据',
  open: false,
  type: 'create',
})
const init = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const { data } = await getListApi(formModel)
    dataSource.value = data ?? []
  }
  catch (e) {
    console.log(e)
  }
  finally {
    loading.value = false
  }
}

const onSearch = async () => {
  // todo
  await init()
}

const onReset = async () => {
  // 清空所有参数重新请求
  formModel.username = undefined
  formModel.title = undefined
  await init()
}

/**
 * 弹框
 * @param type 弹框类型
 * @param record 弹框数据，仅编辑
 */
const hanldeAction = (type: AnalysisModalProps['type'], record?: ListResultModel) => {
  if (type === 'edit') {
    actionModalRef.value.updateModelValue(record)
    modalState.title = '编辑数据'
  }
  else {
    modalState.title = '创建数据'
  }
  modalState.type = type
  modalState.open = true
}

/**
 * 删除数据
 * @param record 数据
 */
const handleDel = async (record?: ListResultModel) => {
  const close = message.loading('删除中...')
  try {
    const res = await delListApi(record!.id)
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
</script>

<template>
  <div p-2>
    <a-card mb-4>
      <a-form :model="formModel">
        <a-row :gutter="[15, 0]">
          <a-col :span="12">
            <a-form-item name="username" label="账号">
              <a-input v-model:value="formModel.username" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item name="title" label="标题">
              <a-input v-model:value="formModel.title" />
            </a-form-item>
          </a-col>
          <a-row w-full px-12px>
            <a-col :span="24">
              <a-space flex justify-end w-full>
                <a-button :loading="loading" type="primary" @click="onSearch">
                  查询
                </a-button>
                <a-button :loading="loading" @click="onReset">
                  重置
                </a-button>
              </a-space>
            </a-col>
          </a-row>
        </a-row>
      </a-form>
    </a-card>

    <a-card title="查询表格">
      <template #extra>
        <a-space>
          <a-button type="primary" @click="hanldeAction('create')">
            创建
          </a-button>
        </a-space>
      </template>
      <a-table :loading="loading" :columns="columns" :data-source="dataSource">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'action'">
            <div flex gap-2>
              <a c-primary @click="hanldeAction('edit', record)">
                编辑
              </a>
              <a
                c-error @click="handleDel(record)"
              >
                删除
              </a>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>
    <AnalysisModal ref="actionModalRef" v-model:open="modalState.open" :type="modalState.type" :title="modalState.title" />
  </div>
</template>

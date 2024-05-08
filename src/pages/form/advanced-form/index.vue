<script setup>
import RepositoryForm from './repository-form.vue'
import TaskForm from './task-form.vue'

defineOptions({
  name: 'AdvancedForm',
})
const repositoryFormRef = ref()
const taskFormRef = ref()
async function handleSubmit() {
  try {
    await taskFormRef.value?.handleSubmit()
    await repositoryFormRef.value?.handleSubmit()
  }
  catch (errorInfo) {
    console.log('Failed:', errorInfo)
  }
}
const state = reactive({
  columns: [
    {
      title: '成员姓名',
      dataIndex: 'name',
      key: 'name',
      width: '20%',
      scopedSlots: { customRender: 'name' },
    },
    {
      title: '工号',
      dataIndex: 'workId',
      key: 'workId',
      width: '20%',
      scopedSlots: { customRender: 'workId' },
    },
    {
      title: '所属部门',
      dataIndex: 'department',
      key: 'department',
      width: '40%',
      scopedSlots: { customRender: 'department' },
    },
    {
      title: '操作',
      key: 'action',
      scopedSlots: { customRender: 'operation' },
    },
  ],
  data: [
    {
      key: '1',
      name: '员工1',
      workId: '001',
      editable: false,
      department: '行政部',
    },
    {
      key: '2',
      name: '员工2',
      workId: '002',
      editable: false,
      department: 'IT部',
    },
    {
      key: '3',
      name: '员工3',
      workId: '003',
      editable: false,
      department: '财务部',
    },
  ],
})
function handleAdd() {
  const key = state.data.length === 0 ? '1' : (Number.parseInt(state.data[state.data.length - 1].key) + 1).toString()
  const newData = {
    key,
    name: `员工${key}`,
    // 如果小于10，前面补00，如001,如果小于100，大于10，前面补0，如010
    workId: Number.parseInt(key) < 10 ? `00${key}` : Number.parseInt(key) < 100 ? `0${key}` : key,
    editable: true,
    department: ['行政部', 'IT部', '财务部'][Math.floor(Math.random() * 3)],
  }
  state.data.push(newData)
}
function remove(key) {
  state.data = state.data.filter(item => item.key !== key)
}
</script>

<template>
  <page-container>
    <template #content>
      高级表单常见于一次性输入和提交大批量数据的场景。
    </template>
    <a-space size="large" direction="vertical" :style="{ width: '100%' }">
      <a-card class="card" title="仓库管理" :bordered="false">
        <RepositoryForm ref="repositoryFormRef" :show-submit="false" />
      </a-card>
      <a-card class="card" title="任务管理" :bordered="false">
        <TaskForm ref="taskFormRef" :show-submit="false" />
      </a-card>
      <a-card>
        <a-table
          :columns="state.columns"
          :data-source="state.data"
          :pagination="false"
        >
          <template #bodyCell="scope">
            <template v-if="scope?.column?.key === 'action'">
              <a-popconfirm
                v-if="state.data.length"
                title="Sure to delete?"
                @confirm="remove(scope?.record?.key)"
              >
                <a>Delete</a>
              </a-popconfirm>
            </template>
          </template>
        </a-table>
        <a-button style="width: 100%; margin-top: 16px; margin-bottom: 8px" type="dashed" @click="handleAdd">
          新增成员
        </a-button>
      </a-card>
    </a-space>
    <FooterToolBar>
      <template #left>
        测试
      </template>
      <template #right>
        <a-button type="primary" @click="handleSubmit">
          提交
        </a-button>
      </template>
    </FooterToolBar>
  </page-container>
</template>

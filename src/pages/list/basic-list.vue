<script setup>
import { Modal } from 'ant-design-vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { createVNode } from 'vue'
import dayjs from 'dayjs'
import { getListApi } from '~@/api/list/basic-list'
import VirtualList from '@/components/virtual-list/index.vue'

const workData = ref([
  {
    title: '我的待办',
    content: '8个任务',
  },
  {
    title: '本周任务平均处理时间',
    content: '32分钟',
  },
  {
    title: '本周完成任务数',
    content: '24个任务',
  },
])
const radioValue = ref('a')
const searchValue = ref()
function onSearch(value) {
  console.log('use value', value)
}
const dataSource = ref([])
const pagination = ref({
  pageSize: 5,
  pageSizeOptions: ['10', '20', '30', '40', '50'],
  showQuickJumper: true,
  total: 0,
})
async function getList() {
  const data = await getListApi()
  dataSource.value = data.data ?? []
  pagination.value.total = data.data?.length ?? 0
  console.log(dataSource.value)
}
function showConfirm(index) {
  Modal.confirm({
    title: '删除任务',
    icon: createVNode(ExclamationCircleOutlined),
    content: createVNode('div', {}, '确定要删除该任务吗?'),
    cancelText: '取消',
    okText: '确认',
    onOk() {
      dataSource.value.splice(index, 1)
    },
    class: 'test',
  })
}
const formState = reactive({
  title: '',
  start: '',
  owner: '清风不问烟雨',
  description: '',
  index: 0,
})
const openModalValue = ref(false)
const isAdd = ref(false)
function openModal(item, charge) {
  if (charge) {
    isAdd.value = true
    openModalValue.value = true
  }
  else {
    isAdd.value = false
    openModalValue.value = true
    formState.title = item.title
    formState.description = item.content
    formState.start = dayjs(item.start)
    formState.index = dataSource.value.indexOf(item)
  }
}
function countDown() {
  let secondsToGo = 2
  const modal = Modal.success({
    title: '操作成功',
    content: `本窗口将在${secondsToGo}后自动关闭`,
  })
  const interval = setInterval(() => {
    secondsToGo -= 1
    modal.update({
      content: `本窗口将在${secondsToGo}后自动关闭`,
    })
  }, 1e3)
  setTimeout(() => {
    clearInterval(interval)
    modal.destroy()
  }, secondsToGo * 1e3)
}
function handleOk() {
  for (const item in formState) {
    if (item !== 'index') {
      if (!formState[item])
        return
    }
  }
  const currentIndex = formState.index
  if (isAdd.value) {
    const newItem = {
      title: formState.title,
      content: formState.description,
      start: formState.start.format('YYYY-MM-DD HH:mm'),
    }
    dataSource.value.splice(0, 0, newItem)
  }
  else {
    for (const item in formState) {
      if (item === 'start')
        dataSource.value[currentIndex][item] = formState.start.format('YYYY-MM-DD HH:mm')
      else
        dataSource.value[currentIndex][item] = formState[item]
    }
  }
  openModalValue.value = false
  cancelModal()
  countDown()
}
function cancelModal() {
  console.log('cancel')
  formState.description = ''
  formState.owner = '清风不问烟雨'
  formState.start = ''
  formState.title = ''
}
onMounted(() => {
  getList()
})
</script>

<template>
  <page-container>
    <!-- 头部 -->
    <a-card>
      <a-row :gutter="16">
        <a-col v-for="(item, index) in workData" :key="index" :xs="24" :sm="8">
          <div class="flex flex-col items-center justify-center">
            <div class="text-zinc-400">
              {{ item.title }}
            </div>
            <div style="font-size: 24px;">
              {{ item.content }}
            </div>
          </div>
        </a-col>
      </a-row>
    </a-card>

    <!-- 列表 -->
    <a-card class="mt-5">
      <template #title>
        <a-card :bordered="false">
          <a-row style="font-weight: normal;">
            <a-col :span="14">
              <span>基本列表</span>
            </a-col>
            <a-col :span="10" class="flex">
              <div>
                <a-radio-group v-model:value="radioValue">
                  <a-radio-button value="a">
                    全部
                  </a-radio-button>
                  <a-radio-button value="b">
                    进行中
                  </a-radio-button>
                  <a-radio-button value="c">
                    等待中
                  </a-radio-button>
                </a-radio-group>
              </div>
              <div class="ml-5">
                <a-input-search
                  v-model:value="searchValue"
                  placeholder="请输入"
                  style="width: 270px"
                  @search="onSearch"
                />
              </div>
            </a-col>
          </a-row>
        </a-card>
      </template>
      <!-- 列表主体 -->
      <VirtualList v-if="dataSource.length !== 0" :data-source="dataSource">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta
              :description="item.content"
            >
              <template #title>
                <a href="https://www.antdv.com/">{{ item.title }}</a>
              </template>
              <template #avatar>
                <a-avatar :src="item.link" />
              </template>
            </a-list-item-meta>
            <template #actions>
              <div class="flex text-gray-400">
                <div class="flex flex-col items-center">
                  <div>Owner</div>
                  <div>清风不问烟雨</div>
                </div>
                <div class="px-10">
                  <div>开始时间</div>
                  <div>{{ item.start }}</div>
                </div>
                <div class="w-45 flex items-center">
                  <a-progress :percent="item.percent" :status="item.status" />
                </div>
              </div>
            </template>
            <template #extra>
              <div class="a-extra">
                <a key="list-loadmore-edit" class="m-4" @click="openModal(item)">
                  编辑
                </a>
                <a-dropdown>
                  <a class="ant-dropdown-link" @click.prevent>
                    更多
                  </a>
                  <template #overlay>
                    <a-menu>
                      <a-menu-item>
                        <a @click="openModal">编辑</a>
                      </a-menu-item>
                      <a-menu-item>
                        <a @click="showConfirm(item.index)">删除</a>
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </div>
            </template>
          </a-list-item>
        </template>
      </VirtualList>
    </a-card>

    <!-- 底部添加按钮 -->
    <a-button type="dashed" @click="openModal(null, true)">
      + 添加
    </a-button>

    <!-- Modal -->
    <a-modal v-model:open="openModalValue" title="任务编辑" @ok="handleOk" @cancel="cancelModal">
      <a-form
        :model="formState"
        name="basic"
        :label-col="{ span: 24 }"
        :wrapper-col="{ span: 24 }"
        autocomplete="off"
      >
        <a-form-item
          label="任务名称"
          name="title"
          :rules="[{ required: true, message: '请输入任务名称' }]"
        >
          <a-input v-model:value="formState.title" />
        </a-form-item>
        <a-form-item
          label="开始时间"
          name="start"
          :rules="[{ required: true, message: '请选择开始时间' }]"
        >
          <a-date-picker v-model:value="formState.start" class="w-1/1" show-time />
        </a-form-item>
        <a-form-item
          label="任务负责人"
          name="owner"
          :rules="[{ required: true, message: '请输入任务负责人' }]"
        >
          <a-select v-model:value="formState.owner" placeholder="please select your zone">
            <a-select-option value="owner">
              清风不问烟雨
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item
          label="产品描述"
          name="description"
          :rules="[{ required: true, message: '请输入产品描述' }]"
        >
          <a-textarea v-model:value="formState.description" placeholder="Basic usage" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </page-container>
</template>

<style>
.a-extra {
  display: flex;
  align-items: center;
  justify-content: end;
}
</style>

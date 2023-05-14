<script setup lang="ts">
import type { ListResultModel } from '~@/api/dashboard/analysis'
import { getListApi } from '~@/api/dashboard/analysis'

const columns = shallowRef([
  {
    title: '#',
    dataIndex: 'id',
  },
  {
    title: 'Name',
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

const init = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const { data } = await getListApi()
    dataSource.value = data ?? []
  }
  catch (e) {
    console.log(e)
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  init()
})
</script>

<template>
  <div p-2>
    <a-table :loading="loading" :columns="columns" :data-source="dataSource">
      <template #bodyCell="{ column }">
        <template v-if="column.dataIndex === 'action'">
          <div flex gap-2>
            <a>
              编辑
            </a>
            <a>
              删除
            </a>
          </div>
        </template>
      </template>
    </a-table>
  </div>
</template>

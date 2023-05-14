<script setup lang="ts">
import { message } from 'ant-design-vue'
import type { AnalysisModalProps } from './interface'
import type { CreateListParams } from '~/api/dashboard/analysis'
import { createListApi, editListApi } from '~/api/dashboard/analysis'
const props = withDefaults(defineProps<AnalysisModalProps>(), {
  type: 'create',
})
const emit = defineEmits<{
  'update:open': [boolean]
}>()

const loading = shallowRef(false)

defineOptions({
  inheritAttrs: false,
})

const formModel = reactive({
  id: undefined,
  username: undefined,
  password: undefined,
  title: undefined,
})

const reset = () => {
  formModel.password = undefined
  formModel.username = undefined
  formModel.title = undefined
}

const handleUpdateOpen = (open: boolean) => {
  reset()
  emit('update:open', open)
}

const handleSubmit = async () => {
  if (loading.value) return
  loading.value = true
  const close = message.loading(props.type === 'edit' ? '编辑中...' : '创建中...')
  try {
    let res
    if (props.type === 'edit')
      res = await editListApi(formModel as any)
    else
      res = await createListApi(formModel)

    if (res.code === 200) {
      message.success(props.type === 'edit' ? '编辑成功' : '创建成功')
      handleUpdateOpen(false)
    }
  }
  catch (e) {
    console.log('e', e)
  }
  finally {
    loading.value = false
    close()
  }
}

const updateModelValue = (model: CreateListParams) => {
  Object.assign(formModel, model)
}

defineExpose({
  updateModelValue,
})
</script>

<template>
  <a-modal
    :open="open" :title="title"
    ok-text="提交"
    :width="800"
    :ok-button-props="{
      loading,
    }"
    @update:open="handleUpdateOpen"
    @ok="handleSubmit"
  >
    <a-form :model="formModel">
      <a-row :gutter="[15, 15]">
        <a-col :span="24">
          <a-form-item name="title" label="标题">
            <a-input v-model:value="formModel.title" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item name="username" label="账号">
            <a-input v-model:value="formModel.username" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item name="password" label="密码">
            <a-input v-model:value="formModel.password" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

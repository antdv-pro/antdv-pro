<script setup>
import { cloneDeep } from 'lodash'

const emit = defineEmits(['cancel', 'ok'])
const isUpdate = ref(false)
const visible = ref(false)
const title = computed(() => {
  return isUpdate.value ? '编辑' : '新增'
})
const formRef = ref()
const formData = ref({
  name: '',
  value: '',
})
const labelCol = { style: { width: '100px' } }
const wrapperCol = { span: 24 }
function open(record) {
  visible.value = true
  isUpdate.value = !!record?.id
  formData.value = cloneDeep(record) ?? {
    name: '',
    value: '',
  }
}
async function handleOk() {
  try {
    await formRef.value?.validate()
    emit('ok')
    visible.value = false
  }
  catch (errorInfo) {
    console.log('Form Validate Failed:', errorInfo)
  }
}
function handleCancel() {
  formRef.value?.resetFields()
  emit('cancel')
}
defineExpose({
  open,
})
</script>

<template>
  <a-modal v-model:open="visible" :title="title" @ok="handleOk" @cancel="handleCancel">
    <a-form ref="formRef" :model="formData" class="w-full" :label-col="labelCol" :wrapper-col="wrapperCol">
      <a-form-item name="name" label="名" :rules="[{ required: true, message: '请输入名' }]">
        <a-input v-model:value="formData.name" :maxlength="50" placeholder="请输入名" />
      </a-form-item>
      <a-form-item name="value" label="值" :rules="[{ required: true, message: '请输入值' }]">
        <a-input v-model:value="formData.value" :maxlength="50" placeholder="请输入值" />
      </a-form-item>
      <a-form-item name="remark" label="备注">
        <a-textarea v-model:value="formData.remark" show-count :maxlength="200" placeholder="请输入备注" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

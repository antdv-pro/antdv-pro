<script setup>
defineProps({
  showSubmit: {
    type: Boolean,
    default: false,
  },
})
const formRef = ref()
async function handleSubmit() {
  try {
    return await formRef.value?.validateFields()
  }
  catch (errorInfo) {
    console.log('Failed:', errorInfo)
  }
}
const formState = reactive({
  name2: null,
  url2: null,
  owner2: null,
  approver2: null,
  dateRange2: null,
  type2: null,
})
defineExpose({
  handleSubmit,
})
</script>

<template>
  <a-form ref="formRef" :model="formState" @submit="handleSubmit">
    <a-row class="form-row" :gutter="16">
      <a-col :lg="6" :md="12" :sm="24">
        <a-form-item
          name="name2"
          :rules="[{ required: true, message: '请输入任务名称' }]"
          label="任务名"
        >
          <a-input v-model:value="formState.name2" placeholder="请输入任务名称" />
        </a-form-item>
      </a-col>
      <a-col :xl="{ span: 7, offset: 1 }" :lg="{ span: 8 }" :md="{ span: 12 }" :sm="24">
        <a-form-item
          name="url2"
          :rules="[{ required: true, message: '请输入任务描述' }]"
          label="任务描述"
        >
          <a-input v-model:value="formState.url2" placeholder="请输入任务描述" />
        </a-form-item>
      </a-col>
      <a-col :xl="{ span: 9, offset: 1 }" :lg="{ span: 10 }" :md="{ span: 24 }" :sm="24">
        <a-form-item
          name="owner2"
          :rules="[{ required: true, message: '请选择执行人' }]"
          label="执行人"
        >
          <a-select
            v-model:value="formState.owner2"
            placeholder="请选择执行人"
          >
            <a-select-option value="KirkLin">
              Kirk Lin
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>
    <a-row class="form-row" :gutter="16">
      <a-col :lg="6" :md="12" :sm="24">
        <a-form-item
          name="approver2"
          :rules="[{ required: true, message: '请选择责任人' }]"
          label="责任人"
        >
          <a-select
            v-model:value="formState.approver2"
            placeholder="请选择责任人"
          >
            <a-select-option value="Aibayanyu">
              Aibayanyu
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
      <a-col :xl="{ span: 7, offset: 1 }" :lg="{ span: 8 }" :md="{ span: 12 }" :sm="24">
        <a-form-item
          name="dateRange2"
          :rules="[{ required: true, message: '请选择提醒时间' }]"
          label="提醒时间"
        >
          <a-time-picker
            v-model:value="formState.dateRange2"
            style="width: 100%"
          />
        </a-form-item>
      </a-col>
      <a-col :xl="{ span: 9, offset: 1 }" :lg="{ span: 10 }" :md="{ span: 24 }" :sm="24">
        <a-form-item
          name="type2"
          :rules="[{ required: true, message: '请选择任务类型' }]"
          label="任务类型"
        >
          <a-select
            v-model:value="formState.type2"
            placeholder="请选择任务类型"
          >
            <a-select-option value="定时执行">
              定时执行
            </a-select-option>
            <a-select-option value="周期执行">
              周期执行
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>
    <a-form-item v-if="showSubmit">
      <a-button html-type="submit">
        Submit
      </a-button>
    </a-form-item>
  </a-form>
</template>

<style scoped>

</style>

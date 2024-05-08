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
    const values = await formRef.value?.validateFields()
    return values
  }
  catch (errorInfo) {
    console.log('Failed:', errorInfo)
  }
}
const formState = reactive({
  name: null,
  url: null,
  owner: null,
  approver: null,
  dateRange: null,
  type: null,
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
          name="name"
          :rules="[{ required: true, message: '请输入仓库名称' }]"
          label="仓库名"
        >
          <a-input v-model:value="formState.name" placeholder="请输入仓库名称" />
        </a-form-item>
      </a-col>
      <a-col :xl="{ span: 7, offset: 1 }" :lg="{ span: 8 }" :md="{ span: 12 }" :sm="24">
        <a-form-item
          name="url"
          :rules="[{ required: true, message: '请输入仓库地址' }]"
          label="仓库地址"
        >
          <a-input v-model:value="formState.url" placeholder="请输入仓库地址" />
        </a-form-item>
      </a-col>
      <a-col :xl="{ span: 9, offset: 1 }" :lg="{ span: 10 }" :md="{ span: 24 }" :sm="24">
        <a-form-item
          name="owner"
          :rules="[{ required: true, message: '请选择管理员' }]"
          label="仓库管理员"
        >
          <a-select
            v-model:value="formState.owner"
            placeholder="请选择管理员"
          >
            <a-select-option value="林同学">
              林同学
            </a-select-option>
            <a-select-option value="张同学">
              张同学
            </a-select-option>
            <a-select-option value="李同学">
              李同学
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>
    <a-row class="form-row" :gutter="16">
      <a-col :lg="6" :md="12" :sm="24">
        <a-form-item
          name="approver"
          :rules="[{ required: true, message: '请选择审批员' }]"
          label="审批人"
        >
          <a-select
            v-model:value="formState.approver"
            placeholder="请选择审批员"
          >
            <a-select-option value="Kirk Lin">
              Kirk Lin
            </a-select-option>
            <a-select-option value="Aibayanyu">
              Aibayanyu
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
      <a-col :xl="{ span: 7, offset: 1 }" :lg="{ span: 8 }" :md="{ span: 12 }" :sm="24">
        <a-form-item
          name="dateRange"
          :rules="[{ required: true, message: '请选择生效日期' }]"
          label="生效日期"
        >
          <a-time-picker
            v-model:value="formState.dateRange"
            style="width: 100%"
          />
        </a-form-item>
      </a-col>
      <a-col :xl="{ span: 9, offset: 1 }" :lg="{ span: 10 }" :md="{ span: 24 }" :sm="24">
        <a-form-item
          name="type"
          :rules="[{ required: true, message: '请选择仓库类型' }]"
          label="仓库类型"
        >
          <a-select
            v-model:value="formState.type"
            placeholder="请选择仓库类型"
          >
            <a-select-option value="公开">
              公开
            </a-select-option>
            <a-select-option value="私密">
              私密
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

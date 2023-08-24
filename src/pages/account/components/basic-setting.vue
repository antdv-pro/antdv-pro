<script setup lang="ts">
import type { UnwrapRef } from 'vue'
import type { Rule } from 'ant-design-vue/es/form'
import { UploadOutlined } from '@ant-design/icons-vue'

interface FormState {
  eamil: string
  name: string
  phoneNumber: string
  region: string | undefined
  address: string
  desc: string
}
const formRef = ref()
const labelCol = { span: 0 }
const wrapperCol = { span: 13 }
const formState: UnwrapRef<FormState> = reactive({
  eamil: 'AntdvPro@abc.com',
  name: 'AntdvPro',
  region: undefined,
  desc: '',
  address: '',
  phoneNumber: '',
})
const rules: Record<string, Rule[]> = {
  name: [
    { required: true, message: '请输入昵称', trigger: 'change' },
  ],

  phoneNumber: [
    { required: true, message: '请输入联系电话', trigger: 'change' },
  ],
  address: [
    { required: true, message: '请输入街道地址', trigger: 'change' },
  ],
  region: [
    { required: true, message: '请选择', trigger: 'change' },
  ],
  eamil: [
    { required: true, message: '请输入邮箱地址', trigger: 'change' },
  ],
  desc: [{ required: true, message: '请输入个人简介', trigger: 'blur' }],
}

const onSubmit = () => {
  formRef.value
    .validate()
    .then(() => {
      console.log('values', formState, toRaw(formState))
    })
    .catch((error: any) => {
      console.log('error', error)
    })
}

function handleChange() {
  console.log('change')
}
</script>

<template>
  <a-card title="基本设置" :bordered="false">
    <a-row>
      <a-col :span="12">
        <a-form
          ref="formRef"
          :model="formState"
          :rules="rules"
          :label-col="labelCol"
          :wrapper-col="wrapperCol"
        >
          <a-form-item ref="eamil" :label-col="{ span: 24 }" label="邮箱" name="eamil">
            <a-input v-model:value="formState.eamil" placeholder="请输入" style="width: 320px;" />
          </a-form-item>
          <a-form-item ref="name" :label-col="{ span: 24 }" label="昵称" name="name">
            <a-input v-model:value="formState.name" placeholder="请输入" style="width: 320px;" />
          </a-form-item>
          <a-form-item label="国家/地区" :label-col="{ span: 24 }" name="region">
            <a-select v-model:value="formState.region" placeholder="请选择">
              <a-select-option value="China">
                中国
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item ref="address" :label-col="{ span: 24 }" label="街道地址" name="address">
            <a-input v-model:value="formState.address" placeholder="请输入" style="width: 320px;" />
          </a-form-item>
          <a-form-item ref="phoneNumber" :label-col="{ span: 24 }" label="联系电话" name="phoneNumber">
            <a-input v-model:value="formState.phoneNumber" placeholder="请输入" />
          </a-form-item>
          <a-form-item label="个人简介" :label-col="{ span: 24 }" name="desc">
            <a-textarea v-model:value="formState.desc" placeholder="请输入" />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" @click="onSubmit">
              提交
            </a-button>
          </a-form-item>
        </a-form>
      </a-col>
      <a-col :span="4">
        <p>头像</p>
        <div class="flex flex-col items-center">
          <a-avatar :size="100">
            <template #icon>
              <img src="https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png" alt="">
            </template>
          </a-avatar>
          <a-upload
            name="file"
            :file-list="[]"
            @change="handleChange"
          >
            <a-button class="mt-4">
              <UploadOutlined />
              更换头像
            </a-button>
          </a-upload>
        </div>
      </a-col>
    </a-row>
  </a-card>
</template>

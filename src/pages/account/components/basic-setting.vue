<script setup lang="ts">
import type { UnwrapRef } from 'vue'
import { UploadOutlined } from '@ant-design/icons-vue'

interface FormState {
  eamil: string
  name: string
  phoneNumber: string
  region: string | undefined
  address: string
  desc: string
}

const { t } = useI18n()

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
const rules: any = computed(() => {
  return {
    name: [
      { required: true, message: t('account.settings.form-rule-name'), trigger: 'change' },
    ],

    phoneNumber: [
      { required: true, message: t('account.settings.form-rule-phoneNumber'), trigger: 'change' },
    ],
    address: [
      { required: true, message: t('account.settings.form-rule-address'), trigger: 'change' },
    ],
    region: [
      { required: true, message: t('account.settings.form-rule-region'), trigger: 'change' },
    ],
    eamil: [
      { required: true, message: t('account.settings.form-rule-email'), trigger: 'change' },
    ],
    desc: [
      { required: true, message: t('account.settings.form-rule-desc'), trigger: 'blur' },
    ],
  }
})

function onSubmit() {
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
  <a-card :title="t('account.settings.basic-setting')" :bordered="false">
    <a-row>
      <a-col :span="12">
        <a-form
          ref="formRef"
          :model="formState"
          :rules="rules"
          :label-col="labelCol"
          :wrapper-col="wrapperCol"
        >
          <a-form-item :label-col="{ span: 24 }" :label="t('account.settings.form-email')" name="eamil">
            <a-input v-model:value="formState.eamil" :placeholder="t('account.settings.form-input-plac')" style="width: 320px;" />
          </a-form-item>
          <a-form-item :label-col="{ span: 24 }" :label="t('account.settings.form-name')" name="name">
            <a-input v-model:value="formState.name" :placeholder="t('account.settings.form-input-plac')" style="width: 320px;" />
          </a-form-item>
          <a-form-item :label="t('account.settings.form-region')" :label-col="{ span: 24 }" name="region">
            <a-select v-model:value="formState.region" :placeholder="t('account.settings.form-select-plac')">
              <a-select-option value="China">
                {{ t('account.settings.form-region-China') }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label-col="{ span: 24 }" :label="t('account.settings.form-address')" name="address">
            <a-input v-model:value="formState.address" :placeholder="t('account.settings.form-input-plac')" style="width: 320px;" />
          </a-form-item>
          <a-form-item :label-col="{ span: 24 }" :label="t('account.settings.form-phoneNumber')" name="phoneNumber">
            <a-input v-model:value="formState.phoneNumber" :placeholder="t('account.settings.form-input-plac')" />
          </a-form-item>
          <a-form-item name="desc" :label="t('account.settings.form-desc')" :label-col="{ span: 24 }">
            <a-textarea v-model:value="formState.desc" :placeholder="t('account.settings.form-input-plac')" />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" @click="onSubmit">
              {{ t('account.settings.form-submit') }}
            </a-button>
          </a-form-item>
        </a-form>
      </a-col>
      <a-col :span="4">
        <p>
          {{ t('account.settings.basic-avatar') }}
        </p>
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
              {{ t('account.settings.basic-avatar.upload') }}
            </a-button>
          </a-upload>
        </div>
      </a-col>
    </a-row>
  </a-card>
</template>

<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue'

const formRef = ref<FormInstance>()
async function handleSubmit() {
  try {
    const values = await formRef.value?.validateFields()
    console.log('Success:', values)
  }
  catch (errorInfo) {
    console.log('Failed:', errorInfo)
  }
}
const formState = reactive<Record<string, any>>({
  name: null,
  buildTime: [],
  goal: '',
  standard: '',
  client: '',
  invites: '',
  weight: 0,
  target: 1,
})
const { t } = useI18n()
</script>

<template>
  <a-card :body-style="{ padding: '24px 32px' }" :bordered="false">
    <a-form ref="formRef" :model="formState">
      <a-form-item
        :label="t('form.basic-form.title.label')"
        :label-col="{ lg: { span: 7 }, sm: { span: 7 } }"
        :rules="[{ required: true, message: t('form.basic-form.title.required') }]"
        :wrapper-col="{ lg: { span: 10 }, sm: { span: 17 } }"
      >
        <a-input
          v-model:value="formState.name"
          name="name"
          :placeholder="t('form.basic-form.title.placeholder')"
        />
      </a-form-item>
      <a-form-item
        :label="t('form.basic-form.date.label')"
        :label-col="{ lg: { span: 7 }, sm: { span: 7 } }"
        :rules="[{ required: true, message: t('form.basic-form.date.required') }]"
        :wrapper-col="{ lg: { span: 10 }, sm: { span: 17 } }"
      >
        <a-range-picker
          v-model:value="formState.buildTime"
          name="buildTime"
          style="width: 100%"
        />
      </a-form-item>
      <a-form-item
        :label="t('form.basic-form.goal.label')"
        :label-col="{ lg: { span: 7 }, sm: { span: 7 } }"
        :rules="[{ required: true, message: t('form.basic-form.goal.required') }]"
        :wrapper-col="{ lg: { span: 10 }, sm: { span: 17 } }"
      >
        <a-textarea
          v-model:value="formState.goal"
          :rows="4"
          :placeholder="t('form.basic-form.goal.placeholder')"
        />
      </a-form-item>
      <a-form-item
        :label="t('form.basic-form.standard.label')"
        :label-col="{ lg: { span: 7 }, sm: { span: 7 } }"
        :rules="[{ required: true, message: t('form.basic-form.standard.required') }]"
        :wrapper-col="{ lg: { span: 10 }, sm: { span: 17 } }"
      >
        <a-textarea
          v-model:value="formState.standard"
          :rows="4"
          :placeholder="t('form.basic-form.standard.placeholder')"
        />
      </a-form-item>
      <a-form-item
        :label="t('form.basic-form.client.label')"
        :label-col="{ lg: { span: 7 }, sm: { span: 7 } }"
        :rules="[{ required: true, message: t('form.basic-form.client.required') }]"
        :wrapper-col="{ lg: { span: 10 }, sm: { span: 17 } }"
      >
        <a-input
          v-model:value="formState.client"
          name="client"
          :placeholder="t('form.basic-form.client.placeholder')"
        />
      </a-form-item>
      <a-form-item
        :label="t('form.basic-form.invites.label')"
        :label-col="{ lg: { span: 7 }, sm: { span: 7 } }"
        :wrapper-col="{ lg: { span: 10 }, sm: { span: 17 } }"
        :required="false"
      >
        <a-input v-model:value="formState.invites" name="invites" :placeholder="t('form.basic-form.invites.placeholder')" />
      </a-form-item>
      <a-form-item
        :label="t('form.basic-form.weight.label')"
        :label-col="{ lg: { span: 7 }, sm: { span: 7 } }"
        :wrapper-col="{ lg: { span: 10 }, sm: { span: 17 } }"
        :required="false"
      >
        <a-input-number v-model:value="formState.weight" :min="0" :max="100" />
        <span> %</span>
      </a-form-item>
      <a-form-item
        :label="t('form.basic-form.public.label')"
        :label-col="{ lg: { span: 7 }, sm: { span: 7 } }"
        :wrapper-col="{ lg: { span: 10 }, sm: { span: 17 } }"
        :required="false"
        :help="t('form.basic-form.label.help')"
      >
        <a-radio-group v-model:value="formState.target">
          <a-radio :value="1">
            {{ t('form.basic-form.radio.public') }}
          </a-radio>
          <a-radio :value="2">
            {{ t('form.basic-form.radio.partially-public') }}
          </a-radio>
          <a-radio :value="3">
            {{ t('form.basic-form.radio.private') }}
          </a-radio>
        </a-radio-group>
        <a-form-item v-show="formState.target === 2">
          <a-select mode="multiple">
            <a-select-option value="4">
              {{ t('form.basic-form.option.A') }}
            </a-select-option>
            <a-select-option value="5">
              {{ t('form.basic-form.option.B') }}
            </a-select-option>
            <a-select-option value="6">
              {{ t('form.basic-form.option.C') }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form-item>
      <a-form-item
        :wrapper-col="{ span: 24 }"
        style="text-align: center"
      >
        <a-button type="primary" @click="handleSubmit">
          {{ t('form.basic-form.form.submit') }}
        </a-button>
        <a-button style="margin-left: 8px">
          {{ t('form.basic-form.form.save') }}
        </a-button>
      </a-form-item>
    </a-form>
  </a-card>
</template>

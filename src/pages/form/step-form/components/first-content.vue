<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form'
import type { UnwrapRef } from 'vue'
import { reactive, ref } from 'vue'
import AccountInput from './account-input.vue'
import type { FirstFormState } from '~/stores/step-form.ts'
import { useStepForm } from '~/stores/step-form.ts'

const stepFormStore = useStepForm()
const { current, stepsLength } = storeToRefs(stepFormStore)

const formRef = ref()
const formState: UnwrapRef<FirstFormState> = reactive({
  paymentAccount: '',
  collectionAccount: {
    type: '',
    account: '',
  },
  payeeName: '',
  amount: undefined,
})
const Email = /^((([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6}\;))*(([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})))$/
const checkAccount = (_: any, value: { account: string }) => {
  if (value.account === '')
    return Promise.reject(new Error('请输入收款人账户'))

  if (!(Email.test(value.account.replace(/\r+|\n+/g, ';'))))
    return Promise.reject(new Error('请输入正确的收款人账户'))

  return Promise.resolve()
}
const rules: Record<string, Rule[]> = {
  collectionAccount: [
    { validator: checkAccount },
  ],
  paymentAccount: [
    {
      required: true,
      message: '请选择付款账户',
      trigger: 'change',
    },
  ],
  payeeName: [{
    required: true,
    message: '请输入收款人姓名',
    trigger: 'change',
  }],
  amount: [{
    required: true,
    message: '请输入转账金额',
    trigger: 'change',
  }],
}

const goPrevStep = () => {
  stepFormStore.prev()
}
const goNextStep = () => {
  formRef.value
    .validate()
    .then(() => {
      stepFormStore.setFirstFormState(formState)
      stepFormStore.next()
    })
    .catch((error) => {
      console.log('error', error)
    })
}
</script>

<template>
  <a-form
    ref="formRef"
    :model="formState"
    :rules="rules"
    layout="vertical"
    class="step-form"
  >
    <a-form-item ref="name" label="付款账户" required name="paymentAccount">
      <a-select v-model:value="formState.paymentAccount" allow-clear placeholder="请选择">
        <a-select-option value="antdv@aibayanyu.com">
          antdv@aibayanyu.com
        </a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item label="收款账户" name="collectionAccount">
      <AccountInput v-model:value="formState.collectionAccount" />
    </a-form-item>
    <a-form-item label="收款人姓名" required name="payeeName">
      <a-input v-model:value="formState.payeeName" allow-clear />
    </a-form-item>
    <a-form-item label="转账金额" required name="amount">
      <a-input-number v-model:value="formState.amount" prefix="￥" style="width: 100%" />
    </a-form-item>

    <a-form-item>
      <a-button v-if="current > 0" type="primary" @click="goPrevStep">
        上一步
      </a-button>
      <a-button v-if="current < stepsLength" type="primary" @click="goNextStep">
        下一步
      </a-button>
    </a-form-item>
  </a-form>
</template>

<style scoped>
.step-form {
  width: 30%;
  margin: 0 auto;
}
</style>

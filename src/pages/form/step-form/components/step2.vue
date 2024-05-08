<script setup>
const emit = defineEmits(['prevStep', 'nextStep'])
const formRef = ref()
const labelCol = { lg: { span: 5 }, sm: { span: 5 } }
const wrapperCol = { lg: { span: 19 }, sm: { span: 19 } }
const formState = reactive({
  paymentPassword: '123456',
})
function nextStep() {
  formRef.value?.validateFields().then(() => {
    emit('nextStep')
  })
}
function prevStep() {
  emit('prevStep')
}
</script>

<template>
  <div>
    <a-form ref="formRef" :model="formState" style="max-width: 500px; margin: 40px auto 0;">
      <a-alert
        :closable="true"
        message="确认转账后，资金将直接打入对方账户，无法退回。"
        style="margin-bottom: 24px;"
      />
      <a-form-item
        label="付款账户"
        :label-col="labelCol"
        :wrapper-col="wrapperCol"
        class="stepFormText"
      >
        antdv@aibayanyu.com
      </a-form-item>
      <a-form-item
        label="收款账户"
        :label-col="labelCol"
        :wrapper-col="wrapperCol"
        class="stepFormText"
      >
        test@example.com
      </a-form-item>
      <a-form-item
        label="收款人姓名"
        :label-col="labelCol"
        :wrapper-col="wrapperCol"
        class="stepFormText"
      >
        Kirk Lin
      </a-form-item>
      <a-form-item
        label="转账金额"
        :label-col="labelCol"
        :wrapper-col="wrapperCol"
        class="stepFormText"
      >
        ￥ 1,000,000.00
      </a-form-item>
      <a-divider />
      <a-form-item
        label="支付密码"
        :label-col="labelCol"
        :wrapper-col="wrapperCol"
        class="stepFormText"
        name="paymentPassword"
        :rules="[{ required: true, message: '需要支付密码才能进行支付' }]"
      >
        <a-input
          v-model:value="formState.paymentPassword"
          type="password"
          style="width: 80%;"
        />
      </a-form-item>
      <a-form-item :wrapper-col="{ span: 19, offset: 5 }">
        <a-button type="primary" @click="nextStep">
          提交
        </a-button>
        <a-button style="margin-left: 8px" @click="prevStep">
          上一步
        </a-button>
      </a-form-item>
    </a-form>
  </div>
</template>

<style lang="less" scoped>
  .stepFormText {
    margin-bottom: 24px;

    .ant-form-item-label,
    .ant-form-item-control {
      line-height: 22px;
    }
  }
</style>

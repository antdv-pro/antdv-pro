<script setup>
const emit = defineEmits(['nextStep'])
const formRef = ref()
const labelCol = { lg: { span: 5 }, sm: { span: 5 } }
const wrapperCol = { lg: { span: 19 }, sm: { span: 19 } }
const formState = reactive({
  paymentAccount: '',
  collectAccount: 'test@example.com',
  name: 'Kirk Lin',
  amount: 1e6,
})
async function nextStep() {
  try {
    await formRef.value?.validateFields()
    emit('nextStep')
  }
  catch (errorInfo) {
    console.log('Failed:', errorInfo)
  }
}
</script>

<template>
  <div>
    <a-form
      ref="formRef" :model="formState" style="max-width: 500px; margin: 40px auto 0;"
      :label-col="labelCol" :wrapper-col="wrapperCol"
    >
      <a-form-item
        label="付款账户"
        name="paymentAccount"
        :rules="[{ required: true, message: '付款账户必须填写' }]"
      >
        <a-select
          v-model:value="formState.paymentAccount"
          placeholder="ant-design@alipay.com"
        >
          <a-select-option value="1">
            antdv@aibayanyu.com
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item
        label="收款账户"
        name="collectAccount"
        :rules="[{ required: true, message: '收款账户必须填写' }]"
      >
        <a-input
          v-model:value="formState.collectAccount"
        />
      </a-form-item>
      <a-form-item
        label="收款人姓名"
        name="name"
        :rules="[{ required: true, message: '收款人名称必须核对' }]"
      >
        <a-input v-model:value="formState.name" />
      </a-form-item>
      <a-form-item
        label="转账金额"
        name="amount"
        :rules="[{ required: true, message: '转账金额必须填写' }]"
      >
        <a-input v-model:value="formState.amount" prefix="￥" />
      </a-form-item>
      <a-form-item :wrapper-col="{ span: 19, offset: 5 }">
        <a-button type="primary" @click="nextStep">
          下一步
        </a-button>
      </a-form-item>
    </a-form>
    <a-divider />
    <div class="step-form-style-desc ant-steps-item-title">
      <h3>
        说明
      </h3>
      <h4>转账到支付宝账户</h4>
      <p>如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。</p>
      <h4>转账到银行卡</h4>
      <p>如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。</p>
    </div>
  </div>
</template>

<style lang="less" scoped>
.step-form-style-desc {
  padding: 0 56px;

  h3 {
    margin: 0 0 12px;
    font-size: 16px;
    line-height: 32px;
  }

  h4 {
    margin: 0 0 4px;
    font-size: 14px;
    line-height: 22px;
  }

  p {
    margin-top: 0;
    margin-bottom: 12px;
    line-height: 22px;
  }
}
</style>

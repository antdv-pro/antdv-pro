<script setup lang="ts">
import { FirstFormState_Field } from '~/pages/form/step-form/util.ts'
import { useStepForm } from '~/stores/step-form.ts'

const stepFormStore = useStepForm()
const { current, stepsLength, firstFormState } = storeToRefs(stepFormStore)
const goPrevStep = () => {
  stepFormStore.prev()
}
const secondFormState = ref({
  pwd: '',
})
const formRef = ref()
const goNextStep = () => {
  formRef.value
    .validate()
    .then(() => {
      console.log(secondFormState.value.pwd)
      stepFormStore.setPwd(secondFormState.value.pwd)
      stepFormStore.next()
    })
    .catch((error) => {
      console.log('error', error)
    })
}
</script>

<template>
  <div class="ant-second-container">
    <a-alert message="确认转账后，资金将直接打入对方账户，无法退回。" type="info" show-icon closable />
    <div class="ant-descriptions-view">
      <table>
        <tbody>
          <template v-for="(value, key) in firstFormState" :key="key">
            <tr
              class="ant-descriptions-row"
            >
              <th
                class="ant-descriptions-item-label"
              >
                <span>{{ FirstFormState_Field[key] }}</span>
              </th>
              <th class="ant-descriptions-item-content">
                <span v-if="FirstFormState_Field[key] === '转账金额' ">
                  <span class="text-xl">{{ value }}</span> 元
                </span>
                <span v-else> {{ value.account ?? value }}</span>
              </th>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <a-form
      ref="formRef"
      :model="secondFormState"
      autocomplete="off"
      layout="vertical"
    >
      <a-form-item
        label="支付密码"
        name="pwd"
        class="w-328px"
        :rules="[{ required: true, message: '需要支付密码才能进行支付' }]"
      >
        <a-input-password v-model:value="secondFormState.pwd" />
      </a-form-item>
    </a-form>
    <a-space>
      <a-button v-if="current > 0" type="primary" @click="goPrevStep">
        上一步
      </a-button>
      <a-button v-if="current < stepsLength" type="primary" @click="goNextStep">
        下一步
      </a-button>
    </a-space>
  </div>
</template>

<style scoped lang="less">
.ant-second-container {
  width: 40%;
  margin: 0 auto;
}

.ant-descriptions-view {
  margin: 16px 0;
  border: 1px solid rgba(0, 0, 0, .06);
  border-radius: 2px;

  > table {
    width: 100%;
    table-layout: auto;
    border-collapse: collapse;

    tbody {
      width: 100%;
    }
  }
}

.ant-descriptions-row {
  border-bottom: 1px solid rgba(0, 0, 0, .06);
}

.ant-descriptions-item-label {
  box-sizing: border-box;
  padding: 16px 24px;
  background-color: #fafafa;
  color: rgba(0, 0, 0, .85);
  font-weight: 400;
  font-size: 14px;
  line-height: 1.5715;
  text-align: start;

}

.ant-descriptions-item-content {
  padding: 16px 24px;
  display: table-cell;
  flex: 1 1;
  color: rgba(0, 0, 0, .85);
  font-weight: 400;
  font-size: 14px;
  line-height: 1.5715;
  word-break: break-word;
  overflow-wrap: break-word;

  &:last-child {
    border-right: none;
  }
}
</style>

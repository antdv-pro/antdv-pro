<script setup>
import Step1 from './components/step1.vue'
import Step2 from './components/step2.vue'
import Step3 from './components/step3.vue'

defineOptions({
  name: 'StepForm',
})
const state = reactive({
  currentTab: 0,
  form: null,
})
function nextStep() {
  if (state.currentTab < 2)
    state.currentTab += 1
}
function prevStep() {
  if (state.currentTab > 0)
    state.currentTab -= 1
}
function finish() {
  state.currentTab = 0
}
</script>

<template>
  <page-container>
    <template #content>
      将一个冗长或用户不熟悉的表单任务分成多个步骤，指导用户完成。
    </template>
    <a-card :bordered="false">
      <a-steps class="steps" :current="state.currentTab">
        <a-step title="填写转账信息" />
        <a-step title="确认转账信息" />
        <a-step title="完成" />
      </a-steps>
      <div class="content">
        <Step1 v-if="state.currentTab === 0" @next-step="nextStep" />
        <Step2 v-if="state.currentTab === 1" @next-step="nextStep" @prev-step="prevStep" />
        <Step3 v-if="state.currentTab === 2" @prevs-step="prevStep" @finish="finish" />
      </div>
    </a-card>
  </page-container>
</template>

<style lang="less" scoped>
  .steps {
    max-width: 750px;
    margin: 16px auto;
  }
</style>

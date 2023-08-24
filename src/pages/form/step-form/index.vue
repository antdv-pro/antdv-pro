<script lang="ts" setup>
import ContentRender from './components/ContentRender.vue'
import FirstContent from './components/FirstContent.vue'
import LastContent from './components/LastContent.vue'
import SecondContent from './components/SecondContent.vue'
import { useStepForm } from '~/stores/step-form.ts'

const stepFormStore = useStepForm()
const { current } = storeToRefs(stepFormStore)

const steps = [
  {
    title: '填写转账信息',
    content: FirstContent,
  },
  {
    title: '确认转账信息',
    content: SecondContent,
  },
  {
    title: '完成',
    content: LastContent,
  },
]

const items = steps.map(item => ({
  key: item.title,
  title: item.title,
}))

stepFormStore.setStepsLength(steps.length - 1)
</script>

<template>
  <a-card>
    <div class="w-80% m-x-auto">
      <a-steps :current="current" :items="items" />
      <div class="steps-content">
        <ContentRender :component="steps[current].content" />
      </div>
    </div>
    <div>
      <h3>说明</h3><h4>转账到支付宝账户</h4>
      <p>
        如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。
      </p>
      <h4>转账到银行卡</h4>
      <p>
        如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。
      </p>
    </div>
  </a-card>
</template>

<style scoped>
.steps-content {
  margin-top: 16px;
}
</style>

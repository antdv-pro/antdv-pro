<script lang="ts" setup>
import ContentRender from './components/content-render.vue'
import FirstContent from './components/first-content.vue'
import LastContent from './components/last-content.vue'
import SecondContent from './components/second-content.vue'
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
  <page-container>
    <a-card :body-style="{ padding: '24px 32px' }" :bordered="false">
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
  </page-container>
</template>

<style scoped>
.steps-content {
  margin-top: 16px;
}
</style>

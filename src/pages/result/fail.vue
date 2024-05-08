<script setup>
import { CloseCircleOutlined, RightOutlined } from '@ant-design/icons-vue'

const { t } = useI18n()
const result = computed(() => {
  return {
    title: t('result.fail.error.title'),
    description: t('result.fail.error.description'),
  }
})
</script>

<template>
  <a-card :bordered="false">
    <a-result status="error" :title="result.title" :sub-title="result.description">
      <template #extra>
        <a-button type="primary">
          {{ t('result.fail.error.btn-text') }}
        </a-button>
      </template>
      <div class="desc flex flex-col gap-2">
        <div class="font-500 ml-4 text-4">
          {{ t('result.fail.error.hint-title') }}
        </div>
        <div class="ml-4">
          <CloseCircleOutlined class="text-red-6" />
          {{ t('result.fail.error.hint-text1') }}
          <a class="ml-4 c-primary" hover="c-primary-hover">{{ t('result.fail.error.hint-btn1') }} <RightOutlined /></a>
        </div>
        <div class="ml-4">
          <CloseCircleOutlined class="text-red-6" />
          {{ t('result.fail.error.hint-text2') }}
          <a class="ml-4 c-primary" hover="c-primary-hover">{{ t('result.fail.error.hint-btn2') }} <RightOutlined /></a>
        </div>
      </div>
    </a-result>
  </a-card>
</template>

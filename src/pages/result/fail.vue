<script setup lang="ts">
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
      <div class="desc">
        <div style="font-size: 16px; color: rgba(0, 0, 0, 0.85); font-weight: 500; margin-bottom: 16px">
          {{ t('result.fail.error.hint-title') }}
        </div>
        <div style="margin-bottom: 16px">
          <CloseCircleOutlined class="text-red-6" />
          {{ t('result.fail.error.hint-text1') }}
          <a style="margin-left: 16px">{{ t('result.fail.error.hint-btn1') }} <RightOutlined /></a>
        </div>
        <div>
          <CloseCircleOutlined class="text-red-6" />
          {{ t('result.fail.error.hint-text2') }}
          <a style="margin-left: 16px">{{ t('result.fail.error.hint-btn2') }} <RightOutlined /></a>
        </div>
      </div>
    </a-result>
  </a-card>
</template>

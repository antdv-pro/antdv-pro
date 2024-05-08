<script setup>
import { DingdingOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'

const { isMobile } = useQueryBreakpoints()
const { t } = useI18n()
</script>

<template>
  <a-card :title="t('profile.advanced.step-title')" :bordered="false">
    <a-steps :current="1" :direction="isMobile && 'horizontal' || 'horizontal'" progress-dot>
      <a-step :title="t('result.success.step1-title')">
        <span class="text-3">{{ t('result.success.step1-title') }}</span>
        <template #description>
          <div class="text-12px align-left">
            <div>
              windlil
              <DingdingOutlined class="m-1 c-primary" />
            </div>
            <div>
              {{ dayjs().subtract(6, 'h').format('YYYY-MM-DD hh:mm') }}
            </div>
          </div>
        </template>
      </a-step>
      <a-step :title="t('result.success.step2-title')">
        <span class="text-3">{{ t('result.success.step2-title') }}</span>
        <template #description>
          <div class="text-12px">
            <div style="margin: 8px 0 4px">
              {{ t("result.success.step2-operator") }}
              <DingdingOutlined class="m-1 c-primary" />
            </div>
            <div>
              <a-button type="link">
                {{ t('profile.advanced.step-notice') }}
              </a-button>
            </div>
          </div>
        </template>
      </a-step>
      <a-step :title="t('result.success.step3-title')">
        <span class="text-3">{{ t('result.success.step3-title') }}</span>
      </a-step>
      <a-step :title="t('result.success.step4-title')">
        <span class="text-3">{{ t('result.success.step4-title') }}</span>
      </a-step>
    </a-steps>
  </a-card>
</template>

<style scoped lang="less">

</style>

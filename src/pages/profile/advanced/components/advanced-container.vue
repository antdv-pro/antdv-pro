<script setup lang="ts">
import dayjs from 'dayjs'
import headerInfo from './header-info.vue'
const { isMobile } = useQueryBreakpoints()

const { t } = useI18n()
</script>

<template>
  <page-container>
    <template #content>
      <header-info />
    </template>
    <a-card title="流程进度" :bordered="false">
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
                  催一下
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
  </page-container>
</template>

<script setup lang="ts">
import { DingdingOutlined } from '@ant-design/icons-vue'
const { t } = useI18n()
const { isMobile } = useQueryBreakpoints()

const result = computed(() => {
  return {
    title: t('result.success.title'),
    description: t('result.success.description'),
  }
})

const directionType = {
  horizontal: 'horizontal',
  vertical: 'vertical',
}
</script>

<template>
  <a-card :bordered="false">
    <a-result status="success" :title="result.title" :sub-title="result.description">
      <template #extra>
        <a-button type="primary">
          {{ t('result.success.btn-return') }}
        </a-button>
        <a-button style="margin-left: 8px">
          {{ t('result.success.btn-project') }}
        </a-button>
        <a-button style="margin-left: 8px">
          {{ t('result.success.btn-print') }}
        </a-button>
      </template>
      <div class="content">
        <div style="font-size: 16px; color: rgba(0, 0, 0, 0.85); font-weight: 500; margin-bottom: 20px;">
          {{ t('result.success.operate-title') }}
        </div>
        <a-row style="margin-bottom: 16px">
          <a-col :xs="24" :sm="12" :md="12" :lg="12" :xl="6">
            <span style="color: rgba(0, 0, 0, 0.85)">{{ t('result.success.operate-id') }}：</span>
            20230824089
          </a-col>
          <a-col :xs="24" :sm="12" :md="12" :lg="12" :xl="6">
            <span style="color: rgba(0, 0, 0, 0.85)">{{ t('result.success.principal') }}：</span>
            Kirk Lin是谁？
          </a-col>
          <a-col :xs="24" :sm="24" :md="24" :lg="24" :xl="12">
            <span style="color: rgba(0, 0, 0, 0.85)">{{ t('result.success.operate-time') }}：</span>
            2023-08-12 ~ 2024-08-12
          </a-col>
        </a-row>
        <a-steps :current="1" :direction="isMobile && directionType.vertical || directionType.horizontal" progress-dot>
          <a-step :title="t('result.success.step1-title')">
            <span style="font-size: 14px">{{ t('result.success.step1-title') }}</span>
            <template #description>
              <div style="fontSize: 12px; color: rgba(0, 0, 0, 0.45); position: relative; left: 42px;text-align: left;">
                <div style="margin: 8px 0 4px">
                  {{t("result.success.step1-operator")}}
                  <DingdingOutlined class="m-1 text-blue-500" />
                </div>
                <div>2023-08-17 12:32</div>
              </div>
            </template>
          </a-step>
          <a-step :title="t('result.success.step2-title')">
            <span style="font-size: 14px">{{ t('result.success.step2-title') }}</span>
            <template #description>
              <div style="fontSize: 12px; color: rgba(0, 0, 0, 0.45); position: relative; left: 42px;text-align: left;">
                <div style="margin: 8px 0 4px">
                  {{t("result.success.step2-operator")}}
                  <DingdingOutlined class="m-1 text-blue-500" />
                </div>
                <div>2023-08-17 13:32</div>
              </div>
            </template>
          </a-step>
          <a-step :title="t('result.success.step3-title')">
            <span style="font-size: 14px">{{ t('result.success.step3-title') }}</span>
          </a-step>
          <a-step :title="t('result.success.step4-title')">
            <span style="font-size: 14px">{{ t('result.success.step4-title') }}</span>
          </a-step>
        </a-steps>
      </div>
    </a-result>
  </a-card>
</template>

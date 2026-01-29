<script setup lang="ts">
import { DingdingOutlined } from '@antdv-next/icons'
import { h } from 'vue'

const { t } = useI18n()

const result = computed(() => {
  return {
    title: t('result.success.title'),
    description: t('result.success.description'),
  }
})
const stepItems = computed(() => ([
  {
    key: '1',
    title: h('span', { class: 'text-3' }, t('result.success.step1-title')),
    content: h('div', { class: 'relative text-12px align-left left-42px' }, [
      h('div', { style: 'margin: 8px 0 4px' }, [
        t('result.success.step1-operator'),
        h(DingdingOutlined, { class: 'm-1 c-primary' }),
      ]),
      h('div', '2023-08-17 12:32'),
    ]),
  },
  {
    key: '2',
    title: h('span', { class: 'text-3' }, t('result.success.step2-title')),
    content: h('div', { class: 'relative text-12px align-left left-42px' }, [
      h('div', { style: 'margin: 8px 0 4px' }, [
        t('result.success.step2-operator'),
        h(DingdingOutlined, { class: 'm-1 c-primary' }),
      ]),
      h('div', '2023-08-17 13:32'),
    ]),
  },
  {
    key: '3',
    title: h('span', { class: 'text-3' }, t('result.success.step3-title')),
  },
  {
    key: '4',
    title: h('span', { class: 'text-3' }, t('result.success.step4-title')),
  },
]))
</script>

<template>
  <a-card variant="borderless">
    <a-result status="success" :title="result.title" :sub-title="result.description">
      <template #extra>
        <a-button type="primary">
          {{ t('result.success.btn-return') }}
        </a-button>
        <a-button class="ml-2">
          {{ t('result.success.btn-project') }}
        </a-button>
        <a-button class="ml-2">
          {{ t('result.success.btn-print') }}
        </a-button>
      </template>
      <div class="content">
        <div class="font-500 ml-4 text-4">
          {{ t('result.success.operate-title') }}
        </div>
        <a-row class="ml-4">
          <a-col :xs="24" :sm="12" :md="12" :lg="12" :xl="6">
            <span>{{ t('result.success.operate-id') }}：</span>
            20230824089
          </a-col>
          <a-col :xs="24" :sm="12" :md="12" :lg="12" :xl="6">
            <span>{{ t('result.success.principal') }}：</span>
            Kirk Lin是谁？
          </a-col>
          <a-col :xs="24" :sm="24" :md="24" :lg="24" :xl="12">
            <span>{{ t('result.success.operate-time') }}：</span>
            2023-08-12 ~ 2024-08-12
          </a-col>
        </a-row>
        <a-steps :current="1" orientation="horizontal" type="dot" :items="stepItems" />
      </div>
    </a-result>
  </a-card>
</template>

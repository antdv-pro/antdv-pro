<script setup lang="ts">
import { DingdingOutlined } from '@antdv-next/icons'
import dayjs from 'dayjs'
import { h, resolveComponent } from 'vue'

const { t } = useI18n()
const AButton = resolveComponent('AButton')
const stepItems = computed(() => ([
  {
    key: '1',
    title: h('span', { class: 'text-3' }, t('result.success.step1-title')),
    content: h('div', { class: 'text-12px align-left' }, [
      h('div', [
        'windlil',
        h(DingdingOutlined, { class: 'm-1 c-primary' }),
      ]),
      h('div', dayjs().subtract(6, 'h').format('YYYY-MM-DD hh:mm')),
    ]),
  },
  {
    key: '2',
    title: h('span', { class: 'text-3' }, t('result.success.step2-title')),
    content: h('div', { class: 'text-12px' }, [
      h('div', { style: 'margin: 8px 0 4px' }, [
        t('result.success.step2-operator'),
        h(DingdingOutlined, { class: 'm-1 c-primary' }),
      ]),
      h('div', [
        h(AButton, { type: 'link' }, { default: () => t('profile.advanced.step-notice') }),
      ]),
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
  <a-card :title="t('profile.advanced.step-title')" variant="borderless">
    <a-steps :current="1" orientation="horizontal" type="dot" :items="stepItems" />
  </a-card>
</template>

<style scoped lang="less">

</style>

<script setup lang="ts">
import dayjs from 'dayjs'

const { t } = useI18n()
const customerItems = computed(() => ([
  { label: t('profile.basic.customerName'), content: '张三' },
  { label: t('profile.advanced.card'), content: 'xxx' },
  { label: t('profile.advanced.id'), content: 'xxx' },
  { label: t('profile.basic.contactNumber'), content: '16866666666' },
  { label: t('profile.basic.deliveryAddress'), content: '张三 16866666666 广东省广州市' },
]))
const groupItems = computed(() => ([
  { label: t('profile.advanced.group-data'), content: '688' },
  { label: t('profile.advanced.group-data-update'), content: dayjs().format('YYYY-MM-DD hh:mm') },
  { label: t('profile.advanced.group-data'), content: '688' },
  { label: t('profile.advanced.group-data-update'), content: dayjs().format('YYYY-MM-DD hh:mm') },
  { label: t('profile.advanced.group-data'), content: '688' },
]))
</script>

<template>
  <a-card variant="borderless" class="my-6">
    <a-descriptions :title="t('profile.basic.customerInfoTitle')" :items="customerItems" />
    <a-divider style="margin-bottom: 32px" />
    <!-- 信息组 -->
    <a-descriptions :title="t('profile.advanced.group')" :items="groupItems" />
    <a-card :title="t('profile.advanced.group')">
      <a-descriptions :items="groupItems" />
      <a-divider style="margin-bottom: 32px" />
      <a-descriptions :items="groupItems" />
    </a-card>
  </a-card>
</template>

<style scoped lang="less">

</style>

<script setup>
import dayjs from 'dayjs'

const { t } = useI18n()
</script>

<template>
  <a-card :bordered="false" class="my-6">
    <a-descriptions :title="t('profile.basic.customerInfoTitle')">
      <a-descriptions-item :label="t('profile.basic.customerName')">
        张三
      </a-descriptions-item>
      <a-descriptions-item :label="t('profile.advanced.card')">
        xxx
      </a-descriptions-item>
      <a-descriptions-item :label="t('profile.advanced.id')">
        xxx
      </a-descriptions-item>
      <a-descriptions-item :label="t('profile.basic.contactNumber')">
        16866666666
      </a-descriptions-item>
      <a-descriptions-item :label="t('profile.basic.deliveryAddress')">
        张三 16866666666 广东省广州市
      </a-descriptions-item>
    </a-descriptions>
    <a-divider style="margin-bottom: 32px" />
    <!-- 信息组 -->
    <a-descriptions :title="t('profile.advanced.group')">
      <a-descriptions-item :label="t('profile.advanced.group-data')">
        688
      </a-descriptions-item>
      <a-descriptions-item :label="t('profile.advanced.group-data-update')">
        {{ dayjs().format('YYYY-MM-DD hh:mm') }}
      </a-descriptions-item>
      <a-descriptions-item :label="t('profile.advanced.group-data')">
        688
      </a-descriptions-item>
      <a-descriptions-item :label="t('profile.advanced.group-data-update')">
        {{ dayjs().format('YYYY-MM-DD hh:mm') }}
      </a-descriptions-item>
      <a-descriptions-item :label="t('profile.advanced.group-data')">
        688
      </a-descriptions-item>
    </a-descriptions>
    <a-card :title="t('profile.advanced.group')">
      <a-descriptions>
        <a-descriptions-item :label="t('profile.advanced.group-data')">
          688
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.advanced.group-data-update')">
          {{ dayjs().format('YYYY-MM-DD hh:mm') }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.advanced.group-data')">
          688
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.advanced.group-data-update')">
          {{ dayjs().format('YYYY-MM-DD hh:mm') }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.advanced.group-data')">
          688
        </a-descriptions-item>
      </a-descriptions>
      <a-divider style="margin-bottom: 32px" />
      <a-descriptions>
        <a-descriptions-item :label="t('profile.advanced.group-data')">
          688
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.advanced.group-data-update')">
          {{ dayjs().format('YYYY-MM-DD hh:mm') }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.advanced.group-data')">
          688
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.advanced.group-data-update')">
          {{ dayjs().format('YYYY-MM-DD hh:mm') }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.advanced.group-data')">
          688
        </a-descriptions-item>
      </a-descriptions>
    </a-card>
  </a-card>
</template>

<style scoped lang="less">

</style>

<script setup>
const { t } = useI18n()
</script>

<template>
  <a-row>
    <a-col v-for="(_, index) in 10" :key="index" :span="12" class="mb-6">
      <a-card hoverable style="width: 400px">
        <template #cover>
          <img src="https://gw.alipayobjects.com/zos/rmsportal/iZBVOIhGJiAnhplqjvZW.png" alt="">
        </template>
        <a-card-meta title="Antdv Pro">
          <template #description>
            <div class="flex">
              好好学习, 天天向上
            </div>
            <div class="text-12px mt-2">
              {{ t('account.center.updated') }}
            </div>
          </template>
        </a-card-meta>
      </a-card>
    </a-col>
  </a-row>
</template>

<style scoped lang="less">

</style>

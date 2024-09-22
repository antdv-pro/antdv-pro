<script setup>
const command = ref('a')
const activeKey = ref()
const { t } = useI18n()
</script>

<template>
  <a-row>
    <a-col :span="19">
      <span class="text-20px font-medium">
        {{ t('profile.basic.orderNumber') }}: 335231129436
      </span>
    </a-col>
    <a-col :span="5">
      <a-radio-group v-model:value="command" button-style="solid">
        <a-radio-button value="a">
          {{ t('profile.advanced.create-do1') }}
        </a-radio-button>
        <a-radio-button value="b">
          {{ t('profile.advanced.create-do2') }}
        </a-radio-button>
        <a-radio-button value="c">
          {{ t('profile.advanced.create-do3') }}
        </a-radio-button>
      </a-radio-group>
    </a-col>
  </a-row>
  <a-card :bordered="false" class="my-5">
    <a-row>
      <a-col :span="8">
        <div>
          <p>
            {{ t('profile.advanced.creater') }}: windlil
          </p>
          <p>
            {{ t('profile.advanced.create-time') }}: 2020-12-12
          </p>
          <p>
            {{ t('profile.advanced.create-effective-date') }}: 2021-01-01
          </p>
        </div>
      </a-col>
      <a-col :span="8">
        <div>
          <p>
            {{ t('profile.advanced.create-product') }}: XX服务
          </p>
          <p>
            {{ t('profile.advanced.create-id') }}: 12345
          </p>
          <p>
            {{ t('profile.advanced.create-info') }}: 请于两个工作日内确认
          </p>
        </div>
      </a-col>
      <a-col :span="8" class="pl-45">
        <div class="flex">
          <div class="flex flex-col items-end mr-5">
            <p class="text-gray-400">
              {{ t('profile.advanced.create-status') }}
            </p>
            <p class="text-24px">
              {{ t('profile.advanced.create-status-finshed') }}
            </p>
          </div>
          <div class="flex flex-col items-end">
            <p class="text-gray-400">
              {{ t('profile.advanced.create-price') }}
            </p>
            <p class="text-24px">
              ￥666.66
            </p>
          </div>
        </div>
      </a-col>
    </a-row>
  </a-card>
  <a-tabs v-model:active-key="activeKey" class="mb--7">
    <a-tab-pane key="1" :tab="t('profile.advanced.tab1')" />
    <a-tab-pane key="2" :tab="t('profile.advanced.tab2')" force-render />
  </a-tabs>
</template>

<style scoped lang="less">
:deep(.ant-btn) {
  border-radius: 0 !important;
}
:deep(.ant-card-body) {
  padding: 0;
}
</style>

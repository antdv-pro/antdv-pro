<script setup lang="ts">
const command = ref()
const activeKey = ref()
</script>

<template>
  <a-row>
    <a-col :span="19">
      <span class="text-20px font-medium">单号: 335231129436</span>
    </a-col>
    <a-col :span="5">
      <a-radio-group v-model:value="command">
        <a-radio-button value="a">
          操作一
        </a-radio-button>
        <a-radio-button value="b">
          操作二
        </a-radio-button>
        <a-radio-button value="c">
          ...
        </a-radio-button>
        <a-button type="primary">
          主操作
        </a-button>
      </a-radio-group>
    </a-col>
  </a-row>
  <a-card :bordered="false" class="my-5">
    <a-row>
      <a-col :span="8">
        <div>
          <p>创建人: 曲丽丽</p>
          <p>创建时间: 2017-12-12</p>
          <p>生效日期: 2017-0707-2017-08-08</p>
        </div>
      </a-col>
      <a-col :span="8">
        <div>
          <p>订购产品: XX服务</p>
          <p>关联单据 12345</p>
          <p>备注: 请于两个工作日内确认</p>
        </div>
      </a-col>
      <a-col :span="8" class="pl-45">
        <div class="flex">
          <div class="flex flex-col items-end mr-5">
            <p class="text-gray-400">
              状态
            </p>
            <p class="text-24px">
              待审核
            </p>
          </div>
          <div class="flex flex-col items-end">
            <p class="text-gray-400">
              订单金额
            </p>
            <p class="text-24px">
              ￥666.66
            </p>
          </div>
        </div>
      </a-col>
    </a-row>
  </a-card>
  <a-tabs v-model:activeKey="activeKey" class="mb--7">
    <a-tab-pane key="1" tab="详细" />
    <a-tab-pane key="2" tab="规则" force-render />
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

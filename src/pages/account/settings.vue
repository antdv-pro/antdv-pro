<script setup lang="ts">
import basicSetting from './components/basic-setting.vue'
import securitySetting from './components/security-setting.vue'
import accountSetting from './components/account-setting.vue'
import messageSetting from './components/message-setting.vue'

const selectedKeys = ref(['1'])
const items = ref([
  {
    key: '1',
    label: '基本设置',
    title: 'Navigation One',
  },
  {
    key: '2',
    label: '安全设置',
    title: 'Navigation Two',
  },
  {
    key: '3',
    label: '账号绑定',
    title: 'Navigation Two',
  },
  {
    key: '4',
    label: '新消息通知',
    title: 'Navigation Two',
  },
])

function handleMenuSelected() {
  console.log(selectedKeys.value)
}
</script>

<template>
  <a-card>
    <a-row :gutter="24">
      <a-col :span="4" style="padding-left: 0;">
        <a-menu
          v-model:selectedKeys="selectedKeys"
          style="width: 250px"
          mode="inline"
          :items="items"
          @click="handleMenuSelected"
        />
      </a-col>
      <a-col :span="20">
        <basicSetting v-if="selectedKeys[0] === '1'" />
        <securitySetting v-if="selectedKeys[0] === '2'" />
        <accountSetting v-if="selectedKeys[0] === '3'" />
        <messageSetting v-if="selectedKeys[0] === '4'" />
      </a-col>
    </a-row>
  </a-card>
</template>

<style scoped lang="less">

</style>

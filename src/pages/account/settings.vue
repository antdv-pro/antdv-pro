<script setup>
import basicSetting from './components/basic-setting.vue'
import securitySetting from './components/security-setting.vue'
import accountSetting from './components/account-setting.vue'
import messageSetting from './components/message-setting.vue'

const { t } = useI18n()
const selectedKeys = ref(['1'])
const items = computed(() => {
  return [
    {
      key: '1',
      label: seti18n('1'),
      title: 'Navigation One',
    },
    {
      key: '2',
      label: seti18n('2'),
      title: 'Navigation Two',
    },
    {
      key: '3',
      label: seti18n('3'),
      title: 'Navigation Two',
    },
    {
      key: '4',
      label: seti18n('4'),
      title: 'Navigation Two',
    },
  ]
})
function seti18n(key) {
  switch (key) {
    case '1':
      return t('account.settings.basic-setting')
    case '2':
      return t('account.settings.security-setting')
    case '3':
      return t('account.settings.account-setting')
    case '4':
      return t('account.settings.message-setting')
  }
}
</script>

<template>
  <a-card>
    <a-row :gutter="24">
      <a-col :span="4" style="padding-left: 0;">
        <a-menu
          v-model:selected-keys="selectedKeys"
          style="width: 250px"
          mode="inline"
          :items="items"
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

<script setup lang="ts">
import { AlipayOutlined, DingdingOutlined, TaobaoOutlined } from '@antdv-next/icons'

interface DataItem {
  title: string
  avatar: string
}

const { t } = useI18n()

const data = computed<DataItem[]>(() => {
  return [
    {
      title: t('account.settings.account.taobao'),
      avatar: 'TaobaoOutlined',
    },
    {
      title: t('account.settings.account.alipay'),
      avatar: 'AlipayOutlined',
    },
    {
      title: t('account.settings.account.dingding'),
      avatar: 'DingdingOutlined',
    },
  ]
})
</script>

<template>
  <a-card :title="t('account.settings.account-setting')" variant="borderless">
    <div class="ant-list">
      <div v-for="item in data" :key="item.title" class="ant-list-item">
        <div class="flex items-center justify-between w-full">
          <div class="ant-list-item-meta">
            <div class="ant-list-item-meta-avatar">
              <TaobaoOutlined v-if="item.avatar === 'TaobaoOutlined' " style="color: #ff4000;" class="account-setting-avatar" />
              <AlipayOutlined v-if="item.avatar === 'AlipayOutlined' " style="color: #2eabff" class="account-setting-avatar" />
              <DingdingOutlined v-if="item.avatar === 'DingdingOutlined' " style="color: #fff; background-color: #2eabff" class="account-setting-avatar" />
            </div>
            <div class="ant-list-item-meta-content">
              <div class="ant-list-item-meta-title">
                <a href="https://www.antdv.com/">{{ item.title }}</a>
              </div>
              <div class="ant-list-item-meta-description">
                {{ t('account.settings.account.not.bind') }}
              </div>
            </div>
          </div>
          <div class="ant-list-item-action">
            <a-button type="link">
              {{ t('account.settings.account.bind') }}
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </a-card>
</template>

<style scoped lang="less">
:deep(.ant-card-body) {
  padding-left: 0 !important;
}
.account-setting-avatar {
  font-size: 48px;
  line-height: 48px;
  border-radius: 2px;
}
</style>

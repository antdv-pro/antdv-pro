<script setup lang="ts">
import { AlipayOutlined, DingdingOutlined, TaobaoOutlined } from '@ant-design/icons-vue'

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
  <a-card :title="t('account.settings.account-setting')" :bordered="false">
    <a-list item-layout="horizontal" :data-source="data">
      <template #renderItem="{ item }">
        <a-list-item>
          <a-list-item-meta
            :description="t('account.settings.account.not.bind')"
          >
            <template #title>
              <a href="https://www.antdv.com/">{{ item.title }}</a>
            </template>
            <template #avatar>
              <TaobaoOutlined v-if="item.avatar === 'TaobaoOutlined' " style="color: #ff4000;" class="account-setting-avatar" />
              <AlipayOutlined v-if="item.avatar === 'AlipayOutlined' " style="color: #2eabff" class="account-setting-avatar" />
              <DingdingOutlined v-if="item.avatar === 'DingdingOutlined' " style="color: #fff; background-color: #2eabff" class="account-setting-avatar" />
            </template>
          </a-list-item-meta>
          <template #actions>
            <a-button type="link">
              {{ t('account.settings.account.bind') }}
            </a-button>
          </template>
        </a-list-item>
      </template>
    </a-list>
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

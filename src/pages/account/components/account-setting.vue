<script setup lang="ts">
import { AlipayOutlined, DingdingOutlined, TaobaoOutlined } from '@ant-design/icons-vue'

interface DataItem {
  title: string
  avatar: string
}
const data: DataItem[] = [
  {
    title: '淘宝账号',
    avatar: 'TaobaoOutlined',
  },
  {
    title: '支付宝账号',
    avatar: 'AlipayOutlined',
  },
  {
    title: '钉钉账号',
    avatar: 'DingdingOutlined',
  },
]
</script>

<template>
  <a-card title="安全设置" :bordered="false">
    <a-list item-layout="horizontal" :data-source="data">
      <template #renderItem="{ item }">
        <a-list-item>
          <a-list-item-meta
            description="当前未绑定"
          >
            <template #title>
              <a href="https://www.antdv.com/">{{ item.title }}</a>
            </template>
            <template #avatar>
              <TaobaoOutlined v-if="item.avatar === 'TaobaoOutlined' " style="color: #ff4000;" />
              <AlipayOutlined v-if="item.avatar === 'AlipayOutlined' " style="color: #2eabff" />
              <DingdingOutlined v-if="item.avatar === 'DingdingOutlined' " style="color: #2eabff" />
            </template>
          </a-list-item-meta>
          <template #actions>
            <a-button type="link">
              修改
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
</style>

<script setup lang="ts">
interface DataItem {
  title: string
  desc: string
}
const data: DataItem[] = [
  {
    title: '账户密码',
    desc: '当前密码强度：强',
  },
  {
    title: '密保手机',
    desc: '已绑定手机: 131****8888',
  },
  {
    title: '密保问题',
    desc: '已设置',
  },
  {
    title: '备用邮箱',
    desc: '已绑定邮箱: ant**.com',
  },
  {
    title: 'MFA 设备',
    desc: '未绑定 MFA 设备',
  },
]
</script>

<template>
  <a-card title="安全设置" :bordered="false">
    <a-list item-layout="horizontal" :data-source="data">
      <template #renderItem="{ item }">
        <a-list-item>
          <a-list-item-meta
            :description="item.desc"
          >
            <template #title>
              <a href="https://www.antdv.com/">{{ item.title }}</a>
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

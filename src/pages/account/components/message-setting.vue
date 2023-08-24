<script setup lang="ts">
interface DataItem {
  title: string
  desc: string
}

const checked = ref(true)

const data: DataItem[] = [
  {
    title: '其他消息',
    desc: '其他用户的消息将以站内信的形式通知',
  },
  {
    title: '系统消息',
    desc: '系统消息将以站内信的形式通知',
  },
  {
    title: '待办任务',
    desc: '待办任务将以站内信的形式通知',
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
            <a-switch v-model:checked="checked" />
          </template>
        </a-list-item>
      </template>
    </a-list>
  </a-card>
</template>

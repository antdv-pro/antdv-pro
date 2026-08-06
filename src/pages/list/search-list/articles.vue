<script lang="ts" setup>
import { LikeOutlined, MessageOutlined, StarOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import Category from './components/category.vue'

const list: any[] = []
function formatTimer(timer: number | string) {
  return dayjs(timer).format('YYYY-MM-DD HH:mm:ss')
}
</script>

<template>
  <div>
    <Category />
    <a-card :bordered="false" class="mt-4">
      <a-list :data-source="list" item-layout="vertical">
        <template #renderItem="{ item }">
          <a-list-item :key="item.id">
            <template #actions>
              <span>
                <StarOutlined /> {{ item.star }}
              </span>
              <span>
                <LikeOutlined /> {{ item.like }}
              </span>
              <span>
                <MessageOutlined /> {{ item.message }}
              </span>
            </template>
            <a-list-item-meta style="margin-bottom: 0">
              <template #title>
                {{ item.title }}
              </template>
            </a-list-item-meta>
            <div class="flex flex-col gap-2">
              <div>
                <a-tag>
                  企业运营
                </a-tag>
                <a-tag>
                  流程规范
                </a-tag>
                <a-tag>
                  管理制度
                </a-tag>
              </div>
              <div>{{ item.content }}</div>
              <div class="flex items-center gap-2">
                <a-avatar :src="item.avatar" :size="22" />
                <span c-primary>
                  {{ item.owner }}
                </span>
                <span c-text-tertiary>
                  发布在
                </span>
                <span c-primary>企业内网公告</span>
                <span c-text-tertiary>
                  {{ formatTimer(item.updatedAt) }}
                </span>
              </div>
            </div>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
  </div>
</template>

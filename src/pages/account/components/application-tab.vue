<script setup lang="ts">
import { DownloadOutlined, EditOutlined, EllipsisOutlined, ShareAltOutlined } from '@ant-design/icons-vue'
</script>

<template>
  <a-row>
    <a-col v-for="(_, index) in 10" :key="index" :span="12" class="mb-6">
      <a-card hoverable style="width: 400px">
        <a-card-meta title="Antdv Pro">
          <template #avatar>
            <a-avatar src="/logo.svg" />
          </template>
          <template #description>
            <div class="flex">
              <div>
                <p>活跃用户</p>
                <p class="text-20px font-bold text-black">
                  20k
                </p>
              </div>
              <div class="ml-20">
                <p>新增用户</p>
                <p class="text-20px font-bold text-black">
                  2,000
                </p>
              </div>
            </div>
          </template>
        </a-card-meta>
        <template #actions>
          <div>
            <DownloadOutlined />
          </div>
          <div>
            <EditOutlined />
          </div>
          <div>
            <ShareAltOutlined />
          </div>
          <div>
            <EllipsisOutlined />
          </div>
        </template>
      </a-card>
    </a-col>
  </a-row>
</template>

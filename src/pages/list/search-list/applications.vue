<script lang="ts" setup>
import { EditOutlined, EllipsisOutlined, SettingOutlined, ShareAltOutlined } from '@ant-design/icons-vue'
import Category from './components/category.vue'

const list: any[] = []
</script>

<template>
  <div>
    <Category />
    <a-list :data-source="list" :grid="{ gutter: 16, xs: 1, sm: 2, md: 4, lg: 4, xl: 4, xxl: 4 }" class="mt-4">
      <template #renderItem="{ item }">
        <a-list-item style="padding: 0">
          <a-card hoverable>
            <a-card-meta :title="item.title">
              <template #avatar>
                <a-avatar :src="item.avatar" :size="22" />
              </template>
              <template #description>
                <div class="flex">
                  <div class="flex flex-col w-50%">
                    <span>活跃用户</span>
                    <span class="text-28px c-text">
                      11 <span class="text-16px">万</span>
                    </span>
                  </div>
                  <div class="flex flex-col w-50%">
                    <span>新增用户</span>
                    <span class="text-28px c-text">1,294</span>
                  </div>
                </div>
              </template>
            </a-card-meta>
            <template #actions>
              <SettingOutlined />
              <EditOutlined />
              <ShareAltOutlined />
              <a-dropdown>
                <EllipsisOutlined />
                <template #overlay>
                  <a-menu>
                    <a-menu-item>
                      <a href="javascript:;">1st menu item</a>
                    </a-menu-item>
                    <a-menu-item>
                      <a href="javascript:;">2nd menu item</a>
                    </a-menu-item>
                    <a-menu-item>
                      <a href="javascript:;">3rd menu item</a>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </template>
          </a-card>
        </a-list-item>
      </template>
    </a-list>
  </div>
</template>

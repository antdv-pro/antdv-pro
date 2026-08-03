<script lang="ts" setup>
import Category from './components/category.vue'

const list: any[] = []
</script>

<template>
  <div>
    <Category />
    <div class="mt-4">
      <a-list :data-source="list" :grid="{ gutter: 16, xs: 1, sm: 2, md: 4, lg: 4, xl: 4, xxl: 4 }">
        <template #renderItem="{ item }">
          <a-list-item style="padding: 0">
            <a-card hoverable>
              <template #cover>
                <img :src="item.cover">
              </template>
              <a-card-meta :title="item.title">
                <template #description>
                  <div class="h-44px">
                    <a-typography-paragraph
                      :ellipsis="{ rows: 2 }"
                      :content="item.subDescription"
                    />
                  </div>
                </template>
              </a-card-meta>
              <div class="flex h-20px mt-16px mb--4px line-height-20px justify-between">
                <span c-text-tertiary>19 分钟前</span>
                <div>
                  <!--                  -->
                  <a-avatar-group>
                    <template v-for="avatar in item.members" :key="avatar.id">
                      <a-avatar :src="avatar.avatar" :size="22" />
                    </template>
                  </a-avatar-group>
                </div>
              </div>
            </a-card>
          </a-list-item>
        </template>
      </a-list>
    </div>
  </div>
</template>

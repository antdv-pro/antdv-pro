<script setup lang="ts">
interface IDataItem {
  title: string
  tags: string[]
  content: string
}

defineProps<{
  dataSource: IDataItem[]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="ant-list">
    <div
      v-for="(item, index) in dataSource"
      :key="index"
      class="ant-list-item"
    >
      <div class="flex flex-col gap-2 w-full">
        <div class="ant-list-item-meta">
          <div class="ant-list-item-meta-content">
            <div class="ant-list-item-meta-title">
              <a href="https://www.antdv.com/">{{ item.title }}</a>
            </div>
            <div class="my-3">
              <a-tag v-for="(tag, tagIndex) in item.tags" :key="tagIndex">
                {{ tag }}
              </a-tag>
            </div>
          </div>
        </div>
        <div>
          {{ item.content }}
        </div>
        <div class="flex items-center">
          <span class="flex items-center">
            <a-avatar :size="20" class="mr-2">
              <template #icon>
                <img src="/logo.svg" alt="">
              </template>
            </a-avatar>
            <span style="color: rgb(22, 119, 255);">
              张三
            </span>
          </span>
          <span class="mx-1">
            {{ t('account.center.posted') }}
          </span>
          <span>
            <a-button type="link" href="https://www.antdv-pro.com/">
              https://www.antdv-pro.com/
            </a-button>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  dataSource: { type: Array, required: true },
})
const { t } = useI18n()
</script>

<template>
  <a-list item-layout="horizontal" :data-source="dataSource">
    <template #renderItem="{ item }">
      <a-list-item>
        <a-list-item-meta>
          <template #title>
            <a href="https://www.antdv.com/">{{ item.title }}</a>
            <div class="my-3">
              <a-tag v-for="(tag, index) in item.tags" :key="index">
                {{ tag }}
              </a-tag>
            </div>
          </template>
        </a-list-item-meta>
        <div>
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
      </a-list-item>
    </template>
  </a-list>
</template>

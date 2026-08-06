<script setup lang="ts">
interface DataItem {
  title: string
  desc: string
}

const { t } = useI18n()

const data = computed<DataItem[]>(() => {
  return []
})
</script>

<template>
  <a-card :title="t('account.settings.security-setting')" :bordered="false">
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
              {{ t('account.settings.modify') }}
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

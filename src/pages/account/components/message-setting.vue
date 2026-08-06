<script setup lang="ts">
interface DataItem {
  title: string
  desc: string
  checked: boolean
}

const { t } = useI18n()

const data = reactive<DataItem[]>([])
</script>

<template>
  <a-card :title="t('account.settings.message-setting')" :bordered="false">
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
            <a-switch v-model:checked="item.checked" />
          </template>
        </a-list-item>
      </template>
    </a-list>
  </a-card>
</template>

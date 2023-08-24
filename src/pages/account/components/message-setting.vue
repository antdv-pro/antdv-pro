<script setup lang="ts">
interface DataItem {
  title: string
  desc: string
}

const { t } = useI18n()

const checked = ref(true)

const data = computed<DataItem[]>(() => {
  return [
    {
      title: t('account.settings.message.title1'),
      desc: t('account.settings.message.desc1'),
    },
    {
      title: t('account.settings.message.title2'),
      desc: t('account.settings.message.desc2'),
    },
    {
      title: t('account.settings.message.title3'),
      desc: t('account.settings.message.desc3'),
    },
  ]
})
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
            <a-switch v-model:checked="checked" />
          </template>
        </a-list-item>
      </template>
    </a-list>
  </a-card>
</template>

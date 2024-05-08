<script setup>
const { t } = useI18n()
const data = reactive([
  {
    title: t('account.settings.message.title1'),
    desc: t('account.settings.message.desc1'),
    checked: true,
  },
  {
    title: t('account.settings.message.title2'),
    desc: t('account.settings.message.desc2'),
    checked: true,
  },
  {
    title: t('account.settings.message.title3'),
    desc: t('account.settings.message.desc3'),
    checked: true,
  },
])
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

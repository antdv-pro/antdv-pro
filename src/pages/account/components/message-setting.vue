<script setup lang="ts">
interface DataItem {
  title: string
  desc: string
  checked: boolean
}

const { t } = useI18n()

const data = reactive<DataItem[]>([
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
  <a-card :title="t('account.settings.message-setting')" variant="borderless">
    <div class="ant-list">
      <div v-for="item in data" :key="item.title" class="ant-list-item">
        <div class="flex items-center justify-between w-full">
          <div class="ant-list-item-meta">
            <div class="ant-list-item-meta-content">
              <div class="ant-list-item-meta-title">
                <a href="https://www.antdv.com/">{{ item.title }}</a>
              </div>
              <div class="ant-list-item-meta-description">
                {{ item.desc }}
              </div>
            </div>
          </div>
          <div class="ant-list-item-action">
            <a-switch v-model:checked="item.checked" />
          </div>
        </div>
      </div>
    </div>
  </a-card>
</template>

<script setup lang="ts">
interface DataItem {
  title: string
  desc: string
}

const { t } = useI18n()

const data = computed<DataItem[]>(() => {
  return [
    {
      title: t('account.settings.security.account-password'),
      desc: t('account.settings.security.account-password-desc'),
    },
    {
      title: t('account.settings.security.phone'),
      desc: t('account.settings.security.phone-desc'),
    },
    {
      title: t('account.settings.security-problem'),
      desc: t('account.settings.security-problem-desc'),
    },
    {
      title: t('account.settings.security.email'),
      desc: t('account.settings.security.email-desc'),
    },
    {
      title: t('account.settings.security.MFA'),
      desc: t('account.settings.security.MFA-desc'),
    },
  ]
})
</script>

<template>
  <a-card :title="t('account.settings.security-setting')" variant="borderless">
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
            <a-button type="link">
              {{ t('account.settings.modify') }}
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </a-card>
</template>

<style scoped lang="less">
:deep(.ant-card-body) {
  padding-left: 0 !important;
}
</style>

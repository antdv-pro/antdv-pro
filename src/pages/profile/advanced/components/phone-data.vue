<script setup>
const { t } = useI18n()
const phoneDate = ref([
  {
    name: '张三',
    phone: '16866666666',
    spentTime: '30min',
    date: '2022-7-10 14:20',
  },
  {
    name: '张三',
    phone: '16866666666',
    spentTime: '99min',
    date: '2022-7-6 16:00',
  },
  {
    name: '张三',
    phone: '16866666666',
    spentTime: '20min',
    date: '2022-7-3 9:20',
  },
  {
    name: '张三',
    phone: '16866666666',
    spentTime: '80min',
    date: '2022-6-20 9:50',
  },
])
function removeItem(item) {
  const index = phoneDate.value.indexOf(item)
  phoneDate.value.splice(index, 1)
}
</script>

<template>
  <a-card :title="t('profile.advanced.call-log')">
    <a-list
      item-layout="horizontal"
      :data-source="phoneDate"
    >
      <template #renderItem="{ item }">
        <a-list-item>
          <template #actions>
            <div>
              <span>{{ t('profile.advanced.call-spent') }}</span>
              <span>{{ item.spentTime }}</span>
            </div>
            <div class="px-10">
              <span>{{ t('profile.advanced.call-date') }}</span>
              <span>{{ item.date }}</span>
            </div>
            <a-button danger type="link" @click="removeItem(item)">
              {{ t('profile.advanced.remove') }}
            </a-button>
          </template>
          <a-list-item-meta
            :description="item.phone"
          >
            <template #title>
              <a>{{ item.name }}</a>
            </template>
          </a-list-item-meta>
        </a-list-item>
      </template>
    </a-list>
  </a-card>
</template>

<style scoped lang="less">

</style>

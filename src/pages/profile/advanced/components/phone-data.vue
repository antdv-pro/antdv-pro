<script setup lang="ts">
const { t } = useI18n()

interface PhoneItem {
  name: string
  phone: string
  spentTime: string
  date: string
}

const phoneDate = ref<PhoneItem[]>([
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

function removeItem(item: PhoneItem) {
  const index = phoneDate.value.indexOf(item)
  phoneDate.value.splice(index, 1)
}
</script>

<template>
  <a-card :title="t('profile.advanced.call-log')">
    <div class="ant-list">
      <div
        v-for="item in phoneDate"
        :key="`${item.name}-${item.phone}-${item.date}`"
        class="ant-list-item"
      >
        <div class="flex items-center justify-between w-full">
          <div class="ant-list-item-meta">
            <div class="ant-list-item-meta-content">
              <div class="ant-list-item-meta-title">
                <a>{{ item.name }}</a>
              </div>
              <div class="ant-list-item-meta-description">
                {{ item.phone }}
              </div>
            </div>
          </div>
          <div class="ant-list-item-action flex items-center">
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
          </div>
        </div>
      </div>
    </div>
  </a-card>
</template>

<style scoped lang="less">

</style>

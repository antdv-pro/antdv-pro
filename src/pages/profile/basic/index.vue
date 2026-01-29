<script setup lang="ts">
defineOptions({
  name: 'BasicProfile',
})
const { t } = useI18n()
const orderItems = computed(() => ([
  { label: t('profile.basic.orderNumber'), content: '1000000000' },
  { label: t('profile.basic.orderStatus'), content: t('profile.basic.orderStatusValue') },
  { label: t('profile.basic.transactionNumber'), content: '1234123421' },
  { label: t('profile.basic.subOrderNumber'), content: '3214321432' },
]))
const customerItems = computed(() => ([
  { label: t('profile.basic.customerName'), content: '张三' },
  { label: t('profile.basic.contactNumber'), content: '18812345678' },
  { label: t('profile.basic.deliveryMethod'), content: '快速配送' },
  { label: t('profile.basic.deliveryAddress'), content: '北京市朝阳区建国路123号' },
  { label: t('profile.basic.remarks'), content: '无特殊要求' },
]))
const productItems = computed(() => ([
  { label: t('profile.basic.productName'), content: '商品A' },
  { label: t('profile.basic.unitPrice'), content: '$50.00' },
  { label: t('profile.basic.quantity'), content: '3' },
  { label: t('profile.basic.subtotal'), content: '$150.00' },
]))
const paymentItems = computed(() => ([
  { label: t('profile.basic.paymentMethod'), content: '在线支付' },
  { label: t('profile.basic.paymentTime'), content: '2023-08-18 14:30:00' },
  { label: t('profile.basic.paymentAmount'), content: '$150.00' },
  { label: t('profile.basic.paymentStatus'), content: '已支付' },
]))
</script>

<template>
  <page-container>
    <a-card variant="borderless">
      <a-descriptions :title="t('profile.basic.orderDetailTitle')" :items="orderItems" />
      <a-divider style="margin-bottom: 32px" />
      <a-descriptions :title="t('profile.basic.customerInfoTitle')" :items="customerItems" />
      <a-divider style="margin-bottom: 32px" />
      <a-descriptions :title="t('profile.basic.productInfoTitle')" :items="productItems" />
      <a-divider style="margin-bottom: 32px" />
      <a-descriptions :title="t('profile.basic.paymentInfoTitle')" :items="paymentItems" />
    </a-card>
  </page-container>
</template>

<style lang="less" scoped>
.title {
  color: rgba(0, 0, 0, 0.85);
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}
</style>

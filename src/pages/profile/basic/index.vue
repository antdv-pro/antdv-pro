<script setup>
defineOptions({
  name: 'BasicProfile',
})
const { t } = useI18n()
</script>

<template>
  <page-container>
    <a-card :bordered="false">
      <a-descriptions :title="t('profile.basic.orderDetailTitle')">
        <a-descriptions-item :label="t('profile.basic.orderNumber')">
          1000000000
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.orderStatus')">
          {{ t('profile.basic.orderStatusValue') }} <!-- You will need to provide the translation for "已完成" -->
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.transactionNumber')">
          1234123421
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.subOrderNumber')">
          3214321432
        </a-descriptions-item>
      </a-descriptions>
      <a-divider style="margin-bottom: 32px" />
      <a-descriptions :title="t('profile.basic.customerInfoTitle')">
        <a-descriptions-item :label="t('profile.basic.customerName')">
          张三
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.contactNumber')">
          18812345678
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.deliveryMethod')">
          快速配送
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.deliveryAddress')">
          北京市朝阳区建国路123号
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.remarks')">
          无特殊要求
        </a-descriptions-item>
      </a-descriptions>
      <a-divider style="margin-bottom: 32px" />
      <a-descriptions :title="t('profile.basic.productInfoTitle')">
        <a-descriptions-item :label="t('profile.basic.productName')">
          商品A
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.unitPrice')">
          $50.00
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.quantity')">
          3
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.subtotal')">
          $150.00
        </a-descriptions-item>
      </a-descriptions>
      <a-divider style="margin-bottom: 32px" />
      <a-descriptions :title="t('profile.basic.paymentInfoTitle')">
        <a-descriptions-item :label="t('profile.basic.paymentMethod')">
          在线支付
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.paymentTime')">
          2023-08-18 14:30:00
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.paymentAmount')">
          $150.00
        </a-descriptions-item>
        <a-descriptions-item :label="t('profile.basic.paymentStatus')">
          已支付
        </a-descriptions-item>
      </a-descriptions>
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

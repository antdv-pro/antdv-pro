<script lang="ts">
import { Form } from 'ant-design-vue'
import type { PropType } from 'vue'
import { defineComponent } from 'vue'

interface PriceValue {
  type: string
  account: string
}

export default defineComponent({
  props: {
    value: { type: Object as PropType<PriceValue>, isRequired: true },
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    const formItemContext = Form.useInjectFormItemContext()
    const triggerChange = (changedValue: { type?: string; account?: string }) => {
      emit('update:value', { ...props.value, ...changedValue })
      formItemContext.onFieldChange()
    }
    const onValueChange = (e: any) => {
      const newAccount = (e.target as any).value
      triggerChange({ account: newAccount })
    }
    const onTypeChange = (type: any) => {
      triggerChange({ type })
    }

    return {
      onValueChange,
      onTypeChange,
    }
  },
})
</script>

<template>
  <span>
    <a-select
      :value="value.type"
      style="width: 30%; margin: 0 2% 0 0 "
      :options="[
        { value: '支付宝', label: '支付宝' },
        { value: '银行账户', label: '银行账户' },
      ]"
      @change="onTypeChange"
    />
    <a-input type="text" :value="value.account" style="width: 68%" @change="onValueChange" />
  </span>
</template>

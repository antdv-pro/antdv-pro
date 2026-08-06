<script setup lang="ts">
import InputNumber, { inputNumberProps } from 'ant-design-vue/es/input-number'
import { formatBusinessNumber, selectNumberInputContents } from '~@/utils/business-number-input'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  ...inputNumberProps(),
  hideZero: {
    type: Boolean,
    default: true,
  },
  selectOnFocus: {
    type: Boolean,
    default: true,
  },
})

const attrs = useAttrs()
const slots = useSlots()
const editable = computed(() => !props.disabled && !props.readonly)
const forwardedProps = computed(() => {
  const { formatter: _formatter, hideZero: _hideZero, onFocus: _onFocus, selectOnFocus: _selectOnFocus, ...rest } = props
  return rest
})
const forwardedBindings = computed(() => ({ ...forwardedProps.value, ...attrs }))

function formatValue(value: number | string, info: { input: string, userTyping: boolean }) {
  if (props.formatter)
    return props.formatter(value, info)
  return formatBusinessNumber(value, info, {
    decimalSeparator: props.decimalSeparator,
    editable: editable.value,
    hideZero: props.hideZero,
    precision: props.precision,
  })
}

function handleFocus(event: FocusEvent) {
  props.onFocus?.(event)
  if (!editable.value || !props.selectOnFocus)
    return
  requestAnimationFrame(() => selectNumberInputContents(event.target))
}
</script>

<template>
  <InputNumber v-bind="forwardedBindings" :formatter="formatValue" @focus="handleFocus">
    <template v-for="(_, name) in slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </InputNumber>
</template>

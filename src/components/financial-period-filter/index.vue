<script setup lang="ts">
import type { Dayjs } from 'dayjs'
import type { FinancialPeriodFilterModel } from '~@/composables/financial-period-filter'
import dayjs from 'dayjs'
import { createFinancialMonthOptions, createFinancialYearOptions, createOccurredFinancialYearOptions } from '~@/composables/financial-period-filter'
import { formatFinancialDisplayRange, getFinancialMonthRange } from '~@/utils/financialPeriod'

const props = withDefaults(defineProps<{
  availableMonthKeys?: string[]
  dateCol?: Record<string, number>
  dateLabel?: string
  yearSpan?: number
  yearCol?: Record<string, number>
  monthCol?: Record<string, number>
  showMonthRange?: boolean
  showDateRange?: boolean
}>(), {
  availableMonthKeys: () => [],
  dateCol: () => ({ xs: 24, md: 8, xl: 8 }),
  dateLabel: '日期范围',
  yearSpan: 5,
  yearCol: () => ({ xs: 24, md: 8, xl: 6 }),
  monthCol: () => ({ xs: 24, md: 8, xl: 6 }),
  showMonthRange: false,
  showDateRange: true,
})

const model = defineModel<FinancialPeriodFilterModel>({ required: true })

const yearOptions = computed(() => {
  return props.availableMonthKeys.length
    ? createOccurredFinancialYearOptions(props.availableMonthKeys)
    : createFinancialYearOptions(undefined, props.yearSpan)
})
const monthOptions = computed(() => createFinancialMonthOptions(model.value.financialYear, props.availableMonthKeys).map((option) => {
  if (!props.showMonthRange || !model.value.financialYear)
    return option

  const range = getFinancialMonthRange(model.value.financialYear, option.value)
  return {
    ...option,
    label: `${option.label}（${formatFinancialDisplayRange(range)}）`,
  }
}))

const pickerDateRange = computed<[Dayjs, Dayjs] | undefined>({
  get() {
    return model.value.dateRange || undefined
  },
  set(value) {
    model.value.dateRange = value || undefined
  },
})

watch(
  () => model.value.financialYear,
  () => {
    if (!model.value.financialYear)
      model.value.financialMonth = undefined
    else if (model.value.financialMonth && !monthOptions.value.some(item => item.value === model.value.financialMonth))
      model.value.financialMonth = undefined
  },
)

watch(
  () => props.availableMonthKeys,
  () => {
    if (yearOptions.value.length && !yearOptions.value.some(item => item.value === model.value.financialYear)) {
      model.value.financialYear = yearOptions.value[0].value
      model.value.financialMonth = undefined
    }
  },
  { immediate: true },
)

function updateDateRange(value?: [string, string] | [Dayjs, Dayjs] | null) {
  if (!value) {
    model.value.dateRange = undefined
    return
  }

  model.value.dateRange = [
    typeof value[0] === 'string' ? dayjs(value[0]) : value[0],
    typeof value[1] === 'string' ? dayjs(value[1]) : value[1],
  ]
}

function filterSelectOption(input: string, option?: { label?: string | number }) {
  return String(option?.label ?? '').includes(input)
}
</script>

<template>
  <a-col v-bind="props.yearCol">
    <a-form-item label="财务年">
      <a-select
        v-model:value="model.financialYear"
        allow-clear
        show-search
        :filter-option="filterSelectOption"
        :options="yearOptions"
        :popup-match-select-width="false"
        :dropdown-style="{ minWidth: '120px' }"
        placeholder="请选择财务年"
      />
    </a-form-item>
  </a-col>
  <a-col v-bind="props.monthCol">
    <a-form-item label="财务月">
      <a-select
        v-model:value="model.financialMonth"
        allow-clear
        show-search
        :disabled="!model.financialYear"
        :filter-option="filterSelectOption"
        :options="monthOptions"
        :popup-match-select-width="false"
        :dropdown-style="{ minWidth: '240px' }"
        placeholder="请选择财务月"
      />
    </a-form-item>
  </a-col>
  <a-col v-if="props.showDateRange" v-bind="props.dateCol">
    <a-form-item :label="props.dateLabel">
      <a-range-picker
        :value="pickerDateRange"
        allow-clear
        style="width: 100%;"
        @update:value="updateDateRange"
      />
    </a-form-item>
  </a-col>
</template>

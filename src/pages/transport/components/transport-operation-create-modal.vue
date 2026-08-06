<script setup lang="ts">
import type { FormInstance, Rule } from 'ant-design-vue/es/form'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'

type TransportOperationCreateKind = 'fuel' | 'etc'

interface FormState {
  occurredAt?: Dayjs
  plateNo: string
  location: string
  product: string
  quantity?: number
  amount?: number
  driver: string
  summaryNo: string
  entryInfo: string
  exitInfo: string
  invoiceNo: string
  cardNo: string
  status: string
}

const props = defineProps<{
  open: boolean
  kind: TransportOperationCreateKind
  saving?: boolean
  vehicleOptions?: Array<{ label: string, value: string }>
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submit': [payload: Record<string, string | number>]
}>()

const formRef = ref<FormInstance>()
const form = reactive<FormState>(createEmptyForm())
const isFuel = computed(() => props.kind === 'fuel')
const title = computed(() => isFuel.value ? '新增加油明细' : '新增ETC费用')
const dateLabel = computed(() => isFuel.value ? '加油时间' : '通行日期')

const positiveNumberRule: Rule = {
  validator: async (_rule, value) => {
    if (Number(value) <= 0)
      throw new Error('请输入大于0的数值')
  },
  trigger: 'change',
}

const rules = computed<Record<string, Rule[]>>(() => ({
  occurredAt: [{ required: true, message: `请选择${dateLabel.value}`, trigger: 'change' }],
  plateNo: [{ required: true, whitespace: true, message: '请输入车牌号', trigger: 'blur' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'change' }, positiveNumberRule],
  ...(isFuel.value
    ? {
        location: [{ required: true, whitespace: true, message: '请输入加油地点', trigger: 'blur' }],
        product: [{ required: true, whitespace: true, message: '请输入油品', trigger: 'blur' }],
        quantity: [{ required: true, message: '请输入加油量', trigger: 'change' }, positiveNumberRule],
      }
    : {
        entryInfo: [{ required: true, whitespace: true, message: '请输入入口信息', trigger: 'blur' }],
        exitInfo: [{ required: true, whitespace: true, message: '请输入出口信息', trigger: 'blur' }],
      }),
}))

function createEmptyForm(): FormState {
  return {
    occurredAt: dayjs(),
    plateNo: '',
    location: '',
    product: '',
    quantity: undefined,
    amount: undefined,
    driver: '',
    summaryNo: '',
    entryInfo: '',
    exitInfo: '',
    invoiceNo: '',
    cardNo: '',
    status: '已录入',
  }
}

function resetForm() {
  Object.assign(form, createEmptyForm())
  nextTick(() => formRef.value?.clearValidate())
}

watch(() => [props.open, props.kind], ([open]) => {
  if (open)
    resetForm()
})

function close() {
  if (!props.saving)
    emit('update:open', false)
}

async function submit() {
  await formRef.value?.validate()
  if (!form.occurredAt)
    return
  if (isFuel.value) {
    emit('submit', {
      date: form.occurredAt.format('YYYY-MM-DD HH:mm'),
      plateNo: form.plateNo.trim(),
      location: form.location.trim(),
      product: form.product.trim(),
      quantity: Number(form.quantity),
      amount: Number(form.amount),
      driver: form.driver.trim(),
      status: form.status,
    })
    return
  }
  emit('submit', {
    updatedAt: form.occurredAt.format('YYYY-MM-DD'),
    plateNo: form.plateNo.trim(),
    entryInfo: form.entryInfo.trim(),
    exitInfo: form.exitInfo.trim(),
    amount: Number(form.amount),
    summaryNo: form.summaryNo.trim(),
    invoiceNo: form.invoiceNo.trim(),
    cardNo: form.cardNo.trim(),
    status: form.status,
  })
}
</script>

<template>
  <a-modal
    :open="open"
    :title="title"
    width="680px"
    :confirm-loading="saving"
    :mask-closable="false"
    :closable="!saving"
    :keyboard="!saving"
    :cancel-button-props="{ disabled: saving }"
    ok-text="保存"
    @cancel="close"
    @ok="submit"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-row :gutter="16">
        <a-col :xs="24" :md="12">
          <a-form-item name="occurredAt" :label="dateLabel">
            <a-date-picker
              v-model:value="form.occurredAt"
              :show-time="isFuel ? { format: 'HH:mm' } : false"
              :format="isFuel ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :md="12">
          <a-form-item name="plateNo" label="车牌号">
            <a-auto-complete v-model:value="form.plateNo" :options="vehicleOptions" placeholder="请输入或选择车牌号" />
          </a-form-item>
        </a-col>

        <template v-if="isFuel">
          <a-col :xs="24" :md="12">
            <a-form-item name="location" label="加油地点">
              <a-input v-model:value="form.location" placeholder="请输入油站或加油地点" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item name="product" label="油品">
              <a-input v-model:value="form.product" placeholder="例如 LNG 液化天然气" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item name="quantity" label="加油量">
              <business-input-number v-model:value="form.quantity" :min="0.01" :precision="2" addon-after="L" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="司机">
              <a-input v-model:value="form.driver" placeholder="请输入司机姓名" />
            </a-form-item>
          </a-col>
        </template>

        <template v-else>
          <a-col :xs="24" :md="12">
            <a-form-item name="entryInfo" label="入口信息">
              <a-input v-model:value="form.entryInfo" placeholder="请输入入口收费站" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item name="exitInfo" label="出口信息">
              <a-input v-model:value="form.exitInfo" placeholder="请输入出口收费站" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="汇总单号">
              <a-input v-model:value="form.summaryNo" placeholder="选填" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="ETC卡号">
              <a-input v-model:value="form.cardNo" placeholder="选填" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="发票号码">
              <a-input v-model:value="form.invoiceNo" placeholder="选填" />
            </a-form-item>
          </a-col>
        </template>

        <a-col :xs="24" :md="12">
          <a-form-item name="amount" label="金额">
            <business-input-number v-model:value="form.amount" :min="0.01" :precision="2" addon-before="¥" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :md="12">
          <a-form-item label="状态">
            <a-select
              v-model:value="form.status"
              :options="[
                { label: '已录入', value: '已录入' },
                { label: '待核对', value: '待核对' },
              ]"
            />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

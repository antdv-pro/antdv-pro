<script setup lang="ts">
type Form = Record<string, any>
const props = defineProps<{
  open: boolean
  vehicleOptions: Array<{ label: string, value: string }>
  plateNos: string[]
  modeAmounts: Record<string, number>
  getModeClass: (mode: string) => string
  submitting: boolean
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'save': []
  'addPlate': []
  'removePlate': [plate: string]
}>()
const form = defineModel<Form>('form', { required: true })
const modes = ['固定月薪', '底薪+差费', '市区倒短固定工资']
function selectMode(mode: string) {
  form.value.salaryMode = mode
  form.value.modeAmount = props.modeAmounts[mode] || 0
}
</script>

<template>
  <a-modal :open="open" title="薪资模式配置" width="520px" ok-text="保存" cancel-text="取消" :confirm-loading="submitting" :mask-closable="false" :closable="!submitting" :keyboard="!submitting" :cancel-button-props="{ disabled: submitting }" destroy-on-close @update:open="emit('update:open', $event)" @ok="emit('save')">
    <a-form layout="vertical" :model="form">
      <a-form-item label="车牌号">
        <div class="plate-editor-list">
          <a-tag v-for="plate in plateNos.filter(item => item !== '-')" :key="plate" closable @close.prevent="emit('removePlate', plate)">
            {{ plate }}<span v-if="form.plateStartDates?.[plate]">（{{ form.plateStartDates[plate] }}起）</span>
          </a-tag>
        </div>
        <div class="plate-add-row">
          <a-select v-model:value="form.newPlateNo" :options="vehicleOptions" show-search allow-clear option-filter-prop="label" placeholder="从车辆信息选择车号" @keydown.enter="emit('addPlate')" />
          <a-date-picker v-model:value="form.newPlateStartDate" value-format="YYYY-MM-DD" placeholder="启用日期" />
          <a-button type="primary" :disabled="!form.newPlateNo || !form.newPlateStartDate" @click="emit('addPlate')">
            添加
          </a-button>
        </div>
        <div class="linked-field-tip">
          车号来源于基础资料的车辆信息；至少保留一个车牌号。
        </div>
      </a-form-item>
      <a-form-item label="已有薪资模式">
        <div class="mode-history-list">
          <div v-for="item in form.modeHistory || []" :key="`${item.startDate}-${item.mode}`" class="mode-history-item">
            <span class="mode-history-date">{{ item.startDate }}</span>
            <span class="current-mode-pill" :class="getModeClass(item.mode)">{{ item.mode }}</span>
            <span class="mode-history-amount">{{ item.amount || '0.00' }} 元</span>
          </div>
          <span v-if="!form.modeHistory?.length" class="linked-field-tip">暂无模式记录</span>
        </div>
      </a-form-item>
      <a-form-item label="新增薪资模式">
        <div class="salary-mode-options" role="radiogroup" aria-label="薪资模式">
          <button v-for="mode in modes" :key="mode" class="salary-mode-option" :class="[getModeClass(mode), { 'is-selected': form.salaryMode === mode }]" type="button" role="radio" :aria-checked="form.salaryMode === mode" @click="selectMode(mode)">
            {{ mode }}
          </button>
        </div>
      </a-form-item>
      <a-form-item label="模式生效日期">
        <a-date-picker v-model:value="form.modeEffectiveDate" value-format="YYYY-MM-DD" class="full-width-input" />
        <div class="linked-field-tip">
          变更当日起按新模式核算，之前的出勤仍按原模式计算。
        </div>
      </a-form-item>
      <a-form-item :label="form.salaryMode === '底薪+差费' ? '底薪（元）' : '模式金额（元）'">
        <business-input-number v-model:value="form.modeAmount" :min="0" :precision="2" class="full-width-input" placeholder="请输入模式金额" />
        <div class="linked-field-tip">
          <template v-if="form.salaryMode === '底薪+差费'">
            差费取该司机当前财务月运单中设定的差费合计。
          </template>
          <template v-else>
            模式金额按生效日期分段参与当月薪酬核算。
          </template>
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.plate-editor-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 28px;
  margin-bottom: 10px;
}
.plate-add-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 150px auto;
  gap: 8px;
}
.full-width-input {
  width: 100%;
}
.linked-field-tip {
  margin-top: 6px;
  color: var(--admin-muted);
  font-size: 12px;
}
.mode-history-list {
  display: grid;
  gap: 8px;
}
.mode-history-item {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 36px;
  padding: 5px 8px;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  background: var(--admin-surface-subtle, #fafafa);
}
.mode-history-date,
.mode-history-amount {
  color: var(--admin-text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.current-mode-pill {
  display: inline-flex;
  min-height: 26px;
  padding: 3px 10px;
  align-items: center;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-weight: 650;
}
.salary-mode-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.salary-mode-option {
  min-height: 42px;
  padding: 8px 12px;
  color: var(--admin-text);
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  cursor: pointer;
}
.salary-mode-option:hover,
.salary-mode-option.is-selected {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgb(22 119 255 / 10%);
}
.salary-mode-option.mode-fixed {
  color: #1677ff;
  background: #eaf2ff;
}
.salary-mode-option.mode-base-diff {
  color: #389e0d;
  background: #edf9e8;
}
.salary-mode-option.mode-base-mileage {
  color: #d46b08;
  background: #fff7e6;
}
.salary-mode-option.mode-mileage {
  color: #722ed1;
  background: #f9f0ff;
}
@media (max-width: 640px) {
  .plate-add-row,
  .salary-mode-options {
    grid-template-columns: 1fr;
  }
}
</style>

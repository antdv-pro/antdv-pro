<script setup lang="ts">
defineProps<{
  templateForm: Record<string, any>
  templateSaving: boolean
  hideNavigation?: boolean
}>()

const emit = defineEmits<{
  saveTemplate: []
  recalculateTemplate: []
  updateTemplateField: [field: string, value: unknown]
}>()
const activeTab = defineModel<'records' | 'templates'>('activeTab', { required: true })
const templateOpen = defineModel<boolean>('templateOpen', { required: true })
</script>

<template>
  <a-tabs v-if="!hideNavigation" v-model:active-key="activeTab" class="salary-inner-tabs">
    <a-tab-pane key="records" tab="工资表" />
    <a-tab-pane key="templates" tab="工资模板" />
  </a-tabs>

  <a-modal v-model:open="templateOpen" title="人员工资模板" width="760px" :confirm-loading="templateSaving" :mask-closable="false" :closable="!templateSaving" :keyboard="!templateSaving" :cancel-button-props="{ disabled: templateSaving }" ok-text="保存并同步" cancel-text="取消" @ok="emit('saveTemplate')">
    <a-alert type="info" show-icon message="模板按人员长期保存，新建月度工资表时自动带入；人员和岗位信息来自组织架构。" class="mb-4" />
    <a-descriptions bordered size="small" :column="3" class="mb-4">
      <a-descriptions-item label="人员">
        {{ templateForm.employeeName || '-' }}
      </a-descriptions-item>
      <a-descriptions-item label="公司">
        {{ templateForm.companyName || '-' }}
      </a-descriptions-item>
      <a-descriptions-item label="部门">
        {{ templateForm.department || '-' }}
      </a-descriptions-item>
      <a-descriptions-item label="岗位">
        {{ templateForm.position || '-' }}
      </a-descriptions-item>
    </a-descriptions>
    <a-form layout="vertical">
      <a-row :gutter="16">
        <a-col
          v-for="field in [
            ['基础工资', 'basicSalary'], ['绩效工资', 'performanceSalary'], ['工龄工资', 'senioritySalary'],
            ['日缺勤扣款', 'absenceDeductionPerDay'], ['社保基数', 'socialSecurityBase'],
          ]" :key="field[1]" :xs="24" :md="12"
        >
          <a-form-item :label="field[0]">
            <business-input-number
              :value="templateForm[field[1]]"
              class="w-full"
              :min="0"
              :precision="2"
              @update:value="emit('updateTemplateField', field[1], $event)"
              @change="emit('recalculateTemplate')"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-divider orientation="left">
        社保自动计算（不含公积金）
      </a-divider>
      <a-descriptions bordered size="small" :column="2">
        <a-descriptions-item label="公司社保合计">
          {{ Number(templateForm.companySocialSecurityTotal || 0).toFixed(2) }}
        </a-descriptions-item>
        <a-descriptions-item label="个人社保合计">
          {{ Number(templateForm.personalSocialSecurityTotal || 0).toFixed(2) }}
        </a-descriptions-item>
        <a-descriptions-item label="应发合计">
          {{ Number(templateForm.totalAmount || 0).toFixed(2) }}
        </a-descriptions-item>
        <a-descriptions-item label="预计实发">
          {{ Number(templateForm.netSalary || 0).toFixed(2) }}
        </a-descriptions-item>
      </a-descriptions>
    </a-form>
  </a-modal>
</template>

<style scoped>
.salary-inner-tabs {
  margin-top: 14px;
  margin-bottom: -14px;

  :deep(.ant-tabs-nav) {
    margin-bottom: 0;
  }

  :deep(.ant-tabs-tab) {
    min-width: 104px;
    justify-content: center;
    padding: 12px 8px;
    font-weight: 600;
  }
}
</style>

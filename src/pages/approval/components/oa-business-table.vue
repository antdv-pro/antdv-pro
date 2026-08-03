<script setup lang="ts">
type Row = Record<string, any>
defineProps<{
  moduleKey: string
  salaryTab: string
  title: string
  columns: Row[]
  rows: Row[]
  pagination: Row | false
  scroll: Row
  loading: boolean
  salaryEditingId?: string
  salaryDirectEntry?: boolean
  wageFields: Set<string>
  socialFields: Set<string>
  columnKey: (dataIndex: unknown) => string
  statusColor: (status: string) => string
  statusCell: (record: Row, dataIndex: unknown) => string
  displayCell: (...args: any[]) => any
  inlineActions: (...args: any[]) => any[]
  moreActions: (...args: any[]) => any[]
}>()
const emit = defineEmits<{
  'viewEmployee': [record: Row]
  'editTemplate': [record: Row]
  'recalculateSalary': [record: Row]
  'runAction': [action: any]
}>()
function salaryStandardMissing(record: Row, field: string) {
  if (!['basicSalary', 'performanceSalary'].includes(field))
    return false
  return Number(record.basicSalary || 0) <= 0 && Number(record.performanceSalary || 0) <= 0
}
</script>

<template>
  <a-card :title="title" :bordered="false">
    <a-table row-key="id" :loading="loading" :size="moduleKey === 'salary' ? 'small' : 'middle'" :columns="columns" :data-source="rows" :pagination="pagination" :scroll="scroll" :row-expandable="() => moduleKey === 'salary' && salaryTab === 'records'" :expand-column-width="40">
      <template v-if="moduleKey === 'salary' && salaryTab === 'records'" #expandedRowRender="{ record }">
        <div class="salary-row-detail">
          <div class="salary-detail-group">
            <h4>工资构成</h4>
            <dl>
              <div><dt>基本工资</dt><dd>{{ displayCell(record, 'basicSalary') }}</dd></div>
              <div><dt>绩效工资</dt><dd>{{ displayCell(record, 'performanceSalary') }}</dd></div>
              <div><dt>出勤工资</dt><dd>{{ displayCell(record, 'attendanceSalary') }}</dd></div>
              <div><dt>工龄工资</dt><dd>{{ displayCell(record, 'senioritySalary') }}</dd></div>
              <div><dt>加班补助</dt><dd>{{ displayCell(record, 'overtimePay') }}</dd></div>
              <div><dt>出差补助</dt><dd>{{ displayCell(record, 'subsidy') }}</dd></div>
            </dl>
          </div>
          <div class="salary-detail-group">
            <h4>社保计算</h4>
            <dl>
              <div><dt>社保基数</dt><dd>{{ displayCell(record, 'socialSecurityBase') }}</dd></div>
              <div><dt>公司养老</dt><dd>{{ displayCell(record, 'companyPension') }}</dd></div>
              <div><dt>公司医疗</dt><dd>{{ displayCell(record, 'companyMedical') }}</dd></div>
              <div><dt>公司工伤</dt><dd>{{ displayCell(record, 'companyInjury') }}</dd></div>
              <div><dt>公司失业</dt><dd>{{ displayCell(record, 'companyUnemployment') }}</dd></div>
              <div><dt>公司合计</dt><dd>{{ displayCell(record, 'companySocialSecurityTotal') }}</dd></div>
            </dl>
          </div>
          <div class="salary-detail-note">
            <span>备注</span>
            <strong>{{ record.remark || '-' }}</strong>
          </div>
        </div>
      </template>
      <template #bodyCell="{ column, record, index }">
        <span v-if="moduleKey === 'salary' && column.dataIndex === 'sequenceNo'">{{ index + 1 }}</span>
        <a-space v-else-if="moduleKey === 'salary' && salaryTab === 'templates' && column.dataIndex === 'action'" class="oa-row-actions" :size="4">
          <a-button type="link" size="small" @click="emit('viewEmployee', record)">
            人员详情
          </a-button>
          <a-button type="link" size="small" @click="emit('editTemplate', record)">
            工资结构
          </a-button>
        </a-space>
        <a-tag v-else-if="moduleKey === 'salary' && salaryTab === 'templates' && ['employeeStatus', 'linkStatus', 'templateStatus'].includes(String(column.dataIndex))" :color="statusColor(String(record[columnKey(column.dataIndex)] || ''))">
          {{ record[columnKey(column.dataIndex)] || '-' }}
        </a-tag>
        <div v-else-if="moduleKey === 'salary' && salaryTab === 'records' && column.dataIndex === 'employeeName'" class="salary-employee-cell">
          <strong>{{ record.employeeName || '-' }}</strong>
          <span>{{ [record.department, record.position].filter(Boolean).join(' / ') || '-' }}</span>
        </div>
        <template v-else-if="moduleKey === 'salary' && salaryDirectEntry && ['actualAttendanceDays', 'subsidy', 'overtimePay'].includes(String(column.dataIndex)) && !['已锁定', '已发放', '已归档'].includes(String(record.status))">
          <business-input-number v-model:value="record[columnKey(column.dataIndex)]" class="salary-entry-input" size="small" :precision="String(column.dataIndex) === 'actualAttendanceDays' ? 1 : 2" :min="0" :max="String(column.dataIndex) === 'actualAttendanceDays' ? (record.requiredAttendanceDays || 31) : undefined" @change="emit('recalculateSalary', record)">
            <template #addonAfter>
              {{ String(column.dataIndex) === 'actualAttendanceDays' ? '天' : '元' }}
            </template>
          </business-input-number>
        </template>
        <span v-else-if="moduleKey === 'salary' && salaryTab === 'records' && ['actualAttendanceDays', 'subsidy', 'overtimePay'].includes(String(column.dataIndex))" class="salary-entry-readonly">
          {{ Number(record[columnKey(column.dataIndex)] || 0).toFixed(String(column.dataIndex) === 'actualAttendanceDays' ? 1 : 2) }} {{ String(column.dataIndex) === 'actualAttendanceDays' ? '天' : '元' }}
        </span>
        <a-tag v-else-if="moduleKey === 'salary' && salaryStandardMissing(record, String(column.dataIndex))" color="orange">
          未设置
        </a-tag>
        <span v-else-if="moduleKey === 'salary' && wageFields.has(String(column.dataIndex))" class="salary-amount salary-amount--wage">{{ displayCell(record, columnKey(column.dataIndex)) }}</span>
        <span v-else-if="moduleKey === 'salary' && socialFields.has(String(column.dataIndex))" class="salary-amount salary-amount--social">{{ displayCell(record, columnKey(column.dataIndex)) }}</span>
        <template v-else-if="moduleKey === 'salary' && salaryEditingId === record.id && ['actualAttendanceDays', 'subsidy', 'overtimePay'].includes(String(column.dataIndex))">
          <business-input-number v-if="column.dataIndex === 'actualAttendanceDays'" v-model:value="record.actualAttendanceDays" size="small" style="width:100%" :precision="1" :min="0" :max="record.requiredAttendanceDays || 31" @change="emit('recalculateSalary', record)" />
          <business-input-number v-else v-model:value="record[columnKey(column.dataIndex)]" size="small" style="width:100%" :precision="2" :min="0" @change="emit('recalculateSalary', record)" />
        </template>
        <a-tag v-else-if="['status', 'payStatus', 'dispatchStatus'].includes(String(column.dataIndex))" :color="statusColor(statusCell(record, column.dataIndex))">
          {{ statusCell(record, column.dataIndex) }}
        </a-tag>
        <a-space v-else-if="column.dataIndex === 'action'" class="oa-row-actions" :size="4">
          <template v-for="action in inlineActions(record)" :key="action.key">
            <a-popconfirm v-if="action.confirm" :title="action.confirmTitle || `确定${action.label}该记录？`" @confirm="emit('runAction', action)">
              <a-button type="link" size="small" :danger="action.danger" :disabled="action.disabled">
                {{ action.label }}
              </a-button>
            </a-popconfirm>
            <a-button v-else type="link" size="small" :danger="action.danger" :disabled="action.disabled" @click="emit('runAction', action)">
              {{ action.label }}
            </a-button>
          </template>
          <a-popover v-if="moreActions(record).length" trigger="click" placement="bottomRight">
            <template #content>
              <div class="oa-action-popover">
                <template v-for="action in moreActions(record)" :key="action.key">
                  <a-popconfirm v-if="action.confirm" :title="action.confirmTitle || `确定${action.label}该记录？`" @confirm="emit('runAction', action)">
                    <a-button type="link" size="small" :danger="action.danger" :disabled="action.disabled">
                      {{ action.label }}
                    </a-button>
                  </a-popconfirm><a-button v-else type="link" size="small" :danger="action.danger" :disabled="action.disabled" @click="emit('runAction', action)">
                    {{ action.label }}
                  </a-button>
                </template>
              </div>
            </template><a-button type="link" size="small">
              更多
            </a-button>
          </a-popover>
        </a-space>
        <a-tooltip v-else :title="displayCell(record, columnKey(column.dataIndex))">
          <span class="cell-ellipsis">{{ displayCell(record, columnKey(column.dataIndex)) }}</span>
        </a-tooltip>
      </template>
    </a-table>
  </a-card>
</template>

<style scoped>
.salary-amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.salary-amount--wage {
  color: #1677ff;
}
.salary-amount--social {
  color: #389e0d;
}
.oa-action-popover {
  display: flex;
  flex-direction: column;
  min-width: 110px;
}
.cell-ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.salary-employee-cell {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.salary-employee-cell strong {
  overflow: hidden;
  color: var(--admin-text);
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.salary-employee-cell span {
  overflow: hidden;
  color: var(--admin-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.salary-entry-input {
  width: 100%;
  font-variant-numeric: tabular-nums;
}

.salary-entry-readonly {
  color: var(--admin-text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.salary-row-detail {
  display: grid;
  grid-template-columns: minmax(300px, 1fr) minmax(420px, 1.35fr);
  gap: 18px 28px;
  padding: 14px 18px 16px 42px;
  background: var(--admin-surface-muted);
}

.salary-detail-group h4 {
  margin: 0 0 10px;
  color: var(--admin-text);
  font-size: 13px;
  font-weight: 650;
}

.salary-detail-group dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(90px, 1fr));
  gap: 8px 18px;
  margin: 0;
}

.salary-detail-group dl > div {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  gap: 8px;
}

.salary-detail-group dt,
.salary-detail-note span {
  color: var(--admin-text-secondary);
  font-size: 12px;
}

.salary-detail-group dd {
  margin: 0;
  color: var(--admin-text);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.salary-detail-note {
  display: flex;
  grid-column: 1 / -1;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--admin-border);
}

.salary-detail-note strong {
  color: var(--admin-text);
  font-size: 12px;
  font-weight: 500;
}

@media (max-width: 900px) {
  .salary-row-detail {
    grid-template-columns: 1fr;
    padding-left: 16px;
  }

  .salary-detail-group dl {
    grid-template-columns: repeat(2, minmax(90px, 1fr));
  }
}
</style>

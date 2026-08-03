<script setup lang="ts">
import type { RecordActionItem } from '~@/components/record-actions/index.vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { computed, reactive, ref, watch } from 'vue'
import RecordActions from '~@/components/record-actions/index.vue'

type Row = Record<string, any>
const props = defineProps<{
  title: string
  activeTab: string
  attendanceDate: string
  salaryModeCards: Array<{ mode: string, description: string, amount: number, drivers: Row[] }>
  attendancePeriodLabel: string
  calendarDays: Array<{ key: string, day: string | number, week: string, weekend: boolean }>
  attendanceGroups: Array<{ key: string, members: Row[], plateNos: string[], driver?: Row }>
  attendanceGridStyle: Record<string, string>
  columns: Row[]
  rows: Row[]
  pagination: Row
  loading: boolean
  scrollX: number
  getSalaryModeClass: (mode?: string) => string
  getSalaryModeColor: (mode?: string) => string
  toNumber: (value: unknown) => number
  isAttendanceDateColored: (record: Row, date: string) => boolean
  getSalaryModeForDate: (record: Row, date: string) => { mode?: string } | undefined
  getStatusColor: (record: Row) => string
  getStatus: (record: Row) => string
  getAttendanceStatusColor: (value?: string) => string
  getFinancialMonthStart: (record: Row) => string
  isMoneyColumn: (dataIndex: unknown) => boolean
  isStatColumn: (dataIndex: unknown) => boolean
  getColumnValue: (record: Row, dataIndex: unknown) => unknown
  getSalaryComposition: (record: Row) => string
  getActions: (record: Row) => RecordActionItem[]
}>()
const emit = defineEmits<{
  'update:activeTab': [value: string]
  'update:attendanceDate': [value: string]
  'export': []
  'configureMode': [record: Row]
  'saveGlobalMode': [mode: string, amount: number]
  'toggleAttendance': [record: Row, date: string]
  'markAttendance': [record: Row, present: boolean]
}>()
const attendanceSortKey = ref('name')
const attendanceSortOrder = ref<'ascend' | 'descend'>('ascend')
const modeAmountDrafts = reactive<Record<string, number>>({})
watch(() => props.salaryModeCards, (cards) => {
  cards.forEach((card) => {
    modeAmountDrafts[card.mode] = card.amount
  })
}, { immediate: true, deep: true })
function getModeAmountLabel(mode: string) {
  return mode === '底薪+差费' ? '底薪金额（元）' : '固定金额（元）'
}
const sortedAttendanceGroups = computed(() => [...props.attendanceGroups].sort((a, b) => {
  const key = attendanceSortKey.value
  const value = (group: typeof a) => key === 'plateNo' ? group.plateNos.join('、') : key === 'salaryMode' ? String(group.driver?.salaryMode || '') : key === 'attendanceDays' ? props.toNumber(group.driver?.attendanceDays) : String(group.driver?.name || '')
  const left = value(a)
  const right = value(b)
  const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'zh-CN')
  return attendanceSortOrder.value === 'ascend' ? comparison : -comparison
}))
function toggleAttendanceSort(key: string) {
  if (attendanceSortKey.value === key) {
    attendanceSortOrder.value = attendanceSortOrder.value === 'ascend' ? 'descend' : 'ascend'
  }
  else {
    attendanceSortKey.value = key
    attendanceSortOrder.value = 'ascend'
  }
}
const attendanceRate = (driver: Row) => props.calendarDays.length ? Math.round(props.toNumber(driver.attendanceDays) / props.calendarDays.length * 100) : 0
</script>

<template>
  <a-card class="driver-payroll-card" :title="title" :bordered="false">
    <template #extra>
      <a-space>
        <a-date-picker v-if="activeTab === 'attendance'" :value="attendanceDate" value-format="YYYY-MM-DD" @update:value="emit('update:attendanceDate', String($event))" />
        <a-button @click="emit('export')">
          导出表格
        </a-button>
      </a-space>
    </template>
    <a-tabs :active-key="activeTab" class="driver-payroll-tabs" @update:active-key="emit('update:activeTab', String($event))">
      <a-tab-pane key="payroll" tab="薪资统计" />
      <a-tab-pane key="attendance" tab="出勤统计" />
      <a-tab-pane key="mode" tab="模式配置" />
      <a-tab-pane key="report" tab="月度报表" />
    </a-tabs>
    <div v-if="activeTab === 'mode'" class="salary-mode-card-grid">
      <section v-for="card in salaryModeCards" :key="card.mode" class="salary-mode-card" :class="getSalaryModeClass(card.mode)">
        <div class="salary-mode-card-header">
          <div><h3>{{ card.mode }}</h3><p>{{ card.description }}</p></div>
        </div>
        <div class="salary-mode-amount-row">
          <span>{{ getModeAmountLabel(card.mode) }}</span>
          <business-input-number v-model:value="modeAmountDrafts[card.mode]" :min="0" :precision="2" />
          <a-button type="primary" @click="emit('saveGlobalMode', card.mode, Number(modeAmountDrafts[card.mode] || 0))">
            保存
          </a-button>
        </div>
      </section>
    </div>
    <template v-else-if="activeTab === 'attendance'">
      <div class="driver-attendance-toolbar">
        <div class="attendance-legend">
          <span class="attendance-legend-title">出勤状态</span><span class="legend-check is-active">出勤</span><span class="legend-check">未登记</span><a-divider type="vertical" />
          <span class="attendance-tip">点击日期登记或取消出勤</span>
        </div>
        <a-tag color="blue">
          {{ attendancePeriodLabel }}
        </a-tag>
      </div>
      <div class="driver-attendance-board">
        <div class="attendance-grid attendance-header-row" :style="attendanceGridStyle">
          <div class="attendance-fixed-col">
            <button class="attendance-sort-button" type="button" @click="toggleAttendanceSort('name')">
              司机 <span>{{ attendanceSortKey === 'name' ? (attendanceSortOrder === 'ascend' ? '↑' : '↓') : '↕' }}</span>
            </button>
          </div><div class="attendance-fixed-col plate-col">
            <button class="attendance-sort-button" type="button" @click="toggleAttendanceSort('plateNo')">
              车牌号 <span>{{ attendanceSortKey === 'plateNo' ? (attendanceSortOrder === 'ascend' ? '↑' : '↓') : '↕' }}</span>
            </button>
          </div><div class="attendance-fixed-col mode-col">
            <button class="attendance-sort-button" type="button" @click="toggleAttendanceSort('salaryMode')">
              薪资模式 <span>{{ attendanceSortKey === 'salaryMode' ? (attendanceSortOrder === 'ascend' ? '↑' : '↓') : '↕' }}</span>
            </button>
          </div><div class="attendance-fixed-col rate-col">
            <button class="attendance-sort-button" type="button" @click="toggleAttendanceSort('attendanceDays')">
              出勤率 <span>{{ attendanceSortKey === 'attendanceDays' ? (attendanceSortOrder === 'ascend' ? '↑' : '↓') : '↕' }}</span>
            </button>
          </div>
          <button v-for="day in calendarDays" :key="day.key" class="attendance-day-head" :class="{ 'is-weekend': day.weekend }" type="button" @click="emit('update:attendanceDate', day.key)">
            <span>{{ day.day }}</span><small>{{ day.week }}</small>
          </button>
          <div class="attendance-total-col">
            出勤
          </div>
        </div>
        <div v-for="group in sortedAttendanceGroups" :key="group.key" class="attendance-grid attendance-body-row" :style="attendanceGridStyle">
          <div class="attendance-fixed-col driver-name-cell">
            <strong>{{ group.driver?.name }}</strong>
            <span class="driver-status-text">{{ group.driver?.status || '核算中' }}</span>
          </div>
          <div class="attendance-fixed-col plate-col">
            <div class="plate-list-cell">
              <a-tag v-for="plate in group.plateNos" :key="plate">
                {{ plate }}
              </a-tag><button v-if="group.driver" class="plate-edit-button" type="button" title="调整车号" aria-label="调整车号" @click="emit('configureMode', group.driver)">
                <PlusOutlined />
              </button>
            </div>
          </div>
          <div class="attendance-fixed-col mode-col">
            <button v-if="group.driver" class="inline-config-button mode-config-control" type="button" title="按日期设置薪资模式" @click="emit('configureMode', group.driver)">
              <a-tag :color="getSalaryModeColor(group.driver.salaryMode)">
                {{ group.driver.salaryMode === '纯里程' ? '市区倒短固定工资' : (group.driver.salaryMode || '-') }}
              </a-tag><span class="mode-config-action">设置</span>
            </button><span v-else>-</span>
          </div>
          <div class="attendance-fixed-col rate-col">
            <a-tag v-if="group.driver" :color="toNumber(group.driver.attendanceDays) ? 'blue' : 'default'">
              {{ attendanceRate(group.driver) }}%
            </a-tag><span v-else>-</span>
          </div>
          <div v-for="day in calendarDays" :key="`${group.key}-${day.key}`" class="attendance-day-slot">
            <button v-if="group.driver" class="attendance-day-cell" :class="[isAttendanceDateColored(group.driver, day.key) ? getSalaryModeClass(getSalaryModeForDate(group.driver, day.key)?.mode) : '', { 'is-marked': isAttendanceDateColored(group.driver, day.key), 'is-selected-day': attendanceDate === day.key }]" type="button" @click="emit('toggleAttendance', group.driver, day.key)">
              <span v-if="isAttendanceDateColored(group.driver, day.key)">✓</span>
            </button><span v-else>-</span>
          </div>
          <div class="attendance-total-col attendance-total-value">
            {{ group.driver?.attendanceDays || 0 }}
          </div>
        </div>
      </div>
    </template>
    <a-table v-else class="transport-driver-payroll-table" row-key="code" :columns="columns" :data-source="rows" :pagination="pagination" :loading="loading" :scroll="{ x: scrollX }">
      <template #bodyCell="{ column, record }">
        <a-tag v-if="column.dataIndex === 'status'" :color="getStatusColor(record)">
          {{ getStatus(record) }}
        </a-tag>
        <a-tag v-else-if="column.dataIndex === 'salaryMode'" :color="getSalaryModeColor(record.salaryMode)">
          {{ record.salaryMode === '纯里程' ? '市区倒短固定工资' : (record.salaryMode || '-') }}
        </a-tag>
        <span v-else-if="column.dataIndex === 'salaryComposition'" class="salary-composition">{{ getSalaryComposition(record) }}</span>
        <a-tag v-else-if="column.dataIndex === 'todayAttendance'" :color="getAttendanceStatusColor(record.todayAttendance)">
          {{ record.todayAttendance || '空白' }}
        </a-tag>
        <span v-else-if="column.dataIndex === 'modeStartDate'" class="salary-date-value">{{ getFinancialMonthStart(record) }}</span>
        <a-space v-else-if="column.dataIndex === 'attendanceAction'" size="small">
          <a-button type="link" size="small" @click="emit('markAttendance', record, true)">
            打考勤
          </a-button><a-button type="link" size="small" danger @click="emit('markAttendance', record, false)">
            撤销
          </a-button>
        </a-space>
        <a-button v-else-if="column.dataIndex === 'modeAction'" type="link" size="small" @click="emit('configureMode', record)">
          配置
        </a-button>
        <span v-else-if="isMoneyColumn(column.dataIndex)" :class="column.dataIndex === 'netSalary' ? 'salary-net-amount' : ''">{{ getColumnValue(record, column.dataIndex) || '-' }}</span>
        <span v-else-if="isStatColumn(column.dataIndex)" class="salary-stat-value">{{ getColumnValue(record, column.dataIndex) || '0' }}</span>
        <RecordActions v-else-if="column.dataIndex === 'action'" :actions="getActions(record)" />
      </template>
    </a-table>
  </a-card>
</template>

<style src="./driver-payroll-table.less" lang="less" scoped />

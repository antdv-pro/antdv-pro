<script setup lang="ts">
type Row = Record<string, any>
defineProps<{
  currentGroups: Array<{ company_name: string, subtotal: number }>
  total: number
  groups: Array<{ company_name: string, subtotal: number, rows: Row[] }>
  filteredTotal: number
  columns: Row[]
  scrollX: number
  loading: boolean
  money: (value: unknown) => string
}>()
const emit = defineEmits<{ 'batch': [], 'create': [], 'edit': [record: Row], 'delete': [record: Row], 'history': [record: Row] }>()
const query = defineModel<Row>('query', { required: true })
</script>

<template>
  <div>
    <a-card title="现金余额管理" :bordered="false" mb-4>
      <template #extra>
        <a-space>
          <a-button @click="emit('batch')">
            批量录入余额
          </a-button><a-button type="primary" @click="emit('create')">
            新增余额记录
          </a-button>
        </a-space>
      </template>
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :lg="10">
          <a-card size="small" title="各主体余额合计" class="cash-sub-card">
            <div v-for="group in currentGroups" :key="group.company_name" class="subject-total-row">
              <span>{{ group.company_name }}</span><strong>{{ money(group.subtotal) }}</strong>
            </div><div class="subject-total-row total">
              <span>总汇总</span><strong>{{ money(total) }}</strong>
            </div>
          </a-card>
        </a-col>
        <a-col :xs="24" :lg="14">
          <a-card size="small" title="余额查询" class="cash-sub-card">
            <a-row :gutter="[12, 12]">
              <a-col :xs="24" :md="8">
                <a-date-picker v-model:value="query.balance_date" value-format="YYYY-MM-DD" format="YYYY-MM-DD" placeholder="查看日期余额" allow-clear style="width: 100%;" />
              </a-col><a-col :xs="24" :md="8">
                <a-input v-model:value="query.company_name" placeholder="主体名称" allow-clear />
              </a-col><a-col :xs="24" :md="8">
                <a-input v-model:value="query.bank_name" placeholder="银行名称" allow-clear />
              </a-col>
            </a-row>
          </a-card>
        </a-col>
      </a-row>
    </a-card>
    <a-card title="余额明细表" :bordered="false" mb-4>
      <template #extra>
        <a-tag color="blue">
          总汇总：{{ money(filteredTotal) }}
        </a-tag>
      </template>
      <div v-for="group in groups" :key="group.company_name" class="cash-balance-group">
        <div class="cash-group-title">
          <span>{{ group.company_name }}</span><strong>主体小计：{{ money(group.subtotal) }}</strong>
        </div>
        <a-table row-key="id" size="small" :loading="loading" :pagination="false" :data-source="group.rows" :columns="columns" :scroll="{ x: scrollX }">
          <template #bodyCell="{ column, record }">
            <strong v-if="column.dataIndex === 'balance_amount'">{{ money(record.balance_amount) }}</strong><span v-else-if="column.dataIndex === 'account_no_tail'" class="account-number">{{ record.account_no_tail }}</span><span v-else-if="column.dataIndex === 'last_movement'" class="movement-summary">
              <template v-if="record.balanceMovements?.[0]">
                <strong>+{{ money(record.balanceMovements[0].amount) }}</strong>
                <small>{{ record.balanceMovements[0].receiptCode || '来款入账' }} · {{ record.balanceMovements[0].postedAt }}</small>
              </template>
              <template v-else>
                -
              </template>
            </span><span v-else-if="['company_name', 'bank_name', 'account_name', 'remark'].includes(String(column.dataIndex))" class="full-cell-text">{{ record[String(column.dataIndex)] || '-' }}</span><a-space v-else-if="column.dataIndex === 'action'">
              <a @click="emit('history', record)">查看流水</a><a @click="emit('edit', record)">修改</a><a-popconfirm title="确定删除该余额记录？" ok-type="danger" @confirm="emit('delete', record)">
                <a class="danger-link">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </a-table>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.subject-total-row,
.cash-group-title {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--admin-border-subtle);
}
.subject-total-row.total {
  font-weight: 700;
  border-bottom: 0;
}
.cash-balance-group {
  margin-bottom: 20px;
}
.full-cell-text,
.account-number {
  display: block;
  max-width: 100%;
  line-height: 1.55;
  white-space: normal;
  overflow-wrap: anywhere;
}
.movement-summary {
  display: grid;
  gap: 2px;
}
.movement-summary strong {
  color: #16a34a;
}
.movement-summary small {
  color: #64748b;
}
.account-number {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}
.cash-balance-group :deep(.ant-table-cell) {
  vertical-align: top;
}
.danger-link {
  color: #ff4d4f;
}
</style>

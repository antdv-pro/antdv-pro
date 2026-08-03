<script setup lang="ts">
type Row = Record<string, any>
defineProps<{
  departmentOptions: string[]
  positions: Row[]
  roleOptions: string[]
  treeKeyword: string
  treeData: Array<Row & { key: string | number }>
  selectedKey: string
  selectedRecord?: Row
  activeTab: string
  columns: Row[]
  rows: Row[]
  pagination: Row
  scrollX: number
  loading: boolean
  readOnly?: boolean
  statusColor: (status: string) => string
  columnKey: (dataIndex: unknown) => string
}>()
const emit = defineEmits<{
  'update:treeKeyword': [value: string]
  'update:activeTab': [value: string]
  'query': []
  'reset': []
  'selectTree': [keys: Array<string | number>]
  'create': [type: '部门' | '岗位' | '员工']
  'export': []
  'detail': [record: Row]
  'edit': [record: Row]
  'delete': [record: Row]
  'toggle': [record: Row]
  'role': [record: Row]
  'approver': [record: Row]
  'adjust': [record: Row, field: 'parentDepartment' | 'position']
}>()
const query = defineModel<Row>('query', { required: true })
const statuses = ['正常', '在职', '停用', '离职']
</script>

<template>
  <div>
    <a-card :bordered="false" mb-4>
      <a-form class="oa-query" layout="vertical">
        <a-row :gutter="[16, 16]" align="bottom">
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="关键字">
              <a-input v-model:value="query.keyword" allow-clear placeholder="姓名、工号、手机号、邮箱" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="部门">
              <a-select v-model:value="query.orgDepartment" allow-clear placeholder="请选择部门">
                <a-select-option v-for="item in departmentOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="岗位">
              <a-select v-model:value="query.orgPosition" allow-clear placeholder="请选择岗位">
                <a-select-option v-for="item in positions" :key="item.code" :value="item.name">
                  {{ item.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item label="角色">
              <a-select v-model:value="query.orgRole" allow-clear placeholder="请选择角色">
                <a-select-option v-for="item in roleOptions" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="3">
            <a-form-item label="状态">
              <a-select v-model:value="query.status" allow-clear placeholder="请选择状态">
                <a-select-option v-for="item in statuses" :key="item" :value="item">
                  {{ item }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="5">
            <a-form-item label="入职日期">
              <a-range-picker v-model:value="query.hireDateRange" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="4">
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="emit('query')">
                  查询
                </a-button><a-button @click="emit('reset')">
                  重置
                </a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>
    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :xl="5">
        <a-card title="组织树" :bordered="false" class="org-tree-card">
          <template #extra>
            <a-button v-if="!readOnly" size="small" @click="emit('create', '部门')">
              新增部门
            </a-button>
          </template>
          <a-input-search :value="treeKeyword" mb-3 allow-clear placeholder="搜索部门名称" @update:value="emit('update:treeKeyword', String($event || ''))" />
          <a-tree :tree-data="treeData" :selected-keys="[selectedKey]" default-expand-all block-node @select="emit('selectTree', $event as Array<string | number>)" />
        </a-card>
      </a-col>
      <a-col :xs="24" :xl="19">
        <a-card :bordered="false">
          <template #title>
            <a-space>
              <span>{{ selectedRecord?.name || '组织架构' }}</span><a-tag v-if="selectedRecord" :color="statusColor(selectedRecord.status)">
                {{ selectedRecord.status }}
              </a-tag>
            </a-space>
          </template>
          <template #extra>
            <a-space wrap>
              <a-button @click="emit('export')">
                导出
              </a-button><a-button v-if="!readOnly" type="primary" @click="emit('create', '员工')">
                新增员工
              </a-button>
            </a-space>
          </template>
          <a-descriptions v-if="selectedRecord" mb-4 bordered size="small" :column="{ xs: 1, md: 2, xl: 4 }">
            <a-descriptions-item label="编码">
              {{ selectedRecord.code }}
            </a-descriptions-item><a-descriptions-item label="负责人">
              {{ selectedRecord.leader || '-' }}
            </a-descriptions-item><a-descriptions-item label="联系电话">
              {{ selectedRecord.phone || '-' }}
            </a-descriptions-item><a-descriptions-item label="审批人">
              {{ selectedRecord.approver || '-' }}
            </a-descriptions-item>
          </a-descriptions>
          <a-tabs :active-key="activeTab" @update:active-key="emit('update:activeTab', String($event))">
            <a-tab-pane key="employees" tab="员工管理" /><a-tab-pane key="positions" tab="岗位管理" /><a-tab-pane key="departments" tab="部门管理" />
          </a-tabs>
          <div mb-3>
            <a-button v-if="!readOnly" type="primary" @click="emit('create', activeTab === 'departments' ? '部门' : activeTab === 'positions' ? '岗位' : '员工')">
              新增{{ activeTab === 'departments' ? '部门' : activeTab === 'positions' ? '岗位' : '员工' }}
            </a-button>
          </div>
          <a-table row-key="id" :loading="loading" :columns="columns" :data-source="rows" :pagination="pagination" :scroll="{ x: scrollX }">
            <template #bodyCell="{ column, record }">
              <a-tag v-if="column.dataIndex === 'status'" :color="statusColor(record.status)">
                {{ record.status }}
              </a-tag>
              <a-space v-else-if="column.dataIndex === 'action' && !readOnly" wrap>
                <a @click="emit('detail', record)">查看</a><a @click="emit('edit', record)">编辑</a><a-popconfirm title="确定删除该记录？" ok-type="danger" @confirm="emit('delete', record)">
                  <a danger>删除</a>
                </a-popconfirm><a-popconfirm title="启用/停用会影响下级与审批关系，确定继续？" @confirm="emit('toggle', record)">
                  <a>{{ record.status === '停用' || record.status === '离职' ? '启用' : '停用' }}</a>
                </a-popconfirm><a @click="emit('role', record)">分配角色</a><a v-if="record.orgType === '员工'" @click="emit('approver', record)">设置审批人</a><a v-if="record.orgType !== '公司'" @click="emit('adjust', record, 'parentDepartment')">调整部门</a><a v-if="record.orgType === '员工'" @click="emit('adjust', record, 'position')">调整岗位</a>
              </a-space>
              <template v-else>
                {{ record[columnKey(column.dataIndex)] || '-' }}
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped>
.org-tree-card {
  min-height: 520px;
}
.oa-query :deep(.ant-form-item) {
  margin-bottom: 0;
}
</style>

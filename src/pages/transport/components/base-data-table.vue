<script setup lang="ts">
import type { RecordActionItem } from '~@/components/record-actions/index.vue'
import { EditOutlined, FileProtectOutlined } from '@ant-design/icons-vue'
import RecordActions from '~@/components/record-actions/index.vue'

type Row = Record<string, any>
type BaseRow = Record<string, string>
type Column = Record<string, any>
interface Tab { key: string, title: string, columns: Column[], rows: Row[] }

const props = defineProps<{
  activeKey: string
  tabs: Tab[]
  activeRows: Row[]
  pagination: Record<string, any>
  loading: boolean
  beforeUpload: (file: File) => boolean | Promise<boolean>
  getColumns: (columns: Record<string, any>[], key?: string) => Record<string, any>[]
  getScrollX: (columns: Column[], minimum: number) => number
  getStatus: (record: BaseRow) => string
  displayValue: (value?: string) => string
  getVehicleAgeType: (code: string) => string
  getVehicleAgeTypeLabel: (code: string) => string
  normalizeDate: (value?: string) => string
  isVehicleScrapWarning: (code: string) => boolean
  getVehicleScrapDate: (code: string) => string
  getCustomerBalance: (record: BaseRow) => { recordedFreight: number, remainingAmount: number, progress: number } | undefined
  getActions: (record: BaseRow) => RecordActionItem[]
}>()
const emit = defineEmits<{ 'update:activeKey': [value: string], 'export': [], 'create': [] }>()
const importable = computed(() => ['customer', 'vehicle', 'crew', 'route'].includes(props.activeKey))
const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const routeMultilineFields = new Set(['customer', 'name', 'loadingAddress', 'destinationName', 'destinationArea', 'unloadingAddress', 'loadingFenceName', 'transitFenceName', 'unloadingFenceName', 'returnFenceName'])
const routeCompactFields = new Set(['code', 'distance', 'freightPrice', 'newGasVehiclePlannedFuelConsumption', 'oldGasVehiclePlannedFuelConsumption', 'newDieselVehiclePlannedFuelConsumption', 'oldDieselVehiclePlannedFuelConsumption', 'roundTripNewGasVehiclePlannedFuelConsumption', 'roundTripOldGasVehiclePlannedFuelConsumption', 'roundTripNewDieselVehiclePlannedFuelConsumption', 'roundTripOldDieselVehiclePlannedFuelConsumption', 'extraFee', 'loadingFenceRadius', 'unloadingFenceRadius', 'routeValidityType', 'routeValidityRange', 'updatedAt'])
const companyRecord = computed<Row | undefined>(() => props.activeRows[0] || props.tabs.find(tab => tab.key === 'company')?.rows[0])
const companyFields = [
  { label: '公司编号', key: 'code' },
  { label: '公司名称', key: 'name' },
  { label: '统一社会信用代码', key: 'taxNo' },
  { label: '道路运输许可证号', key: 'licenseNo' },
  { label: '法定代表人', key: 'legalRepresentative' },
  { label: '联系方式', key: 'contactPhone' },
  { label: '最后更新', key: 'updatedAt' },
]

function routeCellValue(record: Row, dataIndex: unknown) {
  const value = Array.isArray(dataIndex)
    ? dataIndex.reduce<any>((target, key) => target?.[key], record)
    : record[String(dataIndex ?? '')]
  return props.displayValue(value == null ? undefined : String(value))
}
</script>

<template>
  <a-card title="基础资料列表" :bordered="false">
    <template #extra>
      <a-space>
        <a-upload v-if="importable" :show-upload-list="false" accept=".xlsx,.xls,.csv" :before-upload="beforeUpload">
          <a-button type="primary">
            导入{{ tabs.find(tab => tab.key === activeKey)?.title }}
          </a-button>
        </a-upload>
        <a-button @click="emit('export')">
          导出表格
        </a-button>
        <a-button type="primary" @click="emit('create')">
          {{ activeKey === 'company' && tabs.find(tab => tab.key === activeKey)?.rows.length ? '维护公司信息' : '新增' }}
        </a-button>
      </a-space>
    </template>
    <a-tabs :active-key="activeKey" @update:active-key="emit('update:activeKey', String($event))">
      <a-tab-pane v-for="tab in tabs" :key="tab.key" :tab="tab.title">
        <section v-if="tab.key === 'company'" class="company-profile" aria-label="公司信息">
          <template v-if="companyRecord">
            <header class="company-profile-header">
              <div class="company-identity">
                <span class="company-mark" aria-hidden="true">企</span>
                <div>
                  <h3>{{ displayValue(companyRecord.name) }}</h3>
                  <p>{{ displayValue(companyRecord.taxNo) }}</p>
                </div>
              </div>
              <div class="company-header-actions">
                <a-tag color="blue">
                  {{ getStatus(companyRecord as BaseRow) }}
                </a-tag>
                <a-button type="primary" @click="emit('create')">
                  <EditOutlined />
                  编辑公司信息
                </a-button>
              </div>
            </header>

            <div class="company-profile-body">
              <dl class="company-details">
                <div v-for="field in companyFields" :key="field.key" class="company-detail-row">
                  <dt>{{ field.label }}</dt>
                  <dd>{{ displayValue(companyRecord[field.key]) }}</dd>
                </div>
              </dl>

              <div class="company-certificates">
                <div class="company-license">
                  <div class="company-license-icon" aria-hidden="true">
                    <FileProtectOutlined />
                  </div>
                  <div class="company-license-content">
                    <span>营业执照</span>
                    <strong>{{ companyRecord.businessLicenseName || '暂未上传' }}</strong>
                    <small>有效期至：{{ displayValue(companyRecord.businessLicenseValidTo) }}</small>
                  </div>
                  <a-button v-if="companyRecord.businessLicenseUrl" :href="companyRecord.businessLicenseUrl" target="_blank" rel="noopener noreferrer">
                    查看文件
                  </a-button>
                  <a-button v-else @click="emit('create')">
                    上传附件
                  </a-button>
                </div>
                <div class="company-license">
                  <div class="company-license-icon" aria-hidden="true">
                    <FileProtectOutlined />
                  </div>
                  <div class="company-license-content">
                    <span>道路运输许可证</span>
                    <strong>{{ companyRecord.roadTransportLicenseName || '暂未上传' }}</strong>
                    <small>有效期至：{{ displayValue(companyRecord.roadTransportLicenseValidTo) }}</small>
                  </div>
                  <a-button v-if="companyRecord.roadTransportLicenseUrl" :href="companyRecord.roadTransportLicenseUrl" target="_blank" rel="noopener noreferrer">
                    查看文件
                  </a-button>
                  <a-button v-else @click="emit('create')">
                    上传附件
                  </a-button>
                </div>
              </div>
            </div>
          </template>
          <a-empty v-else description="尚未维护公司信息">
            <a-button type="primary" @click="emit('create')">
              维护公司信息
            </a-button>
          </a-empty>
        </section>

        <a-table v-else class="base-data-table" :class="{ 'base-data-table--route': tab.key === 'route' }" size="small" :row-key="(record: Row) => String(record.code || '')" :columns="getColumns(tab.columns, tab.key)" :data-source="tab.key === activeKey ? activeRows : tab.rows" :pagination="pagination" :loading="loading" :scroll="{ x: getScrollX(getColumns(tab.columns, tab.key), 1200) }">
          <template #headerCell="{ column }">
            <div v-if="tab.key === 'crew' && column.dataIndex === 'vehicleInfo'" class="vehicle-stack-cell">
              <b>车号</b><small>挂号</small>
            </div>
            <div v-else-if="tab.key === 'crew' && column.dataIndex === 'name'" class="crew-info-stack">
              <b>司押人员</b><div class="crew-info-row">
                <span>类型</span><span>姓名</span><span>电话</span><span>证号</span><span>有效期</span>
              </div>
            </div>
            <template v-else>
              {{ column.title }}
            </template>
          </template>
          <template #bodyCell="{ column, record }">
            <a-tag v-if="column.dataIndex === 'status'" color="blue">
              {{ getStatus(record) }}
            </a-tag>
            <a v-else-if="tab.key === 'company' && column.dataIndex === 'businessLicenseName' && record.businessLicenseUrl" :href="record.businessLicenseUrl" target="_blank" rel="noopener noreferrer">{{ record.businessLicenseName || '查看营业执照' }}</a>
            <div v-else-if="tab.key === 'vehicle' && column.dataIndex === 'code'" class="vehicle-stack-cell">
              <b>{{ displayValue(record.code) }}</b><small>{{ displayValue(record.trailerNo) }}</small>
            </div>
            <div v-else-if="tab.key === 'vehicle' && column.dataIndex === 'driver'" class="vehicle-stack-cell">
              <b>{{ displayValue(record.driver) }}</b><small>{{ displayValue(record.escort) }}</small>
            </div>
            <a-tag v-else-if="tab.key === 'vehicle' && column.dataIndex === 'vehicleAgeType'" :color="getVehicleAgeType(record.code) === 'new' ? 'green' : 'orange'">
              {{ getVehicleAgeTypeLabel(record.code) }}
            </a-tag>
            <template v-else-if="tab.key === 'vehicle' && column.dataIndex === 'purchaseDate'">
              {{ normalizeDate(record.purchaseDate) || '-' }}
            </template>
            <a-tag v-else-if="tab.key === 'vehicle' && column.dataIndex === 'scrapDate'" :color="isVehicleScrapWarning(record.code) ? 'red' : 'blue'">
              {{ getVehicleScrapDate(record.code) || '-' }}
            </a-tag>
            <div v-else-if="tab.key === 'crew' && column.dataIndex === 'vehicleInfo'" class="vehicle-stack-cell">
              <b>{{ displayValue(record.plateNo) }}</b><small>{{ displayValue(record.trailerNo) }}</small>
            </div>
            <div v-else-if="tab.key === 'crew' && column.dataIndex === 'name'" class="crew-info-stack">
              <div class="crew-info-row">
                <span>司机</span><span>{{ displayValue(record.driverName) }}</span><span>{{ displayValue(record.driverPhone) }}</span><span>{{ displayValue(record.driverCertNo) }}</span><span>{{ displayValue(record.driverCertValidTo) }}</span>
              </div>
              <div class="crew-info-row">
                <span>押运</span><span>{{ displayValue(record.escortName) }}</span><span>{{ displayValue(record.escortPhone) }}</span><span>{{ displayValue(record.escortCertNo) }}</span><span>{{ displayValue(record.escortCertValidTo) }}</span>
              </div>
            </div>
            <template v-else-if="tab.key === 'customer' && column.dataIndex === 'bidAmount'">
              {{ record.bidAmount ? money(Number(record.bidAmount)) : '-' }}
            </template>
            <template v-else-if="tab.key === 'customer' && column.dataIndex === 'recordedFreight'">
              {{ getCustomerBalance(record) ? money(getCustomerBalance(record)!.recordedFreight) : '-' }}
            </template>
            <template v-else-if="tab.key === 'customer' && column.dataIndex === 'remainingAmount'">
              {{ getCustomerBalance(record) ? money(getCustomerBalance(record)!.remainingAmount) : '-' }}
            </template>
            <a-progress v-else-if="tab.key === 'customer' && column.dataIndex === 'progress' && getCustomerBalance(record)" :percent="Math.round(getCustomerBalance(record)!.progress)" size="small" />
            <span v-else-if="tab.key === 'customer' && column.dataIndex === 'progress'">-</span>
            <RecordActions v-else-if="column.dataIndex === 'action'" :actions="getActions(record)" />
            <a-tooltip v-else-if="tab.key === 'route' && routeMultilineFields.has(String(column.dataIndex))" :title="routeCellValue(record, column.dataIndex)" placement="topLeft">
              <span class="route-text-cell">{{ routeCellValue(record, column.dataIndex) }}</span>
            </a-tooltip>
            <span v-else-if="tab.key === 'route' && routeCompactFields.has(String(column.dataIndex))" class="route-compact-cell">
              {{ routeCellValue(record, column.dataIndex) }}
            </span>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<style scoped>
.vehicle-stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.vehicle-stack-cell small {
  color: var(--admin-muted);
}
.crew-info-stack {
  display: grid;
  gap: 4px;
  min-width: 620px;
}
.crew-info-row {
  display: grid;
  grid-template-columns: 52px 100px 130px 180px 110px;
  gap: 8px;
  align-items: center;
}
.crew-info-row span:first-child {
  color: var(--admin-muted);
  font-weight: 600;
}
.base-data-table :deep(.ant-table-thead > tr > th),
.base-data-table :deep(.ant-table-tbody > tr > td) {
  padding: 9px 12px;
}
.base-data-table :deep(.ant-table-thead > tr > th) {
  line-height: 20px;
}
.base-data-table :deep(.ant-table-tbody > tr > td) {
  line-height: 19px;
}
.base-data-table :deep(.ant-table-column-sorters) {
  gap: 6px;
}
.base-data-table :deep(.ant-table-pagination.ant-pagination) {
  margin-block: 14px 4px;
}
.base-data-table--route :deep(.ant-table-tbody > tr > td) {
  height: 58px;
  vertical-align: middle;
}
.base-data-table--route :deep(.ant-table-cell-fix-left),
.base-data-table--route :deep(.ant-table-cell-fix-right) {
  background: var(--admin-surface);
}
.base-data-table--route :deep(.ant-table-row:hover > .ant-table-cell-fix-left),
.base-data-table--route :deep(.ant-table-row:hover > .ant-table-cell-fix-right) {
  background: var(--admin-surface-muted);
}
.route-text-cell {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  color: var(--admin-text);
  line-height: 20px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.route-compact-cell {
  color: var(--admin-text);
  white-space: nowrap;
}
:deep(.table-cell-no-ellipsis) {
  white-space: normal;
}
.company-profile {
  max-width: 920px;
  margin: 4px auto 10px;
  overflow: hidden;
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
}
.company-profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px;
  background: var(--admin-surface-muted);
  border-bottom: 1px solid var(--admin-border-subtle);
}
.company-identity,
.company-header-actions,
.company-certificates {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}
.company-license {
  display: flex;
  align-items: center;
}
.company-identity {
  min-width: 0;
  gap: 14px;
}
.company-mark {
  display: grid;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  place-items: center;
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  background: var(--admin-primary);
  border-radius: 8px;
}
.company-identity h3 {
  margin: 0 0 4px;
  overflow-wrap: anywhere;
  color: var(--admin-text);
  font-size: 17px;
  font-weight: 650;
  line-height: 1.4;
}
.company-identity p {
  margin: 0;
  color: var(--admin-text-secondary);
  font-size: 13px;
}
.company-header-actions {
  flex: 0 0 auto;
  gap: 10px;
}
.company-profile-body {
  padding: 8px 24px 24px;
}
.company-details {
  margin: 0;
}
.company-detail-row {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 24px;
  padding: 15px 4px;
  border-bottom: 1px solid var(--admin-border-subtle);
}
.company-detail-row dt {
  color: var(--admin-text-secondary);
  font-weight: 600;
}
.company-detail-row dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--admin-text);
  font-weight: 500;
}
.company-license {
  gap: 14px;
  padding: 16px;
  background: var(--admin-surface-muted);
  border-radius: 8px;
}
.company-license-icon {
  display: grid;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  place-items: center;
  color: var(--admin-primary);
  font-size: 19px;
  background: var(--admin-surface);
  border-radius: 6px;
}
.company-license-content {
  display: grid;
  min-width: 0;
  margin-right: auto;
  gap: 2px;
}
.company-license-content span {
  color: var(--admin-text-secondary);
  font-size: 12px;
}
.company-license-content strong {
  overflow: hidden;
  color: var(--admin-text);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.company-license-content small {
  color: var(--admin-text-secondary);
  font-size: 12px;
}
@media (max-width: 700px) {
  .company-profile-header {
    align-items: flex-start;
    flex-direction: column;
    padding: 18px;
  }
  .company-header-actions {
    justify-content: space-between;
    width: 100%;
  }
  .company-profile-body {
    padding: 6px 18px 18px;
  }
  .company-detail-row {
    grid-template-columns: 1fr;
    gap: 5px;
    padding: 13px 2px;
  }
  .company-license {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .company-certificates {
    grid-template-columns: 1fr;
  }
  .company-license .ant-btn {
    width: 100%;
  }
}
</style>

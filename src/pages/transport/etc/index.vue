<script setup lang="ts">
import type { TablePaginationConfig } from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
import type { TransportEtcCreatePayload, TransportEtcPage, TransportEtcQuery, TransportEtcRecord } from '~@/api/transport/etc'
import type { RecordActionItem } from '~@/components/record-actions/index.vue'
import { DownloadOutlined, FolderOpenOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { createTransportEtcRecordApi, getTransportEtcPageApi, importTransportEtcApi } from '~@/api/transport/etc'
import BusinessDetailDrawer from '~@/components/business-detail-drawer/index.vue'
import RecordActions from '~@/components/record-actions/index.vue'
import SummaryCards from '~@/components/summary-cards/index.vue'
import { createFinancialComparison } from '~@/utils/financial-comparison'
import { getCurrentFinancialMonthRange } from '~@/utils/financialPeriod'
import TransportOperationCreateModal from '../components/transport-operation-create-modal.vue'
import { normalizeEtcRows } from '../import/etc-parser'
import { parseEtcSummaryInvoiceStrict } from '../import/etc-summary-parser'

interface QueryModel {
  keyword?: string
  status?: string
  financialYear?: number
  financialMonth?: number
  dateRange?: [Dayjs, Dayjs]
}

function emptyPage(): TransportEtcPage {
  return {
    records: [],
    total: 0,
    current: 1,
    pageSize: 20,
    summary: { recordCount: 0, totalAmount: 0, pendingCount: 0, vehicleCount: 0 },
    routeRanking: [],
    actualRouteAnalysis: [],
    facets: { years: [], statuses: [] },
  }
}

const message = useMessage()
const currentFinancialPeriod = getCurrentFinancialMonthRange()
const queryModel = reactive<QueryModel>({
  financialYear: Number(currentFinancialPeriod.key.slice(0, 4)),
  financialMonth: Number(currentFinancialPeriod.key.slice(4, 6)),
})
const pageData = reactive<TransportEtcPage>(emptyPage())
const previousSummary = reactive(emptyPage().summary)
const loading = ref(true)
const loadError = ref('')
const current = ref(1)
const pageSize = ref(20)
const detailOpen = ref(false)
const detailRecord = ref<TransportEtcRecord>()
const folderInput = ref<HTMLInputElement>()
const filePickerOpen = ref(false)
const selectedFiles = ref<File[]>([])
const importOpen = ref(false)
const importParsing = ref(false)
const importSaving = ref(false)
const importFileName = ref('')
const importRows = ref<TransportEtcRecord[]>([])
const importErrors = ref<string[]>([])
const manualRecordOpen = ref(false)
const manualRecordSaving = ref(false)
let loadSequence = 0

const columns = [
  { title: '汇总单号', dataIndex: 'summaryNo', width: 210, fixed: 'left' as const },
  { title: '通行日期', dataIndex: 'updatedAt', width: 120, align: 'center' as const },
  { title: '入口信息', dataIndex: 'entryInfo', width: 190 },
  { title: '出口信息', dataIndex: 'exitInfo', width: 190 },
  { title: '车号', dataIndex: 'plateNo', width: 120, align: 'center' as const },
  { title: '状态', dataIndex: 'status', width: 110, align: 'center' as const },
  { title: '费用', dataIndex: 'amount', width: 120, align: 'right' as const },
  { title: '卡号', dataIndex: 'cardNo', width: 150, align: 'center' as const },
  { title: '操作', dataIndex: 'action', width: 120, fixed: 'right' as const },
]

const summaryCards = computed(() => [
  { label: '通行笔数', value: pageData.summary.recordCount, comparison: createFinancialComparison(pageData.summary.recordCount, previousSummary.recordCount, `${previousSummary.recordCount} 笔`), tone: 'primary' as const },
  { label: 'ETC费用', value: formatMoney(pageData.summary.totalAmount), comparison: createFinancialComparison(pageData.summary.totalAmount, previousSummary.totalAmount, formatMoney(previousSummary.totalAmount)), tone: 'success' as const },
  { label: '涉及车辆', value: pageData.summary.vehicleCount, comparison: createFinancialComparison(pageData.summary.vehicleCount, previousSummary.vehicleCount, `${previousSummary.vehicleCount} 辆`), tone: 'default' as const },
  { label: '待处理', value: pageData.summary.pendingCount, comparison: createFinancialComparison(pageData.summary.pendingCount, previousSummary.pendingCount, `${previousSummary.pendingCount} 笔`), tag: pageData.summary.pendingCount ? '需处理' : '正常', tone: pageData.summary.pendingCount ? 'warning' as const : 'success' as const },
])

const yearOptions = computed(() => pageData.facets.years.map(value => ({ label: `${value}年`, value })))
const monthOptions = Array.from({ length: 12 }, (_, index) => ({ label: `${index + 1}月`, value: index + 1 }))
const statusOptions = computed(() => pageData.facets.statuses.map(value => ({ label: value, value })))
const routeRanking = computed(() => pageData.actualRouteAnalysis.slice(0, 8))
const maxRouteAmount = computed(() => Math.max(...routeRanking.value.map(item => item.amount), 1))
const tablePagination = computed(() => ({
  current: current.value,
  pageSize: pageSize.value,
  total: pageData.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total: number) => `共 ${total} 条`,
}))

function formatMoney(value: unknown) {
  const amount = Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function display(value: unknown) {
  const text = String(value ?? '').trim()
  return text || '-'
}

function routeRankingTitle(item: TransportEtcPage['actualRouteAnalysis'][number]) {
  const routeCode = item.routeCode ? `路线编号：${item.routeCode}` : '路线编号：待核对'
  const distance = item.distance ? `里程：${item.distance} km` : '里程：待核对'
  const corridors = item.corridors.map(corridor => corridor.route).join('、') || '无收费站组合'
  return `${item.routeLine}；${routeCode}；${distance}；${item.confidence}；${item.matchBasis}；${item.estimatedJourneyCount} 个估算行程；收费站组合：${corridors}`
}

function statusColor(status: unknown) {
  const text = String(status ?? '')
  if (/驳回|作废/.test(text))
    return 'red'
  if (/审核|确认|完成/.test(text))
    return 'green'
  if (/待|草稿/.test(text))
    return 'orange'
  return 'blue'
}

function buildQuery(): TransportEtcQuery {
  return {
    current: current.value,
    pageSize: pageSize.value,
    keyword: queryModel.keyword?.trim() || undefined,
    status: queryModel.status,
    financialYear: queryModel.financialYear,
    financialMonth: queryModel.financialMonth,
    startDate: queryModel.dateRange?.[0]?.format('YYYY-MM-DD'),
    endDate: queryModel.dateRange?.[1]?.format('YYYY-MM-DD'),
  }
}

async function loadPage() {
  const sequence = ++loadSequence
  loading.value = true
  loadError.value = ''
  try {
    const query = buildQuery()
    const currentMonth = dayjs(`${query.financialYear || currentFinancialPeriod.key.slice(0, 4)}-${String(query.financialMonth || currentFinancialPeriod.key.slice(4, 6)).padStart(2, '0')}-01`)
    const previousMonth = currentMonth.subtract(1, 'month')
    const [response, previousResponse] = await Promise.all([
      getTransportEtcPageApi(query),
      getTransportEtcPageApi({
        current: 1,
        pageSize: 1,
        keyword: query.keyword,
        status: query.status,
        financialYear: previousMonth.year(),
        financialMonth: previousMonth.month() + 1,
        includeAnalysis: false,
      }),
    ])
    if (sequence !== loadSequence)
      return
    if (!response.data)
      throw new Error(response.msg || 'ETC数据返回为空')
    Object.assign(pageData, response.data)
    Object.assign(previousSummary, previousResponse.data?.summary ?? emptyPage().summary)
    current.value = response.data.current
    pageSize.value = response.data.pageSize
  }
  catch (error: any) {
    if (sequence === loadSequence)
      loadError.value = error?.message || 'ETC费用读取失败'
  }
  finally {
    if (sequence === loadSequence)
      loading.value = false
  }
}

function handleQuery() {
  current.value = 1
  void loadPage()
}

function resetQuery() {
  Object.assign(queryModel, {
    keyword: undefined,
    status: undefined,
    financialYear: Number(currentFinancialPeriod.key.slice(0, 4)),
    financialMonth: Number(currentFinancialPeriod.key.slice(4, 6)),
    dateRange: undefined,
  })
  current.value = 1
  void loadPage()
}

function handleTableChange(pagination: TablePaginationConfig) {
  current.value = pagination.current || 1
  pageSize.value = pagination.pageSize || 20
  void loadPage()
}

function openDetail(record: TransportEtcRecord) {
  detailRecord.value = record
  detailOpen.value = true
}

async function writeWorkbook(fileName: string, rows: Array<Record<string, unknown>>) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'ETC费用')
  XLSX.writeFile(workbook, fileName)
}

async function exportCurrentPage() {
  if (!pageData.records.length)
    return message.warning('当前页没有可导出的记录')
  await writeWorkbook(`ETC费用_当前页_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`, pageData.records.map(row => ({ ...row, storageId: undefined })))
}

function rowActions(record: Record<string, any>): RecordActionItem[] {
  const etcRecord = record as TransportEtcRecord
  return [
    { key: 'view', label: '查看', onClick: () => openDetail(etcRecord) },
    { key: 'download', label: '下载', onClick: () => writeWorkbook(`${etcRecord.code || 'ETC'}_记录.xlsx`, [{ ...etcRecord, storageId: undefined }]) },
    { key: 'reupload', label: '重新上传', onClick: openFilePicker },
  ]
}

function recordValue(record: Record<string, any>, dataIndex: unknown) {
  if (Array.isArray(dataIndex))
    return dataIndex.reduce((value, key) => value?.[key], record)
  return record[String(dataIndex ?? '')]
}

function openFilePicker() {
  selectedFiles.value = []
  filePickerOpen.value = true
}

function openFolderPicker() {
  if (!folderInput.value)
    return
  folderInput.value.value = ''
  folderInput.value.click()
}

function fileQueueKey(file: File) {
  return `${file.webkitRelativePath || file.name}_${file.size}_${file.lastModified}`
}

function addSelectedFiles(file: File, fileList?: File[]) {
  const incoming = (fileList?.length ? fileList : [file]).filter(item => /\.(?:pdf|xlsx?|csv)$/i.test(item.name))
  const existingKeys = new Set(selectedFiles.value.map(fileQueueKey))
  incoming.forEach((item) => {
    const key = fileQueueKey(item)
    if (!existingKeys.has(key)) {
      selectedFiles.value.push(item)
      existingKeys.add(key)
    }
  })
  return false
}

function addSelectedFolder(event: Event) {
  const input = event.target as HTMLInputElement
  const supportedFiles = Array.from(input.files ?? []).filter(file => /\.(?:pdf|xlsx?|csv)$/i.test(file.name))
  if (!supportedFiles.length)
    message.warning('所选文件夹中没有可导入的 PDF、Excel 或 CSV 文件')
  else
    addSelectedFiles(supportedFiles[0], supportedFiles)
  input.value = ''
}

function removeSelectedFile(file: File) {
  selectedFiles.value = selectedFiles.value.filter(item => fileQueueKey(item) !== fileQueueKey(file))
}

async function fileHash(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

async function parseImportFile(file: File) {
  const sourceFileHash = await fileHash(file)
  const worker = await import('~@/workers/transport-import-client')
  const rows = /\.pdf$/i.test(file.name)
    ? parseEtcSummaryInvoiceStrict(await worker.extractTransportPdfText(file))
    : normalizeEtcRows((await worker.parseTransportWorkbook(file)).flatMap(sheet => sheet.rows))
  if (!rows.length)
    throw new Error('未识别到有效ETC明细')
  const summaryNo = rows[0]?.summaryNo
  if (!summaryNo)
    throw new Error('未识别到汇总单号')
  return rows.map((row, index) => ({
    ...row,
    sourceFileHash,
    sourceFileName: file.name,
    sourceFileRow: String(index + 1),
  }))
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = []
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

async function handleFiles(files: File[]) {
  if (!files.length)
    return message.warning('没有找到可导入的 PDF、Excel 或 CSV 文件')
  importOpen.value = true
  importParsing.value = true
  importRows.value = []
  importErrors.value = []
  importFileName.value = files.length === 1 ? files[0].name : `${files.length}个文件`
  const parsed = await mapWithConcurrency(files, 4, async (file) => {
    try {
      return { file, rows: await parseImportFile(file), error: '' }
    }
    catch (error: any) {
      return { file, rows: [] as TransportEtcRecord[], error: error?.message || '解析失败' }
    }
  })
  const summaryNos = new Set<string>()
  for (const result of parsed) {
    try {
      const rows = result.rows
      if (result.error)
        throw new Error(result.error)
      const summaryNo = String(rows[0]?.summaryNo || '')
      if (summaryNos.has(summaryNo))
        throw new Error(`汇总单号 ${summaryNo} 在本批次重复`)
      summaryNos.add(summaryNo)
      importRows.value.push(...rows)
    }
    catch (error: any) {
      importErrors.value.push(`${result.file.name}：${error?.message || '解析失败'}`)
    }
  }
  importParsing.value = false
}

function parseSelectedFiles() {
  const files = [...selectedFiles.value]
  if (!files.length)
    return message.warning('请先选择文件')
  filePickerOpen.value = false
  void handleFiles(files)
}

async function confirmImport() {
  if (importSaving.value)
    return
  if (!importRows.value.length)
    return
  importSaving.value = true
  try {
    const response = await importTransportEtcApi(importRows.value)
    importOpen.value = false
    message.success(`成功导入${response.data?.importedCount || importRows.value.length}条ETC记录`)
    current.value = 1
    await loadPage()
  }
  catch (error: any) {
    message.error(error?.message || 'ETC导入失败')
  }
  finally {
    importSaving.value = false
  }
}

async function saveManualRecord(payload: Record<string, string | number>) {
  if (manualRecordSaving.value)
    return
  manualRecordSaving.value = true
  try {
    await createTransportEtcRecordApi(payload as unknown as TransportEtcCreatePayload)
    manualRecordOpen.value = false
    message.success('ETC费用新增成功')
    current.value = 1
    await loadPage()
  }
  catch (error: any) {
    message.error(error?.message || 'ETC费用新增失败')
  }
  finally {
    manualRecordSaving.value = false
  }
}

onMounted(loadPage)
</script>

<template>
  <page-container>
    <section class="etc-summary-band">
      <SummaryCards :cards="summaryCards" :loading="loading" compact />
    </section>

    <a-card class="etc-query-card" :bordered="false">
      <a-form :model="queryModel" @finish="handleQuery">
        <a-row :gutter="[10, 8]" align="middle">
          <a-col :xs="24" :md="8" :xl="5">
            <a-form-item label="关键字">
              <a-input v-model:value="queryModel.keyword" allow-clear placeholder="汇总单号、车号、卡号或路线" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="3">
            <a-form-item label="状态">
              <a-select v-model:value="queryModel.status" allow-clear :options="statusOptions" placeholder="全部状态" />
            </a-form-item>
          </a-col>
          <a-col :xs="12" :md="4" :xl="3">
            <a-form-item label="财务年">
              <a-select v-model:value="queryModel.financialYear" allow-clear :options="yearOptions" placeholder="全部" />
            </a-form-item>
          </a-col>
          <a-col :xs="12" :md="4" :xl="3">
            <a-form-item label="财务月">
              <a-select v-model:value="queryModel.financialMonth" allow-clear :options="monthOptions" placeholder="全部" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="10" :xl="5">
            <a-form-item label="通行日期">
              <a-range-picker v-model:value="queryModel.dateRange" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="8" :xl="5">
            <a-form-item class="query-actions">
              <a-space>
                <a-button type="primary" html-type="submit">
                  查询
                </a-button>
                <a-button @click="resetQuery">
                  重置
                </a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <a-alert v-if="loadError" class="etc-error" type="error" show-icon :message="loadError">
      <template #action>
        <a-button size="small" @click="loadPage">
          <template #icon>
            <ReloadOutlined />
          </template>
          重试
        </a-button>
      </template>
    </a-alert>

    <section class="etc-ranking" aria-label="ETC实际路线费用排行">
      <header><strong>ETC路线费用排行</strong><span>基础路线归并 · 当前筛选范围前8项</span></header>
      <a-skeleton v-if="loading" active :paragraph="{ rows: 2 }" />
      <a-empty v-else-if="!routeRanking.length" :image="null" description="当前筛选范围暂无可分析路线" />
      <div v-else class="ranking-grid">
        <div v-for="item in routeRanking" :key="item.routeCode || item.routeLine" class="ranking-row">
          <span :title="routeRankingTitle(item)">{{ item.routeLine }}</span>
          <i><b :style="{ width: `${item.amount / maxRouteAmount * 100}%` }" /></i>
          <strong>{{ formatMoney(item.amount) }}</strong>
          <small>{{ item.recordCount }}笔</small>
        </div>
      </div>
    </section>

    <a-card title="ETC费用列表" :bordered="false">
      <template #extra>
        <a-space wrap>
          <a-button type="primary" @click="openFilePicker">
            <template #icon>
              <UploadOutlined />
            </template>
            导入ETC明细
          </a-button>
          <a-button type="primary" @click="manualRecordOpen = true">
            <template #icon>
              <PlusOutlined />
            </template>
            新增
          </a-button>
          <a-button :disabled="!pageData.records.length" @click="exportCurrentPage">
            <template #icon>
              <DownloadOutlined />
            </template>
            导出当前页
          </a-button>
        </a-space>
      </template>
      <a-table
        row-key="storageId"
        :columns="columns"
        :data-source="pageData.records"
        :loading="loading"
        :pagination="tablePagination"
        :scroll="{ x: 1340 }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <a-tag v-if="column.dataIndex === 'status'" :color="statusColor(record.status)">
            {{ display(record.status) }}
          </a-tag>
          <strong v-else-if="column.dataIndex === 'amount'" class="money-cell">{{ formatMoney(record.amount) }}</strong>
          <RecordActions v-else-if="column.dataIndex === 'action'" :actions="rowActions(record)" />
          <a-tooltip v-else :title="display(recordValue(record, column.dataIndex))">
            <span class="cell-ellipsis">{{ display(recordValue(record, column.dataIndex)) }}</span>
          </a-tooltip>
        </template>
      </a-table>
    </a-card>

    <BusinessDetailDrawer
      v-if="detailOpen"
      v-model:open="detailOpen"
      title="ETC费用明细"
      :subtitle="String(detailRecord?.summaryNo || detailRecord?.code || '')"
      :status="String(detailRecord?.status || '')"
      :status-color="statusColor(detailRecord?.status)"
    >
      <a-descriptions bordered :column="1" size="small">
        <a-descriptions-item v-for="(value, key) in detailRecord" :key="key" :label="String(key)">
          {{ display(value) }}
        </a-descriptions-item>
      </a-descriptions>
    </BusinessDetailDrawer>

    <a-modal
      v-model:open="filePickerOpen"
      title="选择ETC费用发票明细文件"
      width="720px"
      ok-text="解析所选文件"
      :ok-button-props="{ disabled: !selectedFiles.length }"
      @ok="parseSelectedFiles"
    >
      <a-upload-dragger
        multiple
        :show-upload-list="false"
        accept=".pdf,.xlsx,.xls,.csv"
        :before-upload="addSelectedFiles"
      >
        <p class="ant-upload-text">
          点击或拖入单个、多个文件
        </p>
        <p class="ant-upload-hint">
          可重复添加 PDF、Excel、CSV，文件将合并解析
        </p>
      </a-upload-dragger>
      <div class="folder-picker">
        <a-button @click="openFolderPicker">
          <template #icon>
            <FolderOpenOutlined />
          </template>
          选择文件夹
        </a-button>
        <span>将导入文件夹及其子文件夹中的 PDF、Excel、CSV 文件</span>
        <input
          ref="folderInput"
          type="file"
          accept=".pdf,.xlsx,.xls,.csv"
          multiple
          webkitdirectory
          class="file-input"
          @change="addSelectedFolder"
        >
      </div>
      <a-list class="selected-file-list" bordered :data-source="selectedFiles">
        <template #renderItem="{ item }">
          <a-list-item>
            <template #actions>
              <a-button type="link" danger @click="removeSelectedFile(item)">
                删除
              </a-button>
            </template>
            <a-list-item-meta :title="item.webkitRelativePath || item.name" :description="`${(item.size / 1024).toFixed(1)} KB`" />
          </a-list-item>
        </template>
      </a-list>
    </a-modal>

    <a-modal v-model:open="importOpen" title="ETC费用导入确认" width="960px" :confirm-loading="importSaving" :mask-closable="!importSaving" :closable="!importSaving" :keyboard="!importSaving" :cancel-button-props="{ disabled: importSaving }" :ok-button-props="{ disabled: importParsing || !importRows.length }" @ok="confirmImport">
      <a-descriptions bordered size="small" :column="3">
        <a-descriptions-item label="文件">
          {{ importFileName }}
        </a-descriptions-item>
        <a-descriptions-item label="有效记录">
          {{ importRows.length }}
        </a-descriptions-item>
        <a-descriptions-item label="解析错误">
          {{ importErrors.length }}
        </a-descriptions-item>
      </a-descriptions>
      <a-skeleton v-if="importParsing" class="import-loading" active :paragraph="{ rows: 5 }" />
      <template v-else>
        <a-alert v-if="importErrors.length" class="import-errors" type="error" show-icon message="部分文件未通过校验" :description="importErrors.slice(0, 5).join('；')" />
        <a-table size="small" row-key="code" :columns="columns.slice(0, -1)" :data-source="importRows" :pagination="{ defaultPageSize: 10, showSizeChanger: true }" :scroll="{ x: 1200 }" />
      </template>
    </a-modal>

    <TransportOperationCreateModal
      v-if="manualRecordOpen"
      v-model:open="manualRecordOpen"
      kind="etc"
      :saving="manualRecordSaving"
      @submit="saveManualRecord"
    />
  </page-container>
</template>

<style scoped>
.etc-summary-band,
.etc-query-card,
.etc-error,
.etc-ranking {
  margin-bottom: 12px;
}
.etc-query-card :deep(.ant-form-item) {
  margin-bottom: 0;
}
.query-actions {
  display: flex;
  align-items: center;
}
.etc-ranking {
  min-height: 116px;
  padding: 15px 18px;
  border: 1px solid var(--admin-border-subtle);
  border-radius: var(--admin-radius);
  background: var(--admin-surface);
}
.etc-ranking header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  color: var(--admin-text);
  font-size: 13px;
}
.etc-ranking header span,
.ranking-row small {
  color: var(--admin-muted);
  font-size: 12px;
}
.ranking-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(300px, 1fr));
  gap: 8px 24px;
}
.ranking-row {
  display: grid;
  grid-template-columns: 150px minmax(80px, 1fr) 110px 52px;
  gap: 8px;
  align-items: center;
  min-height: 26px;
  font-size: 12px;
}
.ranking-row > span {
  overflow: hidden;
  color: var(--admin-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ranking-row i {
  height: 7px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--admin-surface-muted);
}
.ranking-row b {
  display: block;
  height: 100%;
  background: var(--admin-primary);
}
.ranking-row strong {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.file-input {
  display: none;
}
.folder-picker {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 12px;
  color: var(--admin-text-secondary);
}
.selected-file-list {
  margin-top: 16px;
}
.cell-ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.money-cell {
  color: var(--admin-text);
  font-variant-numeric: tabular-nums;
}
.import-loading,
.import-errors {
  margin-top: 16px;
}
@media (max-width: 900px) {
  .ranking-grid {
    grid-template-columns: 1fr;
  }
  .ranking-row {
    grid-template-columns: 110px minmax(70px, 1fr) 96px 42px;
  }
}
</style>

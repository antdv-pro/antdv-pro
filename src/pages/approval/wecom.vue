<script setup lang="ts">
import { CheckCircleOutlined, CloudSyncOutlined, LinkOutlined, PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue'
import {
  deleteWecomApprovalMappingApi,
  getApprovalInstancesApi,
  getWecomApprovalOverviewApi,
  saveWecomApprovalConfigApi,
  saveWecomApprovalMappingApi,
  syncWecomApprovalApi,
  syncWecomApprovalRangeApi,
  testWecomApprovalConnectionApi,
} from '~@/api/approval'
import { APPROVAL_BUSINESS_CATALOG, requiredWecomDirection } from '../../../shared/approval-business-catalog'

defineOptions({ name: 'WecomApprovalIntegration' })

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const batchSyncing = ref(false)
const mappingSaving = ref(false)
const syncSaving = ref(false)
const mappingOpen = ref(false)
const syncOpen = ref(false)
const mappings = ref<any[]>([])
const records = ref<any[]>([])
const approvalInstances = ref<any[]>([])
const syncState = ref<any>({})
const syncForm = reactive({ spNo: '', localInstanceId: undefined as string | undefined })
const config = reactive({ corpId: '', corpSecret: '', callbackToken: '', callbackAesKey: '', enabled: false, initiatorUserId: '', approverUserId: '' })
const mapping = reactive({ id: '', businessType: '', businessLabel: '', templateId: '', templateName: '', direction: 'CENTER_TO_WECOM', enabled: true, titleControlId: '', amountControlId: '', expenseTypeControlId: '', reasonControlId: '', dateControlId: '', remarkControlId: '' })
const businessTypeOptions = APPROVAL_BUSINESS_CATALOG.map(item => ({ label: item.label, value: item.businessType, category: item.category }))

const callbackUrl = computed(() => `${window.location.origin}/api/approval/wecom/callback`)
const connected = computed(() => Boolean(config.corpId && config.corpSecret))
const mappingColumns = [
  { title: '审批中心业务', dataIndex: 'businessLabel', width: 180 },
  { title: '企业微信模板', dataIndex: 'templateName', width: 210 },
  { title: '模板 ID', dataIndex: 'templateId', width: 230 },
  { title: '同步方向', dataIndex: 'direction', width: 150 },
  { title: '状态', dataIndex: 'enabled', width: 90 },
  { title: '操作', dataIndex: 'action', width: 120, fixed: 'right' as const },
]
const recordColumns = [
  { title: '企业微信审批单号', dataIndex: 'spNo', width: 210 },
  { title: '审批名称', dataIndex: 'title', width: 220 },
  { title: '申请人', dataIndex: 'applicantName', width: 130 },
  { title: '来源', dataIndex: 'source', width: 120 },
  { title: '状态', dataIndex: 'status', width: 120 },
  { title: '最后同步', dataIndex: 'lastSyncedAt', width: 190 },
  { title: '结果', dataIndex: 'message', width: 220 },
]
const statusColor: Record<string, string> = { PENDING: 'warning', APPROVING: 'processing', APPROVED: 'success', REJECTED: 'error', REVOKED: 'default', CANCELED: 'default', UNKNOWN: 'default' }
const directionText: Record<string, string> = { BIDIRECTIONAL: '历史双向配置（已按业务规则停用）', WECOM_TO_CENTER: '企业微信 → 审批中心', CENTER_TO_WECOM: '审批中心 → 企业微信' }

async function loadData() {
  loading.value = true
  try {
    const [res, instances] = await Promise.all([getWecomApprovalOverviewApi(), getApprovalInstancesApi()])
    Object.assign(config, res.data?.config || {})
    mappings.value = res.data?.mappings || []
    records.value = res.data?.records || []
    syncState.value = res.data?.sync || {}
    approvalInstances.value = instances.data || []
  }
  catch (error: any) {
    message.error(error?.message || '加载企业微信配置失败')
  }
  finally {
    loading.value = false
  }
}

async function saveConfig() {
  if (!config.corpId)
    return message.warning('请填写企业 ID')
  saving.value = true
  try {
    await saveWecomApprovalConfigApi(config)
    message.success('企业微信配置已保存')
    await loadData()
  }
  finally {
    saving.value = false
  }
}

async function testConnection() {
  testing.value = true
  try {
    const result = await testWecomApprovalConnectionApi()
    if (result?.code !== 200 || result.data !== true)
      throw new Error(result?.msg || '连接失败')
    message.success('连接成功，企业 ID 与 Secret 有效')
  }
  catch (error: any) {
    const responseMessage = error?.response?.data?.msg
    const errorMessage = typeof responseMessage === 'string'
      ? responseMessage
      : typeof error?.message === 'string'
        ? error.message
        : '连接失败，请稍后重试'
    message.error(errorMessage)
  }
  finally {
    testing.value = false
  }
}

function openMapping(record?: any) {
  Object.assign(mapping, { id: '', businessType: '', businessLabel: '', templateId: '', templateName: '', direction: 'CENTER_TO_WECOM', enabled: true, titleControlId: '', amountControlId: '', expenseTypeControlId: '', reasonControlId: '', dateControlId: '', remarkControlId: '' }, record || {})
  mappingOpen.value = true
}

function handleBusinessTypeChange(businessType: unknown) {
  if (typeof businessType === 'string')
    mapping.direction = requiredWecomDirection(businessType)
}

async function submitMapping() {
  if (!mapping.businessType || !mapping.templateId)
    return message.warning('请填写业务类型和企业微信模板 ID')
  if (mappingSaving.value)
    return
  mappingSaving.value = true
  try {
    await saveWecomApprovalMappingApi(mapping)
    mappingOpen.value = false
    message.success('模板映射已保存')
    await loadData()
  }
  catch (error: any) {
    message.error(error?.message || '模板映射保存失败')
  }
  finally {
    mappingSaving.value = false
  }
}

async function removeMapping(id: string) {
  await deleteWecomApprovalMappingApi(id)
  message.success('映射已删除')
  await loadData()
}

async function syncApproval() {
  if (!syncForm.spNo.trim())
    return message.warning('请输入企业微信审批单号')
  if (syncSaving.value)
    return
  syncSaving.value = true
  try {
    const result = await syncWecomApprovalApi(syncForm.spNo, syncForm.localInstanceId)
    if (result.code !== 200)
      throw new Error(result.msg || '同步失败')
    syncOpen.value = false
    syncForm.spNo = ''
    syncForm.localInstanceId = undefined
    message.success('审批状态已同步')
    await loadData()
  }
  catch (error: any) {
    message.error(error?.message || '同步失败')
  }
  finally {
    syncSaving.value = false
  }
}

async function syncRange(days?: number) {
  batchSyncing.value = true
  try {
    const res = await syncWecomApprovalRangeApi(days ? { days } : { incremental: true })
    const stats: any = res.data || {}
    message.success(`同步完成：新增 ${stats.created || 0}，更新 ${stats.updated || 0}，失败 ${stats.failed || 0}`)
    await loadData()
  }
  catch (error: any) {
    message.error(error?.message || '批量同步失败')
  }
  finally {
    batchSyncing.value = false
  }
}

function formatSyncTime(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '尚未成功同步'
}

async function copyCallbackUrl() {
  await window.navigator.clipboard.writeText(callbackUrl.value)
  message.success('回调地址已复制')
}

onMounted(loadData)
</script>

<template>
  <page-container title="企业微信审批互通" sub-title="OA办公审批 / 企业微信互通" description="审批单统一在企业微信填写和发起，管理系统同步展示审批进度、结果并回写业务模块。">
    <a-alert mb-4 show-icon type="info" message="统一申请入口" description="所有审批均在企业微信发起。管理系统不填写审批单，仅同步审批进度、审批结果和对应业务数据。" />
    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="8">
        <a-card size="small" :bordered="false" class="status-panel">
          <a-space align="start">
            <div class="status-icon" :class="{ active: connected }">
              <CheckCircleOutlined v-if="connected" />
              <LinkOutlined v-else />
            </div>
            <div>
              <div font-600>
                {{ connected ? '已填写连接配置' : '等待连接配置' }}
              </div>
              <div mt-1 text-13px c="var(--text-color-secondary)">
                连接测试通过后即可读取企业微信审批数据
              </div>
            </div>
          </a-space>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="8">
        <a-card size="small" :bordered="false" class="status-panel">
          <a-space align="start">
            <div class="status-icon">
              <SafetyCertificateOutlined />
            </div><div>
              <div font-600>
                {{ mappings.length }} 项模板映射
              </div><div mt-1 text-13px c="var(--text-color-secondary)">
                控制业务类型与企业微信模板的对应关系
              </div>
            </div>
          </a-space>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="8">
        <a-card size="small" :bordered="false" class="status-panel">
          <a-space align="start">
            <div class="status-icon">
              <CloudSyncOutlined />
            </div><div>
              <div font-600>
                {{ records.length }} 条同步记录
              </div><div mt-1 text-13px c="var(--text-color-secondary)">
                回调实时同步，必要时可按单号补拉
              </div>
            </div>
          </a-space>
        </a-card>
      </a-col>
    </a-row>

    <a-card mt-4 :bordered="false" title="连接配置">
      <template #extra>
        <a-space>
          <a-button :loading="testing" @click="testConnection">
            测试连接
          </a-button><a-button type="primary" :loading="saving" @click="saveConfig">
            保存配置
          </a-button>
        </a-space>
      </template>
      <a-alert type="info" show-icon message="Secret 和回调密钥仅保存在服务端，页面重新打开后只显示脱敏值。" mb-4 />
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :xs="24" :md="12">
            <a-form-item label="企业 ID（CorpID）" required>
              <a-input v-model:value="config.corpId" placeholder="wwxxxxxxxxxxxxxxxx" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="审批应用 Secret" required>
              <a-input-password v-model:value="config.corpSecret" placeholder="填写审批应用 Secret" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="默认发起人 UserID">
              <a-input v-model:value="config.initiatorUserId" placeholder="审批中心推送到企业微信时使用" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="默认审批人 UserID">
              <a-input v-model:value="config.approverUserId" placeholder="留空时使用默认发起人" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="回调 Token">
              <a-input-password v-model:value="config.callbackToken" placeholder="企业微信回调配置中的 Token" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="回调 EncodingAESKey">
              <a-input-password v-model:value="config.callbackAesKey" placeholder="43 位 EncodingAESKey" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="回调地址">
              <a-input :value="callbackUrl" readonly>
                <template #addonAfter>
                  <a @click="copyCallbackUrl">复制</a>
                </template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="启用同步">
              <a-switch v-model:checked="config.enabled" checked-children="启用" un-checked-children="停用" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <a-card mt-4 :bordered="false" title="模板映射">
      <template #extra>
        <a-button type="primary" @click="openMapping()">
          <template #icon>
            <PlusOutlined />
          </template>新增映射
        </a-button>
      </template>
      <a-table row-key="id" :loading="loading" :columns="mappingColumns" :data-source="mappings" :scroll="{ x: 1000 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'direction'">
            {{ directionText[record.direction] }}
          </template>
          <template v-else-if="column.dataIndex === 'enabled'">
            <a-tag :color="record.enabled ? 'success' : 'default'">
              {{ record.enabled ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'businessLabel'">
            <a-space>
              {{ record.businessLabel }}<a-tag v-if="record.autoGenerated">
                自动分类
              </a-tag>
            </a-space>
          </template>
          <template v-else-if="column.dataIndex === 'action'">
            <span v-if="record.autoGenerated" c="var(--text-color-secondary)">只读</span><a-space v-else>
              <a @click="openMapping(record)">编辑</a><a-popconfirm title="确定删除该映射？" @confirm="removeMapping(record.id)">
                <a danger>删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card mt-4 :bordered="false" title="同步记录">
      <template #extra>
        <a-space wrap>
          <a-button :loading="batchSyncing" @click="syncRange()">
            <template #icon>
              <CloudSyncOutlined />
            </template>立即增量同步
          </a-button>
          <a-popconfirm title="将分段补拉最近90天审批，确定继续？" @confirm="syncRange(90)">
            <a-button :loading="batchSyncing">
              补拉最近90天
            </a-button>
          </a-popconfirm>
          <a-button @click="syncOpen = true">
            按单号同步
          </a-button>
        </a-space>
      </template>
      <a-descriptions mb-4 size="small" :column="{ xs: 1, sm: 2, lg: 4 }" bordered>
        <a-descriptions-item label="最近成功">
          {{ formatSyncTime(syncState.lastSuccessAt) }}
        </a-descriptions-item>
        <a-descriptions-item label="游标">
          {{ syncState.cursor || '空闲' }}
        </a-descriptions-item>
        <a-descriptions-item label="最近统计">
          扫描 {{ syncState.lastStats?.scanned || 0 }} / 新增 {{ syncState.lastStats?.created || 0 }} / 更新 {{ syncState.lastStats?.updated || 0 }}
        </a-descriptions-item>
        <a-descriptions-item label="最近错误">
          <a-typography-text :type="syncState.lastError ? 'danger' : undefined">
            {{ syncState.lastError || '无' }}
          </a-typography-text>
        </a-descriptions-item>
      </a-descriptions>
      <a-table row-key="id" :loading="loading" :columns="recordColumns" :data-source="records" :scroll="{ x: 1200 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <a-tag :color="statusColor[record.status]">
              {{ record.status }}
            </a-tag>
          </template><template v-else-if="column.dataIndex === 'source'">
            {{ record.source === 'WECOM' ? '企业微信' : '审批中心' }}
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="mappingOpen" title="模板映射" ok-text="保存" :confirm-loading="mappingSaving" :mask-closable="false" :closable="!mappingSaving" :keyboard="!mappingSaving" :cancel-button-props="{ disabled: mappingSaving }" @ok="submitMapping">
      <a-form layout="vertical">
        <a-form-item label="审批中心业务类型" required>
          <a-select v-model:value="mapping.businessType" show-search option-filter-prop="label" placeholder="选择对应业务" @change="handleBusinessTypeChange">
            <a-select-option v-for="item in businessTypeOptions" :key="item.value" :value="item.value" :label="item.label">
              {{ item.label }} · {{ item.category }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="企业微信模板 ID" required>
          <a-input v-model:value="mapping.templateId" placeholder="模板详情页中的 template_id" />
        </a-form-item>
        <a-form-item label="企业微信模板名称">
          <a-input v-model:value="mapping.templateName" placeholder="例如 费用报销" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="标题控件 ID">
              <a-input v-model:value="mapping.titleControlId" placeholder="模板 Text 控件 ID" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="金额控件 ID">
              <a-input v-model:value="mapping.amountControlId" placeholder="模板 Money 控件 ID" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="费用类型控件 ID">
              <a-input v-model:value="mapping.expenseTypeControlId" placeholder="模板 Selector 控件 ID" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="申请事由控件 ID">
              <a-input v-model:value="mapping.reasonControlId" placeholder="模板 Textarea 控件 ID" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="发生日期控件 ID">
              <a-input v-model:value="mapping.dateControlId" placeholder="模板 Date 控件 ID" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="备注控件 ID">
              <a-input v-model:value="mapping.remarkControlId" placeholder="模板 Textarea 控件 ID" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="同步方向">
          <a-input :value="directionText[mapping.direction]" disabled />
        </a-form-item>
        <a-form-item label="启用">
          <a-switch v-model:checked="mapping.enabled" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-modal v-model:open="syncOpen" title="按审批单号同步" ok-text="立即同步" :confirm-loading="syncSaving" :mask-closable="false" :closable="!syncSaving" :keyboard="!syncSaving" :cancel-button-props="{ disabled: syncSaving }" @ok="syncApproval">
      <a-form layout="vertical">
        <a-form-item label="企业微信审批单号" required>
          <a-input v-model:value="syncForm.spNo" placeholder="例如 202607130001" />
        </a-form-item>
        <a-form-item label="关联审批中心单据">
          <a-select v-model:value="syncForm.localInstanceId" allow-clear show-search option-filter-prop="label" placeholder="选择后会同步回写审批及业务模块">
            <a-select-option v-for="item in approvalInstances" :key="item.id" :value="item.id" :label="`${item.code} ${item.title}`">
              {{ item.code }} · {{ item.title }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </page-container>
</template>

<style scoped lang="less">
.status-panel {
  height: 100%;
  background: var(--color-bg-container);
  border: 1px solid var(--color-border-secondary);
}

.status-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: #475569;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 18px;
}

.status-icon.active {
  color: #1677ff;
  background: #e6f4ff;
}
</style>

<script setup lang="ts">
import type {
  OfficeVehicle,
  OfficeVehicleBatchSavePayload,
  OfficeVehicleExpense,
  OfficeVehicleInsurance,
  OfficeVehicleLicense,
} from '~@/api/office-vehicle'
import { DeleteOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { saveOfficeVehicleBatchApi } from '~@/api/office-vehicle'
import { useBusinessDictionaries } from '~@/composables/business-dictionaries'

const props = defineProps<{
  open: boolean
  initialVehicle?: OfficeVehicle
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const message = useMessage()
const businessDictionaries = useBusinessDictionaries()
const saving = ref(false)
const form = ref(createForm())

const expenseTypeOptions = computed(() => businessDictionaries.options('office_vehicle_expense_type'))
const licenseTypeOptions = computed(() => businessDictionaries.options('office_vehicle_license_type'))
const paymentMethodOptions = computed(() => businessDictionaries.options('office_vehicle_payment_method'))
const vehicleStatuses = ['正常', '停用', '维修中', '已出售']
const attachmentAccept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv'

watch(() => props.open, async (open) => {
  if (!open)
    return
  await businessDictionaries.load()
  form.value = createForm(props.initialVehicle)
})

function createForm(vehicle?: OfficeVehicle): OfficeVehicleBatchSavePayload {
  return {
    vehicle: vehicle
      ? { ...vehicle }
      : { vehicleType: '轿车', status: '正常', departmentName: '', ownerName: '' },
    expenses: [],
    licenses: [],
    insurances: [],
  }
}

function addExpense() {
  form.value.expenses!.push({
    expenseType: undefined,
    amount: undefined,
    occurredDate: dayjs().format('YYYY-MM-DD'),
    handlerName: '',
    departmentName: form.value.vehicle.departmentName || '',
    paymentMethod: undefined,
    needApproval: false,
    approvalStatus: '草稿',
  } as Partial<OfficeVehicleExpense>)
}

function addLicense() {
  form.value.licenses!.push({ licenseType: undefined, licenseNo: '', issueDate: undefined, expiryDate: undefined } as Partial<OfficeVehicleLicense>)
}

function addInsurance() {
  form.value.insurances!.push({ insuranceType: '', policyNo: '', insurer: '', amount: undefined, startDate: undefined, endDate: undefined } as Partial<OfficeVehicleInsurance>)
}

function removeItem(collection: 'expenses' | 'licenses' | 'insurances', index: number) {
  form.value[collection]!.splice(index, 1)
}

function close() {
  if (!saving.value)
    emit('update:open', false)
}

function validationError() {
  const vehicle = form.value.vehicle
  if (!String(vehicle.plateNo || '').trim() || !String(vehicle.brandModel || '').trim())
    return '请填写车辆的车牌号和品牌型号'

  for (const [index, item] of form.value.expenses!.entries()) {
    if (!item.expenseType || !item.occurredDate || Number(item.amount || 0) <= 0)
      return `请完整填写费用第 ${index + 1} 条的类型、金额和发生日期`
  }
  for (const [index, item] of form.value.licenses!.entries()) {
    if (!item.licenseType || !String(item.licenseNo || '').trim() || !item.expiryDate)
      return `请完整填写证照第 ${index + 1} 条的类型、编号和到期日期`
    if (item.issueDate && dayjs(item.expiryDate).isBefore(dayjs(item.issueDate), 'day'))
      return `证照第 ${index + 1} 条的到期日期不能早于发证日期`
  }
  for (const [index, item] of form.value.insurances!.entries()) {
    if (!String(item.insuranceType || '').trim() || !String(item.policyNo || '').trim() || !item.startDate || !item.endDate || Number(item.amount || 0) <= 0)
      return `请完整填写保险第 ${index + 1} 条的类型、保单号、保费和起止日期`
    if (dayjs(item.endDate).isBefore(dayjs(item.startDate), 'day'))
      return `保险第 ${index + 1} 条的到期日期不能早于开始日期`
  }
}

async function save() {
  const error = validationError()
  if (error)
    return message.warning(error)

  saving.value = true
  try {
    const { code, msg } = await saveOfficeVehicleBatchApi(form.value)
    if (code !== 200)
      return message.warning(msg)
    message.success(props.initialVehicle ? '车辆关联资料已补充' : '整车资料已保存')
    emit('update:open', false)
    emit('saved')
  }
  catch (error: any) {
    message.error(error?.message || '保存失败')
  }
  finally {
    saving.value = false
  }
}

async function upload(file: File, target: Record<string, any>, nameField: 'photoUrl' | 'attachmentName') {
  const body = new FormData()
  body.append('file', file)
  try {
    const response = await fetch('/api/uploads', {
      method: 'POST',
      headers: { Authorization: String(useAuthorization().value || '') },
      body,
    })
    const result = await response.json()
    if (!response.ok || result.code !== 200)
      throw new Error(result.msg || '上传失败')
    if (nameField === 'photoUrl') {
      target.photoUrl = result.data.url
    }
    else {
      target.attachmentName = result.data.originalName
      target.attachmentUrl = result.data.url
    }
    message.success(`已上传 ${file.name}`)
  }
  catch (error: any) {
    message.error(error?.message || '上传失败')
  }
  return false
}
</script>

<template>
  <a-modal
    :open="open"
    :title="initialVehicle ? `补充整车资料 · ${initialVehicle.plateNo}` : '新增整车资料'"
    width="1120px"
    :mask-closable="false"
    :closable="!saving"
    :keyboard="!saving"
    :confirm-loading="saving"
    :cancel-button-props="{ disabled: saving }"
    ok-text="保存全部"
    cancel-text="取消"
    wrap-class-name="office-vehicle-batch-modal"
    @cancel="close"
    @ok="save"
  >
    <a-alert type="info" show-icon message="车辆信息必填；费用、证照和保险可按需添加多条。证照与保险的到期日期会自动进入首页到期预警。" />

    <a-form layout="vertical" class="batch-form">
      <section class="batch-section vehicle-section">
        <div class="section-heading">
          <div>
            <h3>车辆信息</h3>
            <p>作为本次录入的归属车辆</p>
          </div>
        </div>
        <a-row :gutter="16">
          <a-col :xs="24" :md="12" :xl="6">
            <a-form-item label="车牌号" required>
              <a-input v-model:value="form.vehicle.plateNo" placeholder="请输入车牌号" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12" :xl="6">
            <a-form-item label="品牌型号" required>
              <a-input v-model:value="form.vehicle.brandModel" placeholder="例如 别克 GL8" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12" :xl="6">
            <a-form-item label="车辆类型">
              <a-input v-model:value="form.vehicle.vehicleType" placeholder="轿车 / 商务车" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12" :xl="6">
            <a-form-item label="车辆状态">
              <a-select v-model:value="form.vehicle.status" :options="vehicleStatuses.map(item => ({ label: item, value: item }))" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12" :xl="6">
            <a-form-item label="所属部门">
              <a-input v-model:value="form.vehicle.departmentName" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12" :xl="6">
            <a-form-item label="负责人">
              <a-input v-model:value="form.vehicle.ownerName" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12" :xl="6">
            <a-form-item label="默认司机">
              <a-input v-model:value="form.vehicle.defaultDriverName" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12" :xl="6">
            <a-form-item label="购置日期">
              <a-date-picker v-model:value="form.vehicle.purchaseDate" value-format="YYYY-MM-DD" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="车辆照片">
              <a-upload :show-upload-list="false" accept="image/*" :before-upload="(file: File) => upload(file, form.vehicle, 'photoUrl')">
                <a-button><UploadOutlined />选择图片</a-button>
              </a-upload>
              <span v-if="form.vehicle.photoUrl" class="file-name">已上传车辆图片</span>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item label="备注">
              <a-input v-model:value="form.vehicle.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </section>

      <section class="batch-section">
        <div class="section-heading">
          <div><h3>费用记录 <span>{{ form.expenses?.length || 0 }}</span></h3><p>加油、停车、维修等费用，可录入多条</p></div>
          <a-button type="text" @click="addExpense">
            <PlusOutlined />添加费用
          </a-button>
        </div>
        <div v-if="!form.expenses?.length" class="section-empty">
          暂无费用记录
        </div>
        <div v-for="(item, index) in form.expenses" :key="index" class="entry-row">
          <div class="entry-row-heading">
            <strong>费用 {{ index + 1 }}</strong><a-button type="text" danger shape="circle" title="删除此费用" @click="removeItem('expenses', index)">
              <DeleteOutlined />
            </a-button>
          </div>
          <a-row :gutter="16">
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="费用类型" required>
                <a-select v-model:value="item.expenseType" :options="expenseTypeOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="金额" required>
                <business-input-number v-model:value="item.amount" :min="0" :precision="2" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="发生日期" required>
                <a-date-picker v-model:value="item.occurredDate" value-format="YYYY-MM-DD" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="支付方式">
                <a-select v-model:value="item.paymentMethod" :options="paymentMethodOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="经办人">
                <a-input v-model:value="item.handlerName" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="发票号">
                <a-input v-model:value="item.invoiceNo" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="票据">
                <a-upload :show-upload-list="false" :accept="attachmentAccept" :before-upload="(file: File) => upload(file, item, 'attachmentName')">
                  <a-button><UploadOutlined />{{ item.attachmentName || '上传票据' }}</a-button>
                </a-upload>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="需要审批">
                <a-switch v-model:checked="item.needApproval" />
              </a-form-item>
            </a-col>
            <a-col :xs="24">
              <a-form-item label="备注">
                <a-input v-model:value="item.remark" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </section>

      <section class="batch-section">
        <div class="section-heading">
          <div><h3>证照资料 <span>{{ form.licenses?.length || 0 }}</span></h3><p>行驶证、登记证和营运证等资料</p></div>
          <a-button type="text" @click="addLicense">
            <PlusOutlined />添加证照
          </a-button>
        </div>
        <div v-if="!form.licenses?.length" class="section-empty">
          暂无证照资料
        </div>
        <div v-for="(item, index) in form.licenses" :key="index" class="entry-row">
          <div class="entry-row-heading">
            <strong>证照 {{ index + 1 }}</strong><a-button type="text" danger shape="circle" title="删除此证照" @click="removeItem('licenses', index)">
              <DeleteOutlined />
            </a-button>
          </div>
          <a-row :gutter="16">
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="证照类型" required>
                <a-select v-model:value="item.licenseType" :options="licenseTypeOptions" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="证照编号" required>
                <a-input v-model:value="item.licenseNo" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="发证日期">
                <a-date-picker v-model:value="item.issueDate" value-format="YYYY-MM-DD" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="到期日期" required>
                <a-date-picker v-model:value="item.expiryDate" value-format="YYYY-MM-DD" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="发证机关">
                <a-input v-model:value="item.issuingAuthority" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="附件">
                <a-upload :show-upload-list="false" :accept="attachmentAccept" :before-upload="(file: File) => upload(file, item, 'attachmentName')">
                  <a-button><UploadOutlined />{{ item.attachmentName || '上传证照' }}</a-button>
                </a-upload>
              </a-form-item>
            </a-col>
            <a-col :xs="24">
              <a-form-item label="备注">
                <a-input v-model:value="item.remark" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </section>

      <section class="batch-section">
        <div class="section-heading">
          <div><h3>保险信息 <span>{{ form.insurances?.length || 0 }}</span></h3><p>交强险、商业险等保单信息</p></div>
          <a-button type="text" @click="addInsurance">
            <PlusOutlined />添加保险
          </a-button>
        </div>
        <div v-if="!form.insurances?.length" class="section-empty">
          暂无保险信息
        </div>
        <div v-for="(item, index) in form.insurances" :key="index" class="entry-row">
          <div class="entry-row-heading">
            <strong>保险 {{ index + 1 }}</strong><a-button type="text" danger shape="circle" title="删除此保险" @click="removeItem('insurances', index)">
              <DeleteOutlined />
            </a-button>
          </div>
          <a-row :gutter="16">
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="保险类型" required>
                <a-input v-model:value="item.insuranceType" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="保单号" required>
                <a-input v-model:value="item.policyNo" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="保险公司">
                <a-input v-model:value="item.insurer" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="保费" required>
                <business-input-number v-model:value="item.amount" :min="0" :precision="2" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="开始日期" required>
                <a-date-picker v-model:value="item.startDate" value-format="YYYY-MM-DD" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12" :xl="6">
              <a-form-item label="到期日期" required>
                <a-date-picker v-model:value="item.endDate" value-format="YYYY-MM-DD" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item label="保单附件">
                <a-upload :show-upload-list="false" :accept="attachmentAccept" :before-upload="(file: File) => upload(file, item, 'attachmentName')">
                  <a-button><UploadOutlined />{{ item.attachmentName || '上传保单' }}</a-button>
                </a-upload>
              </a-form-item>
            </a-col>
            <a-col :xs="24">
              <a-form-item label="备注">
                <a-input v-model:value="item.remark" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </section>
    </a-form>
  </a-modal>
</template>

<style scoped lang="less">
.batch-form {
  margin-top: 20px;
}

.batch-section {
  padding: 18px 0 6px;
  border-top: 1px solid #e5e7eb;

  &:first-child {
    padding-top: 0;
    border-top: 0;
  }
}

.section-heading,
.entry-row-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-heading {
  margin-bottom: 14px;

  h3 {
    margin: 0;
    color: #111827;
    font-size: 16px;
    line-height: 1.4;
  }

  h3 span {
    margin-left: 4px;
    color: #6b7280;
    font-size: 13px;
    font-weight: 500;
  }

  p {
    margin: 3px 0 0;
    color: #6b7280;
    font-size: 13px;
  }
}

.entry-row {
  padding: 14px 0 0;
  border-top: 1px dashed #d1d5db;
}

.entry-row-heading {
  margin-bottom: 8px;

  strong {
    color: #374151;
    font-size: 13px;
  }
}

.section-empty {
  padding: 12px 0 18px;
  color: #6b7280;
  font-size: 13px;
}

.file-name {
  margin-left: 10px;
  color: #4b5563;
  font-size: 13px;
}

:deep(.ant-picker),
:deep(.ant-input-number),
:deep(.ant-select) {
  width: 100%;
}

:deep(.ant-form-item) {
  margin-bottom: 14px;
}

@media (max-width: 720px) {
  .section-heading {
    align-items: flex-start;
  }

  .section-heading p {
    display: none;
  }
}
</style>

<style lang="less">
.office-vehicle-batch-modal .ant-modal-body {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
}
</style>

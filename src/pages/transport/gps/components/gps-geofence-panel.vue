<script setup lang="ts">
import type { GpsGeofence, GpsLocationLatest, TransportVehicle } from '~@/api/gps'
import type { FenceJudgment, GpsFenceForm } from './types'

defineProps<{
  fences: GpsGeofence[]
  vehicles: TransportVehicle[]
  routes: Array<Record<string, string>>
  judgments: Map<string, FenceJudgment>
  selectedLocation?: GpsLocationLatest
  saving?: boolean
}>()
const emit = defineEmits<{
  routeChange: []
  useSelectedLocation: []
  save: []
  reset: []
  focus: [record: GpsGeofence]
  edit: [record: GpsGeofence]
}>()

const form = defineModel<GpsFenceForm>('form', { required: true })
</script>

<template>
  <a-row :gutter="[16, 16]">
    <a-col :xs="24" :lg="8">
      <div class="fence-form-head">
        <div>
          <strong>{{ form.id ? '编辑电子围栏' : '新建电子围栏' }}</strong>
          <span>{{ form.id ? form.name : '设置范围并绑定监管车辆' }}</span>
        </div>
        <a-button v-if="form.id" size="small" @click="emit('reset')">
          取消编辑
        </a-button>
      </div>
      <a-form layout="vertical">
        <a-form-item label="关联路线">
          <a-select
            v-model:value="form.routeCode"
            show-search
            allow-clear
            placeholder="选择路线后设定装车或卸车围栏"
            :filter-option="(input: string, option: any) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())"
            @change="emit('routeChange')"
          >
            <a-select-option v-for="item in routes" :key="item.code" :value="item.code" :label="`${item.code} ${item.name}`">
              {{ item.code }} · {{ item.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="form.routeCode" label="路线节点">
          <a-segmented v-model:value="form.routeStage" :options="[{ label: '装车地', value: 'loading' }, { label: '卸车地', value: 'unloading' }]" @change="emit('routeChange')" />
        </a-form-item>
        <a-form-item label="围栏名称">
          <a-input v-model:value="form.name" placeholder="例如：西宁配送中心" />
        </a-form-item>
        <a-form-item label="地址">
          <a-input v-model:value="form.address" placeholder="请输入围栏所在地址" />
        </a-form-item>
        <a-form-item label="围栏类型">
          <a-radio-group v-model:value="form.shape" button-style="solid">
            <a-radio-button value="circle">
              圆形
            </a-radio-button>
            <a-radio-button value="polygon">
              多边形
            </a-radio-button>
          </a-radio-group>
        </a-form-item>
        <template v-if="form.shape === 'circle'">
          <a-button class="mb-3" block :disabled="!selectedLocation" @click="emit('useSelectedLocation')">
            使用当前选中车辆的最新位置作为中心点
          </a-button>
          <a-row :gutter="12">
            <a-col :span="12">
              <a-form-item label="中心经度">
                <business-input-number v-model:value="form.centerLongitude" w-full :min="-180" :max="180" :precision="6" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="中心纬度">
                <business-input-number v-model:value="form.centerLatitude" w-full :min="-90" :max="90" :precision="6" />
              </a-form-item>
            </a-col>
          </a-row>
        </template>
        <a-form-item v-if="form.shape === 'circle'" label="半径（米）">
          <business-input-number v-model:value="form.radius" w-full :min="100" :max="500000" :step="100" />
        </a-form-item>
        <a-form-item v-else label="多边形顶点">
          <a-textarea v-model:value="form.polygonPoints" :rows="7" placeholder="每行一个顶点：经度,纬度（至少 3 个点）" />
        </a-form-item>
        <a-alert class="mb-4" type="info" show-icon message="坐标使用 WGS-84；车辆进入判断还需连续 GPS 定位点和定位时间。" />
        <a-form-item label="绑定车辆">
          <a-select v-model:value="form.vehicleIds" mode="multiple" w-full>
            <a-select-option v-for="vehicle in vehicles" :key="vehicle.vehicleId" :value="vehicle.vehicleId">
              {{ vehicle.plateNo }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" :loading="saving" @click="emit('save')">
              {{ form.id ? '保存修改' : '创建围栏' }}
            </a-button>
            <a-button :disabled="saving" @click="emit('reset')">
              重置
            </a-button>
            <a-switch v-model:checked="form.enabled" checked-children="启用" un-checked-children="停用" />
          </a-space>
        </a-form-item>
      </a-form>
    </a-col>
    <a-col :xs="24" :lg="16">
      <a-table row-key="id" :data-source="fences">
        <a-table-column title="围栏名称" data-index="name" />
        <a-table-column title="地址" data-index="address" :width="220" />
        <a-table-column title="路线节点" :width="120">
          <template #default="{ record }">
            <span v-if="record.routeCode">{{ record.routeStage === 'loading' ? '装车地' : '卸车地' }}</span><span v-else>-</span>
          </template>
        </a-table-column>
        <a-table-column title="类型" data-index="shape" />
        <a-table-column title="范围" :width="130">
          <template #default="{ record }">
            {{ record.shape === 'circle' ? `圆形 · ${record.radius || 0}米` : `多边形 · ${record.points?.length || 0}点` }}
          </template>
        </a-table-column>
        <a-table-column title="绑定车辆" :width="100">
          <template #default="{ record }">
            {{ record.vehicles?.length || 0 }} 辆
          </template>
        </a-table-column>
        <a-table-column title="车辆判定" :width="140">
          <template #default="{ record }">
            <a-tag v-if="!record.enabled">
              已停用
            </a-tag>
            <a-tag v-else-if="!record.vehicles?.length">
              未绑定车辆
            </a-tag>
            <a-tag v-else-if="!judgments.get(record.id)?.locatedCount">
              {{ judgments.get(record.id)?.staleCount ? `定位已过期 ${judgments.get(record.id)?.staleCount} 辆` : '无定位数据' }}
            </a-tag>
            <a-tag v-else :color="judgments.get(record.id)?.insideCount ? 'success' : 'warning'">
              围栏内 {{ judgments.get(record.id)?.insideCount || 0 }} / {{ judgments.get(record.id)?.locatedCount || 0 }} 辆
              <template v-if="judgments.get(record.id)?.staleCount">
                （过期 {{ judgments.get(record.id)?.staleCount }}）
              </template>
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="状态" :width="90">
          <template #default="{ record }">
            <a-tag :color="record.enabled ? 'success' : 'default'">
              {{ record.enabled ? '启用' : '停用' }}
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="操作" :width="180">
          <template #default="{ record }">
            <a-space><a @click="emit('focus', record)">地图定位</a><a @click="emit('edit', record)">编辑</a></a-space>
          </template>
        </a-table-column>
      </a-table>
    </a-col>
  </a-row>
</template>

<style scoped>
.fence-form-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 14px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--admin-border-subtle, #e8edf5);
}
.fence-form-head div {
  display: grid;
  gap: 4px;
}
.fence-form-head strong {
  color: var(--admin-text, #1f2937);
  font-size: 15px;
}
.fence-form-head span {
  color: var(--admin-muted, #64748b);
  font-size: 12px;
}
</style>

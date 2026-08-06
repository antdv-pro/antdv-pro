<script setup lang="ts">
const content = '围绕企业管理场景沉淀标准流程、权限规则、数据指标和协同机制，帮助团队快速完成业务处理与运营跟踪。'

const data = ref([
  {
    title: '客户管理',
    link: 'https://gw.alipayobjects.com/zos/rmsportal/WdGqmHpayyMjiEhcKoVE.png',
  },
  {
    title: '合同管理',
    link: 'https://www.antdv.com/assets/logo.1ef800a8.svg',
  },
  {
    title: '项目管理',
    link: 'https://gw.alipayobjects.com/zos/rmsportal/ComBAopevLwENQdKWiIn.png',
  },
  {
    title: '流程审批',
    link: 'https://cn.vitejs.dev/logo.svg',
  },
  {
    title: '资产管理',
    link: 'https://gw.alipayobjects.com/zos/rmsportal/kZzEzemZyKLKFsojXItE.png',
  },
  {
    title: '数据看板',
    link: '/logo.png',
  },
  {
    title: '组织架构',
    link: 'https://gw.alipayobjects.com/zos/rmsportal/nxkuOJlFJuAUhzlMTCEe.png',
  },
  {
    title: '系统设置',
    link: 'https://gw.alipayobjects.com/zos/rmsportal/zOsKZmFRdUtvpqCImOVY.png',
  },
])
</script>

<template>
  <page-container>
    <div class="mt-2">
      <a-row :gutter="16">
        <a-col :xs="16" :sm="8" :md="6" :lg="6" :xl="6" class="mb-4">
          <a-button class="w-1/1 h-204px" type="dashed">
            +新增产品
          </a-button>
        </a-col>
        <a-col v-for="(item, index) in data" :key="index" :xs="16" :sm="8" :md="6" :lg="6" :xl="6" class="mb-4">
          <a-card
            :bordered="false"
            style="borderRadius: 0"
            class="cursor-pointer
            hover:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.35)]
            transition
            duration-300"
          >
            <template #default>
              <div class="flex h-27">
                <div class="w-10 h-10 bg-gray-300 rounded-full">
                  <img class="w-10 h-10 rounded-full" :src="item.link">
                </div>
                <div class="ml">
                  <div style="font-size: 18px; font-weight: 500;">
                    {{ item.title }}
                  </div>
                  <div class="h-17 overflow-hidden overflow">
                    {{ content }}
                  </div>
                </div>
              </div>
            </template>
            <template #actions>
              <li>操作一</li>
              <li>操作二</li>
            </template>
          </a-card>
        </a-col>
      </a-row>
    </div>
  </page-container>
</template>

<style scoped>
.overflow {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
</style>

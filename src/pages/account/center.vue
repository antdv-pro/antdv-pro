<script setup>
import { ApartmentOutlined, AuditOutlined, HomeOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { nextTick, reactive, ref } from 'vue'
import rightContent from './components/right-content.vue'

const { t } = useI18n()
const inputRef = ref()
const state = reactive({
  tags: ['专注', '坚持', '很有想法', '执行力强', '乐观'],
  inputVisible: false,
  inputValue: '',
})
function handleClose(removedTag) {
  const tags = state.tags.filter(tag => tag !== removedTag)
  state.tags = tags
}
function showInput() {
  state.inputVisible = true
  nextTick(() => {
    inputRef.value.focus()
  })
}
function handleInputConfirm() {
  const inputValue = state.inputValue
  let tags = state.tags
  if (inputValue && !tags.includes(inputValue))
    tags = [...tags, inputValue]
  Object.assign(state, {
    tags,
    inputVisible: false,
    inputValue: '',
  })
}
const teamData = ref([
  {
    name: 'Antdv Pro',
    link: '/logo.svg',
  },
  {
    name: '学习小组',
    link: 'https://gw.alipayobjects.com/zos/rmsportal/WdGqmHpayyMjiEhcKoVE.png',
  },
  {
    name: '工作小组',
    link: 'https://gw.alipayobjects.com/zos/rmsportal/ComBAopevLwENQdKWiIn.png',
  },
  {
    name: '设计团队',
    link: 'https://gw.alipayobjects.com/zos/rmsportal/kZzEzemZyKLKFsojXItE.png',
  },
])
</script>

<template>
  <div class="gutter-example">
    <a-row :gutter="24">
      <a-col :span="7">
        <a-card>
          <div class="flex justify-center">
            <a-avatar :size="86">
              <template #icon>
                <img src="https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png" alt="">
              </template>
            </a-avatar>
          </div>
          <div class="flex flex-col items-center justify-center mt-5">
            <span class="font-bold text-16px">超级管理员</span>
            <span>好好学习, 天天向上</span>
          </div>
          <div class="p-8">
            <p>
              <span class="mr-2">
                <AuditOutlined />
              </span>
              <span>
                程序员
              </span>
            </p>
            <p>
              <span class="mr-2">
                <ApartmentOutlined />
              </span>
              <span>
                蚂蚁金服－某某某事业群－某某平台部－某某技术部－UED
              </span>
            </p>
            <p>
              <span class="mr-2">
                <HomeOutlined />
              </span>
              <span>
                广东省广州市
              </span>
            </p>
          </div>
          <div>
            <p>
              {{ t('account.center.tags') }}
            </p>
            <template v-for="(tag, index) in state.tags" :key="tag">
              <a-tooltip v-if="tag.length > 20" :title="tag">
                <a-tag :closable="index !== 0" @close="handleClose(tag)">
                  {{ `${tag.slice(0, 20)}...` }}
                </a-tag>
              </a-tooltip>
              <a-tag v-else :closable="index !== 0" @close="handleClose(tag)">
                {{ tag }}
              </a-tag>
            </template>
            <a-input
              v-if="state.inputVisible"
              ref="inputRef"
              v-model:value="state.inputValue"
              type="text"
              size="small"
              :style="{ width: '78px' }"
              @blur="handleInputConfirm"
              @keyup.enter="handleInputConfirm"
            />
            <a-tag v-else style="background: #fff; border-style: dashed" @click="showInput">
              <PlusOutlined />
            </a-tag>
          </div>
          <div class="mt-10">
            <p>
              {{ t('account.cneter.team') }}
            </p>
            <div class="flex flex-wrap justify-between">
              <span v-for="(item, index) in teamData" :key="index" class="flex items-center w-120px mb-5">
                <a-avatar :size="26" class="mr-2">
                  <template #icon>
                    <img :src="item.link" alt="">
                  </template>
                </a-avatar>
                <span>{{ item.name }}</span>
              </span>
            </div>
          </div>
        </a-card>
      </a-col>
      <!-- right-content -->
      <a-col :span="17">
        <right-content />
      </a-col>
    </a-row>
  </div>
</template>

<style scoped lang="less">

</style>

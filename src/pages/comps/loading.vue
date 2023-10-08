<script setup lang="ts">
import { useLoading } from '@/composables/base-loading'

const loading = ref(false)
const full = ref(false)

const time = ref(1000)

const loadingList = ref([
  'pulse',
  'rect',
  'plane',
  'cube',
  'preloader',
  'chase',
  'dot',
])

function startCustomLoading(val: number) {
  full.value = val === 2
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 2000)
}

function startLoading(item: any) {
  const { open, close } = useLoading({ spin: item })
  open()
  setTimeout(() => {
    close()
  }, 2000)
}

function startTimeLoading() {
  const { open, close } = useLoading({ minTime: time.value })
  open()
  close()
}
</script>

<template>
  <div class="loading-wrapper">
    <a-card title="指令方式加载loading" :hoverable="true" :bordered="false">
      <div
        v-loading="loading"
        class="relative w-full h-[150px]"
        loading-text="自定义指令loading"
        loading-spin="pulse"
        :loading-full="full"
      >
        <a-space :size="15">
          <a-button type="primary" @click="startCustomLoading(1)">
            v-loading指令全屏
          </a-button>
          <a-button type="primary" @click="startCustomLoading(2)">
            v-loading指令非全屏
          </a-button>
        </a-space>
      </div>
    </a-card>
    <a-card title="hook加载loading" hoverable :bordered="false" style="margin-top:15px">
      <a-space :size="15">
        <a-button v-for="(item, index) in loadingList" :key="item" type="primary" @click="startLoading(item)">
          loading{{ index + 1 }}
        </a-button>
      </a-space>
    </a-card>
    <a-card title="hooloading最小时长" hoverable :bordered="false">
      <a-space :size="15">
        <a-input-number v-model:value="time" />
        <a-button type="primary" @click="startTimeLoading">
          点击触发loading
        </a-button>
      </a-space>
    </a-card>
  </div>
</template>

<style scoped></style>

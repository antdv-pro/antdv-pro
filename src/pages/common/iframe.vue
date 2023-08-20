<script setup lang="ts">
const route = useRoute()
const url = computed(() => route?.meta?.url)
const loading = ref(true)
const finishLoading = () => {
  loading.value = false
}
</script>

<template>
  <div
    class="bg-[var(--bg-color)]"
    w-full h-full b-rd-8px of-hidden
    flex flex-col flex-1
  >
    <a-spin
      :spinning="loading"
      wrapper-class-name="b-rd-8px of-hidden w-full h-full flex flex-col flex-1"
    >
      <iframe w-full h-full flex flex-col flex-1 :src="url" style="border: none" @load="finishLoading" />
    </a-spin>
  </div>
</template>

<style scoped>
:deep(.ant-spin-container){
  height: 100% !important;
  width: 100% !important;
}
</style>

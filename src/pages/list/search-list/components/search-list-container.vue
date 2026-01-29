<script lang="ts" setup>
const route = useRoute()
const router = useRouter()
const activeKey = computed(() => route.path)
function handleChangePage(key: any) {
  router.push(key)
}
const tabItems = [
  { key: '/list/search-list/articles', label: '文章' },
  { key: '/list/search-list/projects', label: '项目' },
  { key: '/list/search-list/applications', label: '应用' },
]
</script>

<template>
  <page-container class="search-list-container">
    <template #content>
      <div class="flex items-center justify-center">
        <a-input-search
          placeholder="请输入"
          enter-button="搜索"
          style="width: 300px"
        />
      </div>
    </template>
    <template #footer>
      <div class="mt-6 mb--16px">
        <a-tabs :active-key="activeKey" :items="tabItems" @update:active-key="handleChangePage" />
      </div>
    </template>
    <slot />
  </page-container>
</template>

<style lang="less">
.search-list-container {
  .ant-tabs-nav {
    margin-bottom: 0;
  }
  .ant-tabs-nav::before {
    border-bottom: none;
  }
}
</style>

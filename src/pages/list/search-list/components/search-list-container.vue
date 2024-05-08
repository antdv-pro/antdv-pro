<script setup>
const route = useRoute()
const router = useRouter()
const activeKey = computed(() => route.path)
function handleChangePage(key) {
  router.push(key)
}
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
        <a-tabs :active-key="activeKey" @update:active-key="handleChangePage">
          <a-tab-pane key="/list/search-list/articles" tab="文章" />
          <a-tab-pane key="/list/search-list/projects" tab="项目" />
          <a-tab-pane key="/list/search-list/applications" tab="应用" />
        </a-tabs>
      </div>
    </template>
    <slot />
  </page-container>
</template>

<style lang="less">
.search-list-container{
  .ant-tabs-nav{
    margin-bottom: 0;
  }
  .ant-tabs-nav::before{
    border-bottom: none;
  }
}
</style>

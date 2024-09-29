<script setup lang="ts">
defineOptions({
  name: 'Test',
})

onActivated(() => {
  console.log('wrap activated')
})

onMounted(() => {
  console.log('wrap mounted')
})
</script>

<template>
  <div class="wrap-component">
    wrap-component
    <a-layout>
      <a-layout-sider>
        <a-menu>
          <a-menu-item :key="1">
            <RouterLink to="/test/page1">
              page1
            </RouterLink>
          </a-menu-item>
          <a-menu-item :key="2">
            <RouterLink to="/test/page2">
              page2
            </RouterLink>
          </a-menu-item>
        </a-menu>
      </a-layout-sider>
      <a-layout>
        <a-layout-header>
          header
        </a-layout-header>
        <a-layout-content>
          <RouterView>
            <template #default="{ Component, route }">
              <KeepAlive>
                <component :is="Component" :key="route.path" />
              </KeepAlive>
            </template>
          </RouterView>
        </a-layout-content>
      </a-layout>
    </a-layout>
  </div>
</template>

<style scoped>

</style>

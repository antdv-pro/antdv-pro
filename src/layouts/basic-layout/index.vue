<script setup lang="ts">
import Header from '../components/header/index.vue'
</script>

<template>
  <div class="ant-pro-basicLayout">
    <a-layout>
      <Header />
      <a-layout-content>
        <router-view />
      </a-layout-content>
    </a-layout>
  </div>
</template>

<style lang="less">
@import './index.less';
</style>

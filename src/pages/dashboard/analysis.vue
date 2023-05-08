<script setup lang="ts">
import { test200, test401, test500, testDelete, testPost, testPut } from '~/api/test'
</script>

<template>
  <div p-2>
    <a-space wrap>
      <a-button @click="test200">
        200请求测试
      </a-button>
      <a-button @click="test401">
        401请求测试
      </a-button>
      <a-button @click="test500">
        500请求测试
      </a-button>
      <a-button @click="testPut">
        put请求测试
      </a-button>
      <a-button @click="testPost">
        post请求测试
      </a-button>
      <a-button @click="testDelete">
        delete请求测试
      </a-button>
    </a-space>
  </div>
</template>

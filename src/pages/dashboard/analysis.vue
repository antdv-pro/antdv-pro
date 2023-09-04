<script setup lang="ts">
import IntroduceRow from '~/pages/dashboard/introduce-row.vue'

const loading = ref(false)

const visitData = ref([])
</script>

<template>
  <page-container>
    <Suspense :fallback="null">
      <IntroduceRow :loading="loading" :visit-data="visitData" />
    </Suspense>
  </page-container>
</template>

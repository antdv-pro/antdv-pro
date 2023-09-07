<script setup lang="ts">
import IntroduceRow from '~/pages/dashboard/introduce-row.vue'
import SalesCard from '~/pages/dashboard/sales-card.vue'
import TopSearch from '~/pages/dashboard/components/top-search.vue'

const loading = ref(false)

const visitData = ref([])
</script>

<template>
  <page-container>
    <Suspense :fallback="null">
      <IntroduceRow :loading="loading" :visit-data="visitData" />
    </Suspense>

    <Suspense :fallback="null">
      <SalesCard />
    </Suspense>

    <a-row
      :gutter="24"
      :style="{ marginTop: '24px' }"
    >
      <a-col :xl="12" :lg="24" :md="24" :sm="24" :xs="24">
        <Suspense :fallback="null">
          <TopSearch />
        </Suspense>
      </a-col>
      <a-col :xl="12" :lg="24" :md="24" :sm="24" :xs="24">
        <Suspense :fallback="null">
          <!--          <ProportionSales -->
          <!--            dropdown-group="{dropdownGroup}" -->
          <!--            sales-type="{salesType}" -->
          <!--            loading="{loading}" -->
          <!--            sales-pie-data="{salesPieData" || []} -->
          <!--            handle-change-sales-type="{handleChangeSalesType}" -->
          <!--          /> -->
        </Suspense>
      </a-col>
    </a-row>
  </page-container>
</template>

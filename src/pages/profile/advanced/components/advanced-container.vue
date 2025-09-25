<script setup lang="ts">
import headerInfo from './header-info.vue'
import logCard from './log-card.vue'
import phoneDataCard from './phone-data.vue'
import stepCard from './step-card.vue'
import userInfoCard from './user-info.vue'
</script>

<template>
  <page-container>
    <template #content>
      <header-info />
    </template>
    <step-card />
    <user-info-card />
    <phone-data-card />
    <log-card />
  </page-container>
</template>

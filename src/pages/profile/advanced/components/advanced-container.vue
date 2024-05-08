<script setup>
import headerInfo from './header-info.vue'
import stepCard from './step-card.vue'
import userInfoCard from './user-info.vue'
import phoneDataCard from './phone-data.vue'
import logCard from './log-card.vue'
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

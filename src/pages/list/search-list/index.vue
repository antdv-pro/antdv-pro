<script setup>
import SearchListContainer from './components/search-list-container.vue'

defineOptions({
  name: 'SearchList',
})
</script>

<template>
  <SearchListContainer>
    <slot />
  </SearchListContainer>
</template>

<style scoped lang="less">

</style>

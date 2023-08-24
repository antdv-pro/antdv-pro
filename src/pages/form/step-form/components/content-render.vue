<script lang="ts">
export default {
  props: ['component'],
}
</script>

<template>
  <component :is="component" />
</template>

<style scoped lang="less">

</style>

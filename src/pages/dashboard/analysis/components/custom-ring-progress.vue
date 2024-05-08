<script setup>
import { RingProgress } from '@antv/g2plot'

const props = defineProps({
  percent: {
    type: Number,
    default: 0,
  },
})
const container = ref()
onMounted(() => {
  new RingProgress(container.value, {
    height: 60,
    width: 60,
    autoFit: true,
    percent: props.percent,
    innerRadius: 0.7,
    color: ['#fab120', '#E8EDF3'],
    statistic: {
      content: false,
    },
  }).render()
})
</script>

<template>
  <div ref="container" />
</template>

<style scoped lang="less">

</style>

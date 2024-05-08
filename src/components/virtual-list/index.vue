<script setup>
const props = defineProps({
  dataSource: { type: Array, required: true },
  itemHeight: { type: Number, required: false, default: 80 },
})
const transformY = ref()
const transformStyle = computed(() => {
  return `transform: translateY(${transformY.value}px)`
})
const scrollerContainerRef = ref()
const scrollerContainerRefHeight = computed(() => {
  return scrollerContainerRef.value ? scrollerContainerRef.value.offsetHeight : 0
})
const itemCount = computed(() => {
  return Math.ceil(scrollerContainerRefHeight.value / props.itemHeight) + 1
})
const start = ref(0)
const end = computed(() => {
  return start.value + itemCount.value
})
const Data = ref()
const pillarHeight = computed(() => {
  if (Data.value?.length)
    return props.itemHeight * Data.value?.length
  return void 0
})
const renderData = computed(() => {
  const _start = Math.max(0, start.value)
  const _end = Math.min(end.value, Data.value.length)
  return Data.value?.slice(_start, _end)
})
function init() {
  if (!props.dataSource) {
    const res = Array.from({ length: 1e4 })
    res.forEach((_, i) => {
      res[i] = i
    })
    Data.value = res
  }
  else {
    Data.value = props.dataSource
  }
}
function handleScroll(e) {
  const scrollTop = e.target.scrollTop
  start.value = Math.floor(scrollTop / props.itemHeight)
  transformY.value = start.value * props.itemHeight
}
onMounted(() => {
  init()
})
</script>

<template>
  <div v-if="Data" class="list-container">
    <div ref="scrollerContainerRef" class="scroller-container scrollbar" @scroll="handleScroll">
      <div class="pillar" :style="{ height: `${pillarHeight}px` }" />
      <div class="list" :style="transformStyle">
        <div v-for="(item, index) in renderData" :key="index" class="item" :style="{ height: `${itemHeight}px` }">
          <slot name="renderItem" :item="item" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.scrollbar {
  &::-webkit-scrollbar {
    width: 5px;
    height: 10px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 5px;
    -webkit-box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2);
    background: rgba(190, 190, 190, 0.2);
  }

  &::-webkit-scrollbar-track {
    -webkit-box-shadow: inset 0 0 5px rgba(227, 227, 227, 0.2);
    border-radius: 0;
    background: rgba(0, 0, 0, 0.1);
  }
}

.list-container {
  height: 350px;
  width: 100%;
  background-color: var(--bg-color);

  .scroller-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: auto;
    // 处理ios滚动卡顿
    --webkit-overflow-scrolling: touch;

    .pillar {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      z-index: -1;
    }

    .list {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;

      .item {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        width: 100%;
        height: 50px;
        padding: 0 20px;
        border-bottom: 1px solid var(--bg-color-container);

        :deep(.ant-list-item) {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;

          .ant-list-item-action {
            margin-top: 18px;
          }

          & > div:nth-child(1) {
            flex: 1;
          }
        }

        :deep(.ant-list-item-meta) {
          display: flex;
          .ant-list-item-meta-avatar {
            margin-right: 15px;
          }
        }
      }
    }
  }
}
</style>

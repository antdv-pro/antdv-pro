<script setup>
import { TinyArea } from '@antv/g2plot'

const activeData = ref([])
const tinyAreaData = ref([])
let tinyArea
let requestRef
let timer
function fixedZero(val) {
  return val < 10 ? `0${val}` : val
}
function getActiveData() {
  activeData.value = []
  tinyAreaData.value = []
  for (let i = 0; i < 24; i += 1) {
    activeData.value.push({
      x: `${fixedZero(i)}:00`,
      y: Math.floor(Math.random() * 200) + i * 50,
    })
    tinyAreaData.value.push(Math.floor(Math.random() * 200) + i * 50)
  }
  tinyArea?.changeData(tinyAreaData.value)
}
function loopData() {
  requestRef = requestAnimationFrame(() => {
    timer = window.setTimeout(() => {
      getActiveData()
      loopData()
    }, 1e3)
  })
}
const tinyAreaContainer = ref()
onMounted(() => {
  tinyArea = new TinyArea(tinyAreaContainer.value, {
    height: 84,
    data: tinyAreaData.value,
    smooth: true,
    autoFit: true,
  })
  tinyArea.render()
  loopData()
  getActiveData()
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  if (requestRef)
    cancelAnimationFrame(requestRef)
  tinyArea?.destroy()
  tinyArea = void 0
})
</script>

<template>
  <div class="activeChart">
    <a-statistic title="目标评估" value="有望达到预期" />
    <div :style="{ marginTop: '32px' }">
      <div ref="tinyAreaContainer" />
    </div>
    <div>
      <div class="activeChartGrid">
        <p>{{ [...activeData].sort()[activeData.length - 1]?.y + 200 }} 亿元</p>
        <p>{{ [...activeData].sort()[Math.floor(activeData.length / 2)]?.y }} 亿元</p>
      </div>
      <div class="dashedLine">
        <div class="line" />
      </div>
      <div class="dashedLine">
        <div class="line" />
      </div>
    </div>
    <div class="activeChartLegend">
      <span>00:00</span>
      <span>{{ activeData[Math.floor(activeData.length / 2)]?.x }}</span>
      <span>{{ activeData[activeData.length - 1]?.x }}</span>
    </div>
  </div>
</template>

<style scoped lang="less">
.activeChart {
  position: relative;
}
.activeChartGrid {
  p {
    position: absolute;
    top: 80px;
  }
  p:last-child {
    top: 115px;
  }
}
.activeChartLegend {
  position: relative;
  height: 20px;
  margin-top: 8px;
  font-size: 0;
  line-height: 20px;
  span {
    display: inline-block;
    width: 33.33%;
    font-size: 12px;
    text-align: center;
  }
  span:first-child {
    text-align: left;
  }
  span:last-child {
    text-align: right;
  }
}
.dashedLine {
  position: relative;
  top: -70px;
  left: -3px;
  height: 1px;

  .line {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: linear-gradient(to right, transparent 50%, #e9e9e9 50%);
    background-size: 6px;
  }
}

.dashedLine:last-child {
  top: -36px;
}
</style>

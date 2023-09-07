<script setup lang="ts">
import ActiveChart from '~/pages/dashboard/monitor/active-chart.vue'

const convertNumber = (number: number) => {
  return number.toLocaleString()
}
const deadline = Date.now() + 1000 * 60 * 60 * 24 * 2 + 1000 * 30
</script>

<template>
  <page-container>
    <a-row :gutter="24">
      <a-col :xl="18" :lg="24" :md="24" :sm="24" :xs="24" :style="{ marginBottom: '24px' }">
        <a-card title="活动实时交易情况" :bordered="false">
          <a-row>
            <a-col :md="6" :sm="12" :xs="24">
              <a-statistic
                title="今日交易总额"
                suffix="元"
                :value="convertNumber(124543233)"
              />
            </a-col>
            <a-col :md="6" :sm="12" :xs="24">
              <a-statistic title="销售目标完成率" value="92%" />
            </a-col>
            <a-col :md="6" :sm="12" :xs="24">
              <a-statistic-countdown title="活动剩余时间" :value="deadline" format="HH:mm:ss:SSS" />
            </a-col>
            <a-col :md="6" :sm="12" :xs="24">
              <a-statistic title="每秒交易总额" suffix="元" :value="convertNumber(234)" />
            </a-col>
          </a-row>
          <div class="mapChart">
            <Map />
          </div>
        </a-card>
      </a-col>
      <a-col :xl="6" :lg="24" :md="24" :sm="24" :xs="24">
        <a-card title="活动情况预测" :style="{ marginBottom: '24px' }" :bordered="false">
          <ActiveChart />
        </a-card>
        <a-card
          title="券核效率"
          :style="{ marginBottom: 24 }"
          :body-style="{ textAlign: 'center' }"
          :bordered="false"
        >
          <!--          <Gauge -->
          <!--            height="180" -->
          <!--            min="0" -->
          <!--            max="100" -->
          <!--            force-fit -->
          <!--            value="87" -->
          <!--            range="[0," 25, 50, 75, 100]} -->
          <!--            statistic="{{" -->
          <!--            visible: true, -->
          <!--            text: '优', -->
          <!--            color: '#30bf78', -->
          <!--            }} -->
          <!--          /> -->
        </a-card>
      </a-col>
    </a-row>
    <a-row gutter="24">
      <a-col :xl="12" :lg="24" :sm="24" :xs="24" :style="{ marginBottom: '24px' }">
        <a-card title="各品类占比" :bordered="false" class="pieCard">
          <a-row :style="{ padding: '16px 0' }">
            <a-col :span="8">
              <!--              <RingProgress force-fit height="128" percent="0.28" /> -->
              <!--              {/* <Pie -->
              <!--                animate="false" -->
              <!--                percent="28" -->
              <!--                title="中式快餐" -->
              <!--                total="28%" -->
              <!--                height="128" -->
              <!--                line-width="2" -->
              <!--              /> */} -->
            </a-col>
            <a-col :span="8">
              <!--              <RingProgress color="#5DDECF" force-fit height="128" percent="0.22" /> -->
            </a-col>
            <a-col :span="8">
              <!--              <RingProgress color="#2FC25B" force-fit height="128" percent="0.32" /> -->
            </a-col>
          </a-row>
        </a-card>
      </a-col>
      <a-col :xl="6" :lg="12" :sm="24" :xs="24" :style="{ marginBottom: 24 }">
        <a-card
          title="热门搜索"
          :loading="loading"
          :bordered="false"
          :body-style="{ overflow: 'hidden' }"
        >
          <!--          <WordCloud -->
          <!--            data="wordCloudData" -->
          <!--            force-fit -->
          <!--            height="162" -->
          <!--            word-style="{{" -->
          <!--            fontSize: [10, 20], -->
          <!--            }} -->
          <!--            shape="triangle" -->
          <!--          /> -->
          <!--          {/* <TagCloud data="data?.list" || []} height="161" /> */} -->
        </a-card>
      </a-col>
      <a-col :xl="6" :lg="12" :sm="24" :xs="24" :style="{ marginBottom: 24 }">
        <a-card
          title="资源剩余"
          :body-style="{ textAlign: 'center', fontSize: 0 }"
          :bordered="false"
        >
          <!--          <Liquid -->
          <!--            height="161" -->
          <!--            min="0" -->
          <!--            max="10000" -->
          <!--            value="5639" -->
          <!--            force-fit -->
          <!--            padding="[0," 0, 0, 0]} -->
          <!--            statistic="{{" -->
          <!--            formatter: (value) = -->
          <!--          > -->
          <!--            `${((100 * value) / 10000).toFixed(1)}%`, -->
          <!--            }} -->
          <!--            /> -->
          <!--          </liquid> -->
        </a-card>
      </a-col>
    </a-row>
  </page-container>
</template>

<style scoped lang="less">
.mapChart {
  height: 452px;
  padding-top: 24px;
  img {
    display: inline-block;
    max-width: 100%;
    max-height: 437px;
  }
}

.pieCard :global(.pie-stat) {
  font-size: 24px !important;
}

@media screen and (max-width: 992px) {
  .mapChart {
    height: auto;
  }
}
</style>

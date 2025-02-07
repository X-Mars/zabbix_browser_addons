<template>
  <div ref="chartRef" class="trend-chart"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const option: EChartsOption = {
  tooltip: {
    trigger: 'axis'
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: []
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      name: t('dashboard.alertCount'),
      type: 'line',
      smooth: true,
      data: [],
      areaStyle: {
        opacity: 0.1
      },
      lineStyle: {
        width: 2
      }
    }
  ]
}

function initChart() {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    chart.setOption(option)
  }
}

function updateData(dates: string[], values: number[]) {
  if (chart) {
    chart.setOption({
      xAxis: {
        data: dates
      },
      series: [{
        data: values
      }]
    })
  }
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', () => chart?.resize())
})

onUnmounted(() => {
  chart?.dispose()
  window.removeEventListener('resize', () => chart?.resize())
})

defineExpose({
  updateData
})
</script>

<style scoped>
.trend-chart {
  width: 100%;
  height: 100%;
}
</style>
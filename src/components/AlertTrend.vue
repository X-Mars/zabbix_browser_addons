<template>
  <el-card class="chart-card">
    <template #header>
      <div class="card-header">
        <span>告警趋势</span>
      </div>
    </template>
    <div ref="chartRef" class="chart"></div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

const props = defineProps<{
  data: Array<{ name: string, value: [number, number] }>
}>()

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

watch(() => props.data, (newData) => {
  updateChart(newData)
}, { deep: true })

const initChart = () => {
  if (!chartRef.value) return
  
  chart = echarts.init(chartRef.value)
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
      type: 'time',
      boundaryGap: false
    },
    yAxis: {
      type: 'value',
      minInterval: 1
    },
    series: [{
      name: '告警数量',
      type: 'line',
      smooth: true,
      data: [],
      areaStyle: {
        opacity: 0.1
      }
    }]
  }
  chart.setOption(option)
}

const updateChart = (data: any[]) => {
  if (!chart) return
  chart.setOption({
    series: [{
      data: data
    }]
  })
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (chart) {
    chart.dispose()
    chart = null
  }
  window.removeEventListener('resize', handleResize)
})

const handleResize = () => {
  chart?.resize()
}
</script>

<style scoped>
.chart-card {
  height: calc((100vh - 200px) / 2);  /* 适应屏幕高度 */
}

.chart {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style> 
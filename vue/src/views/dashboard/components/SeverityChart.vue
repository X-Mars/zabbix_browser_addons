<template>
  <div ref="chartRef" class="severity-chart"></div>
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
    trigger: 'item'
  },
  legend: {
    orient: 'vertical',
    right: 10,
    top: 'center'
  },
  series: [
    {
      name: t('dashboard.alertDistribution'),
      type: 'pie',
      radius: ['50%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      labelLine: {
        show: false
      },
      data: []
    }
  ]
}

function initChart() {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    chart.setOption(option)
  }
}

function updateData(data: Array<{ name: string; value: number }>) {
  if (chart) {
    chart.setOption({
      series: [{
        data
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
.severity-chart {
  width: 100%;
  height: 100%;
}
</style>
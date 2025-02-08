<template>
  <div class="dashboard">
    <el-row :gutter="24">
      <el-col :span="12">
        <statistic-card title="主机数量" :value="store.hostCount" icon="Monitor" />
      </el-col>
      <el-col :span="12">
        <statistic-card title="当前告警" :value="store.alertCount" icon="Warning" />
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-4">
      <el-col :span="12">
        <alert-trend :data="store.alertTrendData" />
      </el-col>
      <el-col :span="12">
        <severity-chart :data="store.severityData" />
      </el-col>
    </el-row>

    <alert-history class="mt-4" :alerts="store.alerts" />
  </div>
</template>

<script setup lang="ts">
import { useZabbixStore } from '@/stores/zabbix'
import StatisticCard from '@/components/StatisticCard.vue'
import AlertTrend from '@/components/AlertTrend.vue'
import SeverityChart from '@/components/SeverityChart.vue'
import AlertHistory from '@/components/AlertHistory.vue'

const store = useZabbixStore()
</script>

<style scoped>
.dashboard {
  height: 100%;
}

.mt-4 {
  margin-top: 5px;
}
</style> 
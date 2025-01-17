class Charts {
    static initTrendChart(container, data) {
        try {
            if (!window.echarts) {
                console.error('ECharts is not loaded');
                return null;
            }
            const chart = echarts.init(container);
            const option = {
                title: {
                    show: false
                },
                tooltip: {
                    trigger: 'axis',
                    formatter: function(params) {
                        const data = params[0];
                        return `${data.name}<br/>${data.value[1]} 个告警`;
                    }
                },
                grid: {
                    left: '5%',
                    right: '5%',
                    bottom: '10%',
                    top: '10%',
                    containLabel: true
                },
                xAxis: {
                    type: 'time',
                    boundaryGap: false,
                    axisLine: {
                        lineStyle: {
                            color: '#ddd'
                        }
                    },
                    axisLabel: {
                        color: '#666',
                        margin: 12,
                        formatter: function(value) {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getDate()}`;
                        }
                    }
                },
                yAxis: {
                    type: 'value',
                    name: '告警数量',
                    nameTextStyle: {
                        color: '#666',
                        padding: [0, 30, 0, 0]
                    },
                    axisLine: {
                        lineStyle: {
                            color: '#ddd'
                        }
                    },
                    axisLabel: {
                        color: '#666',
                        margin: 16
                    },
                    splitLine: {
                        lineStyle: {
                            color: '#eee'
                        }
                    },
                    minInterval: 1
                },
                series: [{
                    name: '告警数量',
                    type: 'line',
                    smooth: true,
                    data: data,
                    itemStyle: {
                        color: '#1a73e8'
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{
                            offset: 0,
                            color: 'rgba(26,115,232,0.3)'
                        }, {
                            offset: 1,
                            color: 'rgba(26,115,232,0.1)'
                        }])
                    },
                    lineStyle: {
                        width: 2
                    },
                    showSymbol: false,
                    emphasis: {
                        showSymbol: true
                    }
                }]
            };
            chart.setOption(option);
            return chart;
        } catch (error) {
            console.error('Error initializing trend chart:', error);
            return null;
        }
    }

    static initSeverityChart(container, data) {
        try {
            if (!window.echarts) {
                console.error('ECharts is not loaded');
                return null;
            }
            const chart = echarts.init(container);
            const colors = {
                '未分类': '#97A0AF',
                '信息': '#7499FF',
                '警告': '#FFC859',
                '一般严重': '#FFA059',
                '严重': '#E97659',
                '灾难': '#E45959'
            };

            const option = {
                title: {
                    show: false
                },
                tooltip: {
                    trigger: 'item',
                    formatter: '{b}: {c} ({d}%)'
                },
                legend: {
                    orient: 'vertical',
                    right: '5%',
                    top: 'center',
                    textStyle: {
                        color: '#666'
                    }
                },
                series: [{
                    name: '告警等级',
                    type: 'pie',
                    radius: ['40%', '70%'],
                    center: ['40%', '50%'],
                    avoidLabelOverlap: false,
                    itemStyle: {
                        borderRadius: 10,
                        borderColor: '#fff',
                        borderWidth: 2
                    },
                    label: {
                        show: false
                    },
                    emphasis: {
                        label: {
                            show: true,
                            fontSize: '14',
                            fontWeight: 'bold'
                        }
                    },
                    data: data.map(item => ({
                        name: item.name,
                        value: item.value,
                        itemStyle: {
                            color: colors[item.name]
                        }
                    }))
                }]
            };
            chart.setOption(option);
            return chart;
        } catch (error) {
            console.error('Error initializing severity chart:', error);
            return null;
        }
    }

    static handleResize(charts) {
        window.addEventListener('resize', () => {
            Object.values(charts).forEach(chart => {
                chart && chart.resize();
            });
        });
    }
}

// 添加窗口大小改变时的自动调整
window.addEventListener('load', () => {
    const dashboard = document.querySelector('.dashboard');
    if (dashboard) {
        const resizeObserver = new ResizeObserver(() => {
            const charts = window.zabbixDashboard?.charts;
            if (charts) {
                Object.values(charts).forEach(chart => {
                    chart && chart.resize();
                });
            }
        });
        resizeObserver.observe(dashboard);
    }
}); 
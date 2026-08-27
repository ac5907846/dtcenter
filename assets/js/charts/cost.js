import { C, baseOptions } from '../palette.js';

export function renderCostHR(el, q) {
  const chart = echarts.init(el);
  chart.setOption({
    ...baseOptions(),
    title: { text: 'Exit hazards by allocated network cost quartile',
      left: 0, textStyle: { fontSize: 14, fontWeight: 600, color: C.ink } },
    legend: { top: 4, right: 0, textStyle: { fontSize: 11.5 } },
    grid: { left: 52, right: 18, top: 46, bottom: 58 },
    xAxis: { type: 'category', data: q.labels, axisLabel: { fontSize: 10.5, interval: 0 } },
    yAxis: { type: 'value', name: 'hazard ratio vs Q1',
      splitLine: { lineStyle: { color: '#EFEFEA' } } },
    series: [
      { name: 'Withdrawal', type: 'bar', data: q.withdrawal_hr,
        itemStyle: { color: C.claret, borderRadius: [3, 3, 0, 0] }, barGap: '10%' },
      { name: 'Completion', type: 'bar', data: q.completion_hr,
        itemStyle: { color: C.green, borderRadius: [3, 3, 0, 0] } },
      { name: 'parity', type: 'line', data: q.labels.map(() => 1), symbol: 'none',
        lineStyle: { color: C.graph, type: 'dashed', width: 1 }, tooltip: { show: false } },
    ],
  });
  return chart;
}

export function renderCostCompletion(el, q) {
  const chart = echarts.init(el);
  chart.setOption({
    ...baseOptions(),
    title: { text: 'Completed within 3 years of the cost study',
      left: 0, textStyle: { fontSize: 14, fontWeight: 600, color: C.ink } },
    grid: { left: 52, right: 30, top: 46, bottom: 58 },
    xAxis: { type: 'category', data: q.labels, axisLabel: { fontSize: 10.5, interval: 0 } },
    yAxis: { type: 'value', max: 0.35, axisLabel: { formatter: (v) => `${Math.round(v * 100)}%` },
      splitLine: { lineStyle: { color: '#EFEFEA' } } },
    series: [{
      type: 'bar', data: q.completed_3y,
      itemStyle: { color: C.blue, borderRadius: [3, 3, 0, 0] },
      label: { show: true, position: 'top', formatter: (p) => `${Math.round(p.value * 100)}%`,
        color: C.char, fontSize: 12, fontWeight: 600 },
    }],
  });
  return chart;
}

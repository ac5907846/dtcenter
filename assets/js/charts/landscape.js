import { C, TECH_COLORS, baseOptions } from '../palette.js';

export function renderEntries(el, rows) {
  const years = rows.map((r) => r.q_year);
  const techs = ['Solar', 'Gas', 'Battery', 'Wind', 'Hybrid', 'Nuclear', 'Other']
    .filter((t) => rows.some((r) => (r[t] || 0) > 0));
  const chart = echarts.init(el);
  chart.setOption({
    ...baseOptions(),
    title: { text: 'Capacity entering interconnection queues (GW per year)',
      left: 0, textStyle: { fontSize: 14, fontWeight: 600, color: C.ink } },
    legend: { top: 4, right: 0, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 11.5 } },
    xAxis: { type: 'category', data: years, axisLine: { lineStyle: { color: C.silver } } },
    yAxis: { type: 'value', name: 'GW', splitLine: { lineStyle: { color: '#EFEFEA' } } },
    series: techs.map((t) => ({
      name: t, type: 'bar', stack: 'gw', data: rows.map((r) => r[t] || 0),
      itemStyle: { color: TECH_COLORS[t] }, emphasis: { focus: 'series' },
    })),
  });
  return chart;
}

export function renderDuration(el, ser) {
  const chart = echarts.init(el);
  chart.setOption({
    ...baseOptions(),
    title: { text: 'Median request-to-COD among completed projects (years)',
      left: 0, textStyle: { fontSize: 14, fontWeight: 600, color: C.ink } },
    xAxis: { type: 'value', min: 2005, max: 2026, axisLabel: { formatter: (v) => v } },
    yAxis: { type: 'value', name: 'years', splitLine: { lineStyle: { color: '#EFEFEA' } } },
    series: [
      {
        type: 'line', data: ser.years.map((y, i) => [y, ser.median[i]]),
        lineStyle: { color: C.char, width: 2.4 }, itemStyle: { color: C.char },
        symbolSize: 6, symbol: 'circle',
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { color: C.blue, type: 'dashed', width: 1.2 },
          label: { formatter: (p) => ser.breaks[p.dataIndex], color: C.blue, fontSize: 11 },
          data: ser.break_years.map((y) => ({ xAxis: y })),
        },
      },
    ],
  });
  return chart;
}

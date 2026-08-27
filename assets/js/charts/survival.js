import { C, COHORT_COLORS, baseOptions } from '../palette.js';

export function renderCIF(el, cif) {
  const chart = echarts.init(el);
  let current = 'completion';

  function draw() {
    const cohorts = Object.keys(cif.cohorts);
    chart.setOption({
      ...baseOptions(),
      title: {
        text: current === 'completion'
          ? 'Probability of commercial operation by years since request'
          : 'Probability of withdrawal by years since request',
        left: 0, textStyle: { fontSize: 14, fontWeight: 600, color: C.ink },
      },
      legend: { top: 4, right: 0, itemWidth: 14, itemHeight: 3, textStyle: { fontSize: 11.5 } },
      xAxis: { type: 'value', max: 12, name: 'years since request' },
      yAxis: { type: 'value', max: current === 'completion' ? 0.45 : 0.85,
        axisLabel: { formatter: (v) => v.toFixed(1) },
        splitLine: { lineStyle: { color: '#EFEFEA' } } },
      series: cohorts.map((c) => ({
        name: `${c} (n = ${cif.cohorts[c].n.toLocaleString()})`,
        type: 'line', showSymbol: false, smooth: false,
        lineStyle: { color: COHORT_COLORS[c], width: c >= '2018' ? 2.8 : 1.8 },
        itemStyle: { color: COHORT_COLORS[c] },
        data: cif.grid.map((t, i) => [t, cif.cohorts[c][current][i]]),
        connectNulls: false,
      })),
    }, true);
  }

  draw();
  document.querySelectorAll('#event-toggle .toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#event-toggle .toggle').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      current = btn.dataset.event;
      draw();
    });
  });
  return chart;
}

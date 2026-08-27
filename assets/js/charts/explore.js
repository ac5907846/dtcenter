import { C, baseOptions } from '../palette.js';

const OUTCOME = { 0: 'Still active', 1: 'Commercial operation', 2: 'Withdrawn' };
const OUTCOL = { 'Still active': C.silver, 'Commercial operation': C.green, Withdrawn: C.claret };

export function initExplore(projects) {
  const regions = [...new Set(projects.map((p) => p.region))].sort();
  const techs = [...new Set(projects.map((p) => p.tech))].sort();
  const selR = document.getElementById('ex-region');
  const selT = document.getElementById('ex-tech');
  selR.innerHTML = ['All regions', ...regions].map((r) => `<option>${r}</option>`).join('');
  selT.innerHTML = ['All technologies', ...techs].map((t) => `<option>${t}</option>`).join('');
  selR.value = 'All regions';
  selT.value = 'All technologies';

  const hist = echarts.init(document.getElementById('chart-ex-hist'));
  const donut = echarts.init(document.getElementById('chart-ex-outcome'));

  function draw() {
    const r = selR.value; const t = selT.value;
    const sub = projects.filter((p) =>
      (r === 'All regions' || p.region === r) && (t === 'All technologies' || p.tech === t));
    const done = sub.filter((p) => p.event === 1);

    // duration histogram of completed projects
    const bins = Array.from({ length: 24 }, (_, i) => i * 0.5);
    const counts = bins.map((b) => done.filter((p) => p.T_years >= b && p.T_years < b + 0.5).length);
    hist.setOption({
      ...baseOptions(),
      title: { text: `Realized request-to-COD, completed projects (n = ${done.length.toLocaleString()})`,
        left: 0, textStyle: { fontSize: 13.5, fontWeight: 600, color: C.ink } },
      xAxis: { type: 'category', data: bins.map((b) => b.toFixed(1)),
        name: 'years', axisLabel: { interval: 3 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#EFEFEA' } } },
      series: [{ type: 'bar', data: counts, barCategoryGap: '12%',
        itemStyle: { color: C.blue, opacity: 0.85 } }],
    }, true);

    const byOutcome = [0, 1, 2].map((e) => ({
      name: OUTCOME[e],
      value: sub.filter((p) => p.event === e).length,
    }));
    donut.setOption({
      textStyle: { fontFamily: 'Inter, sans-serif' },
      title: { text: `How ${sub.length.toLocaleString()} requests ended`,
        left: 0, textStyle: { fontSize: 13.5, fontWeight: 600, color: C.ink } },
      tooltip: { trigger: 'item', backgroundColor: '#fff', borderColor: '#E4E4DE',
        textStyle: { color: C.ink } },
      series: [{
        type: 'pie', radius: ['42%', '68%'], center: ['50%', '56%'],
        data: byOutcome.map((o) => ({ ...o, itemStyle: { color: OUTCOL[o.name] } })),
        label: { formatter: (p) => `${p.name}\n${(p.percent).toFixed(0)}%`,
          fontSize: 11.5, color: C.char },
      }],
    }, true);
  }

  selR.addEventListener('change', draw);
  selT.addEventListener('change', draw);
  draw();
  return [hist, donut];
}

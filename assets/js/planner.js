import { C, baseOptions } from './palette.js';

// Delivery risk planner. Looks up and interpolates the ensemble planning grid
// (data/planning_table.csv): 9 regions x 5 technologies x sizes {50,100,200,
// 400,800} MW x entry years 2020-2025, with 90 percent ensemble intervals.

const SIZES = [50, 100, 200, 400, 800];
const MW_MIN = Math.log(50), MW_MAX = Math.log(800);

function sliderToMW(v) { return Math.round(Math.exp(MW_MIN + (v / 100) * (MW_MAX - MW_MIN))); }

function interp(grid, region, tech, year, mw) {
  const rows = grid.filter((r) => r.region === region && r.tech === tech && r.entry_year === year);
  if (!rows.length) return null;
  const byMW = Object.fromEntries(rows.map((r) => [r.mw, r]));
  const logmw = Math.log(mw);
  let lo = SIZES[0], hi = SIZES[SIZES.length - 1];
  for (const s of SIZES) { if (s <= mw) lo = s; }
  for (const s of [...SIZES].reverse()) { if (s >= mw) hi = s; }
  const a = byMW[lo], b = byMW[hi];
  if (!a || !b) return null;
  const w = hi === lo ? 0 : (logmw - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  const mix = (k) => a[k] + w * (b[k] - a[k]);
  const out = {};
  ['p_cod_3y_mean', 'p_cod_3y_lo90', 'p_cod_3y_hi90',
   'p_cod_5y_mean', 'p_cod_5y_lo90', 'p_cod_5y_hi90',
   'p_cod_7y_mean', 'p_cod_7y_lo90', 'p_cod_7y_hi90',
   'p_withdrawn_5y_mean'].forEach((k) => { out[k] = mix(k); });
  return out;
}

const pct = (v) => `${(v * 100).toFixed(1)}%`;

export function initPlanner(grid) {
  const regions = [...new Set(grid.map((r) => r.region))].sort();
  const techs = [...new Set(grid.map((r) => r.tech))].sort();
  const years = [...new Set(grid.map((r) => r.entry_year))].sort();

  const selR = document.getElementById('pl-region');
  const selT = document.getElementById('pl-tech');
  const selY = document.getElementById('pl-year');
  const mwIn = document.getElementById('pl-mw');
  const mwVal = document.getElementById('pl-mw-val');
  selR.innerHTML = regions.map((r) => `<option>${r}</option>`).join('');
  selT.innerHTML = techs.map((t) => `<option>${t}</option>`).join('');
  selY.innerHTML = years.map((y) => `<option>${y}</option>`).join('');
  selR.value = 'ERCOT'; selT.value = 'Gas'; selY.value = String(Math.max(...years));

  const curve = echarts.init(document.getElementById('chart-pl-curve'));
  const compare = echarts.init(document.getElementById('chart-pl-compare'));

  function draw() {
    const region = selR.value, tech = selT.value, year = +selY.value;
    const mw = sliderToMW(+mwIn.value);
    mwVal.textContent = `${mw} MW`;
    const p = interp(grid, region, tech, year, mw);
    if (!p) return;

    // stat tiles
    const tiles = [
      { lab: 'P(operating within 3 y)', v: p.p_cod_3y_mean, lo: p.p_cod_3y_lo90, hi: p.p_cod_3y_hi90 },
      { lab: 'P(operating within 5 y)', v: p.p_cod_5y_mean, lo: p.p_cod_5y_lo90, hi: p.p_cod_5y_hi90 },
      { lab: 'P(operating within 7 y)', v: p.p_cod_7y_mean, lo: p.p_cod_7y_lo90, hi: p.p_cod_7y_hi90 },
      { lab: 'P(withdrawn within 5 y)', v: p.p_withdrawn_5y_mean, bad: true },
    ];
    document.getElementById('pl-stats').innerHTML = tiles.map((t) => `
      <div class="stat">
        <div class="num ${t.bad ? 'bad' : (t.v >= 0.15 ? 'good' : '')}">${pct(t.v)}</div>
        <div class="lab">${t.lab}${t.lo !== undefined
          ? `<br>90% band ${pct(t.lo)} to ${pct(t.hi)}` : ''}</div>
      </div>`).join('');

    // curve panel: this combo across horizons with band
    const hz = [3, 5, 7];
    curve.setOption({
      ...baseOptions(),
      title: { text: `${mw} MW ${tech}, ${region}, entering ${year}`,
        left: 0, textStyle: { fontSize: 13.5, fontWeight: 600, color: C.ink } },
      xAxis: { type: 'category', data: hz.map((h) => `${h} yr`), name: 'horizon' },
      yAxis: { type: 'value', axisLabel: { formatter: (v) => `${Math.round(v * 100)}%` },
        splitLine: { lineStyle: { color: '#EFEFEA' } } },
      series: [
        { name: 'lower', type: 'line', stack: 'band', symbol: 'none',
          data: hz.map((h) => p[`p_cod_${h}y_lo90`]), lineStyle: { opacity: 0 }, tooltip: { show: false } },
        { name: '90% band', type: 'line', stack: 'band', symbol: 'none',
          data: hz.map((h) => p[`p_cod_${h}y_hi90`] - p[`p_cod_${h}y_lo90`]),
          lineStyle: { opacity: 0 }, areaStyle: { color: C.blue, opacity: 0.14 }, tooltip: { show: false } },
        { name: 'P(commercial operation)', type: 'line',
          data: hz.map((h) => p[`p_cod_${h}y_mean`]),
          lineStyle: { color: C.blue, width: 2.6 }, itemStyle: { color: C.blue }, symbolSize: 7 },
      ],
    }, true);

    // compare panel: same tech/size/year across all regions at 5y
    const comps = regions.map((r) => ({ r, p: interp(grid, r, tech, year, mw) }))
      .filter((x) => x.p).sort((a, b) => a.p.p_cod_5y_mean - b.p.p_cod_5y_mean);
    compare.setOption({
      ...baseOptions(),
      title: { text: `Same project across regions, P(operating within 5 y)`,
        left: 0, textStyle: { fontSize: 13.5, fontWeight: 600, color: C.ink } },
      grid: { left: 86, right: 30, top: 42, bottom: 30 },
      xAxis: { type: 'value', axisLabel: { formatter: (v) => `${Math.round(v * 100)}%` },
        splitLine: { lineStyle: { color: '#EFEFEA' } } },
      yAxis: { type: 'category', data: comps.map((x) => x.r), axisLabel: { fontSize: 11 } },
      series: [{
        type: 'bar', data: comps.map((x) => ({
          value: x.p.p_cod_5y_mean,
          itemStyle: { color: x.r === region ? C.blue : C.mist,
            borderRadius: [0, 3, 3, 0] },
        })),
        label: { show: true, position: 'right', formatter: (q) => pct(q.value),
          fontSize: 10.5, color: C.graph },
      }],
    }, true);

    // reading
    const ratio = comps.length > 1
      ? (comps[comps.length - 1].p.p_cod_5y_mean / Math.max(p.p_cod_5y_mean, 1e-4)) : 1;
    const best = comps[comps.length - 1];
    document.getElementById('pl-read').innerHTML =
      `Under 2000 to 2025 conditions, a ${mw} MW ${tech.toLowerCase()} request entering the ` +
      `${region} queue in ${year} reaches commercial operation within five years with probability ` +
      `<b>${pct(p.p_cod_5y_mean)}</b> and is withdrawn with probability <b>${pct(p.p_withdrawn_5y_mean)}</b>. ` +
      (best.r !== region
        ? `The same project in ${best.r} scores ${pct(best.p.p_cod_5y_mean)}, a factor of ${ratio.toFixed(1)}. `
        : `This is the strongest region in the grid for this configuration. `) +
      `Because withdrawal is driven by cost allocations that are unknowable at entry, contingency is ` +
      `better held as parallel queue positions than as schedule float.`;
  }

  [selR, selT, selY].forEach((s) => s.addEventListener('change', draw));
  mwIn.addEventListener('input', draw);
  draw();
  return [curve, compare];
}

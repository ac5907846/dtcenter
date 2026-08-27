import { C, SLATE_RAMP } from '../palette.js';

export function renderMap(el, statesGeo, stateWaits, facilities) {
  echarts.registerMap('USA', statesGeo);
  const waits = stateWaits.map((s) => [s.state, s.wait, s.n_active, s.gw_active]);
  const chart = echarts.init(el);
  chart.setOption({
    title: { text: 'Data center facilities over median queue wait by state',
      left: 0, textStyle: { fontSize: 14, fontWeight: 600, color: C.ink } },
    tooltip: { backgroundColor: '#fff', borderColor: '#E4E4DE',
      textStyle: { color: C.ink, fontSize: 12 } },
    geo: {
      map: 'USA', roam: false, top: 42, bottom: 10,
      itemStyle: { borderColor: '#fff', borderWidth: 0.8 },
      emphasis: { itemStyle: { areaColor: '#D8E0E8' }, label: { show: false } },
    },
    visualMap: {
      min: 1.5, max: 5.2, text: ['5+ yr', '1.5 yr'], calculable: false,
      inRange: { color: SLATE_RAMP }, right: 0, bottom: 30,
      textStyle: { fontSize: 11, color: C.graph },
      formatter: (v) => `${v.toFixed(1)} yr`,
    },
    series: [
      {
        name: 'Median wait (active projects)', type: 'map', geoIndex: 0, map: 'USA',
        data: stateWaits.map((s) => ({ name: s.state, value: s.wait,
          n: s.n_active, gw: s.gw_active })),
        tooltip: { formatter: (p) => p.data && p.data.n
          ? `<b>${p.name}</b><br>median wait: ${p.value} yr<br>active projects: ${p.data.n}<br>active capacity: ${p.data.gw} GW`
          : `<b>${p.name}</b><br>fewer than 30 active projects` },
      },
      {
        name: 'Data center facility', type: 'scatter', coordinateSystem: 'geo',
        data: facilities.map((f) => ({
          value: [f.lon, f.lat, f.sqft],
          op: f.operator || 'n.a.', ty: f.type,
        })),
        symbolSize: (v) => 3 + 9 * Math.sqrt(Math.min(v[2], 4e6) / 4e6),
        itemStyle: { color: '#6FB265', opacity: 0.85,
          borderColor: '#FFFFFF', borderWidth: 0.6 },
        tooltip: { formatter: (p) =>
          `<b>${p.data.op}</b> (${p.data.ty})<br>${Math.round(p.value[2]).toLocaleString()} sq ft` },
        zlevel: 2,
      },
    ],
  });
  return chart;
}

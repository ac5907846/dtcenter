import { loadJSON, loadCSV } from './data.js';
import { renderEntries, renderDuration } from './charts/landscape.js';
import { renderCIF } from './charts/survival.js';
import { renderMap } from './charts/map.js';
import { renderCostHR, renderCostCompletion } from './charts/cost.js';
import { initExplore } from './charts/explore.js';
import { initPlanner } from './planner.js';

function heroStats(h) {
  const items = [
    { num: h.projects.toLocaleString(), lab: 'interconnection requests, 2000-2025' },
    { num: `${Math.round(h.p5y_late * 100)}%`, lab: '5-year completion probability, 2018-20 entrants', cls: 'bad' },
    { num: `${h.dur_2025} yr`, lab: 'median successful connection, 2025', cls: 'bad' },
    { num: `${h.gw_active.toLocaleString()} GW`, lab: 'capacity waiting in queues today' },
    { num: h.facilities.toLocaleString(), lab: 'data center facilities mapped', cls: 'good' },
  ];
  document.getElementById('hero-stats').innerHTML = items.map((s) => `
    <div class="stat"><div class="num ${s.cls || ''}">${s.num}</div>
    <div class="lab">${s.lab}</div></div>`).join('');
}

async function boot() {
  const charts = [];
  const [headline, entries, duration] = await Promise.all([
    loadJSON('headline.json'), loadJSON('entries_by_tech.json'), loadJSON('duration_series.json'),
  ]);
  heroStats(headline);
  charts.push(renderEntries(document.getElementById('chart-entries'), entries));
  charts.push(renderDuration(document.getElementById('chart-duration'), duration));

  const cif = await loadJSON('cif_by_cohort.json');
  charts.push(renderCIF(document.getElementById('chart-cif'), cif));

  const [statesGeo, stateWaits, facilities] = await Promise.all([
    loadJSON('us_states.geojson'), loadJSON('state_waits.json'), loadCSV('facilities.csv'),
  ]);
  charts.push(renderMap(document.getElementById('chart-map'), statesGeo, stateWaits, facilities));

  const cost = await loadJSON('cost_summary.json');
  charts.push(renderCostHR(document.getElementById('chart-cost-hr'), cost.quartiles));
  charts.push(renderCostCompletion(document.getElementById('chart-cost-comp'), cost.quartiles));

  const [projects, grid] = await Promise.all([
    loadCSV('projects_slim.csv'), loadCSV('planning_table.csv'),
  ]);
  charts.push(...initExplore(projects));
  charts.push(...initPlanner(grid));

  window.addEventListener('resize', () => charts.forEach((c) => c && c.resize()));
}

boot().catch((e) => {
  console.error(e);
  document.querySelector('main').insertAdjacentHTML('afterbegin',
    `<p style="max-width:720px;margin:24px auto;color:#7A2E37">
     Data failed to load (${e.message}). If you opened index.html directly from disk,
     serve the folder instead: <code>python -m http.server</code> then open
     http://localhost:8000.</p>`);
});

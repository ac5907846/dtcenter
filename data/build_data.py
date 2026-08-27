"""Regenerates every data file the web app loads. Run from this folder:

    python build_data.py

Reads the analysis dataset and derived outputs in ../../01_data and
../../02_analysis, and writes compact CSV/JSON files next to itself. The app
never reads outside its own data folder, so this script is the only bridge
between the research pipeline and the site. planning_table.csv comes from the
GPU ensemble run (A10 gpu_outputs) and is copied, not derived, here.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
DATA = HERE.parents[1] / '01_data'
d = pd.read_pickle(DATA / 'analysis_dataset.pkl')

# 1. slim project-level file for client-side interaction (one row per project)
slim = d[['q_year', 'region', 'tech', 'mw', 'event', 'T_years', 'state', 'dc_market']].copy()
slim['mw'] = slim['mw'].round(1)
slim['T_years'] = slim['T_years'].round(3)
slim.to_csv(HERE / 'projects_slim.csv', index=False)

# 2. entries by year and technology (GW)
piv = (d.pivot_table(index='q_year', columns='tech', values='mw', aggfunc='sum') / 1000
       ).round(2).fillna(0)
piv = piv.loc[2000:2025]
piv.reset_index().to_json(HERE / 'entries_by_tech.json', orient='records')

# 3. realized duration series and breaks
comp = d[d['event'] == 1].copy()
comp['cod_year'] = comp['end_date'].dt.year
ser = comp.groupby('cod_year')['T_years'].median().loc[2005:2025].round(2)
json.dump({'years': ser.index.tolist(), 'median': ser.values.tolist(),
           'breaks': ['2008Q3', '2013Q3', '2021Q1'], 'break_years': [2008.5, 2013.5, 2021.0]},
          open(HERE / 'duration_series.json', 'w'))

# 4. Aalen-Johansen CIF by cohort, both events, truncated at 100 at risk
from lifelines import AalenJohansenFitter
cohorts = ['2000-07', '2008-13', '2014-17', '2018-20', '2021-22', '2023-25']
out = {}
grid = np.arange(0.25, 12.01, 0.25)
for c in cohorts:
    g = d[d['cohort'] == c]
    n0 = len(g)
    # risk-set truncation time: last t with >=100 at risk
    at_risk = [(g['T_years'] >= t).sum() for t in grid]
    tmax = float(grid[np.searchsorted(-np.array(at_risk), -100) - 1]) if min(at_risk) < 100 else 12.0
    entry = {'n': int(n0), 'tmax': round(tmax, 2)}
    for ev, key in [(1, 'completion'), (2, 'withdrawal')]:
        aj = AalenJohansenFitter(calculate_variance=False)
        aj.fit(g['T_years'], g['event'], event_of_interest=ev)
        cif = aj.cumulative_density_
        vals = np.interp(grid, cif.index.values, cif.iloc[:, 0].values,
                         left=0, right=cif.iloc[-1, 0])
        vals = np.where(grid <= tmax, vals, np.nan)
        entry[key] = [None if np.isnan(v) else round(float(v), 4) for v in vals]
    out[c] = entry
json.dump({'grid': [round(float(t), 2) for t in grid], 'cohorts': out},
          open(HERE / 'cif_by_cohort.json', 'w'))

# 5. state map data: median elapsed wait of active projects + totals
act = d[d['event'] == 0]
st = pd.DataFrame({
    'wait': act.groupby('state')['T_years'].median().round(2),
    'n_active': act.groupby('state').size(),
    'gw_active': (act.groupby('state')['mw'].sum() / 1000).round(1),
})
st = st[st['n_active'] >= 30].reset_index()
st.to_json(HERE / 'state_waits.json', orient='records')

# 6. facilities (IM3 atlas, slim)
atlas = pd.read_csv(DATA / 'im3_atlas' / 'im3_open_source_data_center_atlas_v2026.02.09.csv')
fac = atlas[['lon', 'lat', 'sqft', 'state_abb', 'operator', 'type']].copy()
fac['sqft'] = fac['sqft'].fillna(fac['sqft'].median()).round(0)
fac.to_csv(HERE / 'facilities.csv', index=False)

# 7. US states geojson (dissolved from the county file, simplified)
import geopandas as gpd
gj = json.load(open(DATA / 'us_counties.geojson'))
cty = gpd.GeoDataFrame.from_features(gj['features'])
cty['fips'] = [f['id'] for f in gj['features']]
cty = cty.set_crs('EPSG:4326')
cty['state_fips'] = cty['fips'].str[:2]
conus = cty[~cty['state_fips'].isin(['02', '15', '60', '66', '69', '72', '78'])]
states = conus.dissolve(by='state_fips', as_index=False)
F2A = {'01':'AL','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC',
       '12':'FL','13':'GA','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY',
       '22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO',
       '30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC',
       '38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
       '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY'}
states['name'] = states['state_fips'].map(F2A)
states['geometry'] = states['geometry'].simplify(0.02)
states[['name', 'geometry']].to_file(HERE / 'us_states.geojson', driver='GeoJSON')

# 8. cost mechanism summary
cost = pd.read_csv(HERE.parents[1] / '02_analysis' / 'A11_cost_mechanism (fig8)' / 'cost_merge.csv')
lab = {0: 'Active', 1: 'Completed', 2: 'Withdrawn'}
cost['outcome'] = cost['event'].map(lab)
by = cost.groupby('outcome').agg(n=('net_kw', 'size'),
                                 med_net=('net_kw', 'median'),
                                 med_tot=('tot_kw', 'median')).round(1)
quart = {
    'labels': ['Q1 (cheapest)', 'Q2', 'Q3', 'Q4 (most expensive)'],
    'withdrawal_hr': [1.0, 1.036, 1.281, 2.880],
    'completion_hr': [1.0, 0.766, 0.729, 0.560],
    'completed_3y': [0.313, 0.198, 0.130, 0.057],
}
json.dump({'by_outcome': by.reset_index().to_dict(orient='records'), 'quartiles': quart},
          open(HERE / 'cost_summary.json', 'w'))

# 9. headline numbers
json.dump({
    'projects': int(len(d)),
    'p5y_early': 0.262, 'p5y_late': 0.065,
    'dur_2005': 1.43, 'dur_2025': 5.62,
    'gw_active': round(d[d['event'] == 0]['mw'].sum() / 1000),
    'gw_withdrawn_2018': round(d[(d['event'] == 2) & (d['wd_date'] >= '2018-01-01')]['mw'].sum() / 1000),
    'per_year_decline': 6.7, 'break_quarter': '2021Q1', 'break_p': 0.0085,
    'facilities': int(len(fac)),
}, open(HERE / 'headline.json', 'w'))

for f in sorted(HERE.glob('*')):
    if f.is_file() and f.name != 'build_data.py':
        print(f'{f.name:26} {f.stat().st_size/1024:8.0f} KB')

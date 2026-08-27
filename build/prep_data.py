"""Prepare all embedded data for the single-file web app."""
import json, warnings, base64
warnings.filterwarnings('ignore')
import numpy as np, pandas as pd
from lifelines import AalenJohansenFitter

from pathlib import Path as _P
P = str(_P(__file__).resolve().parents[2])  # paper folder
d = pd.read_pickle(f'{P}/01_data/analysis_dataset.pkl')
CENSOR = pd.Timestamp('2025-12-31')
OUT = {}

# ---------- headline ----------
comp = d[d['event'] == 1].copy()
comp['cod_year'] = comp['end_date'].dt.year
OUT['headline'] = {
    'n': int(len(d)), 'medDur2025': 5.62, 'p5_1820': 0.065, 'p5_0007': 0.262,
    'perYear': 6.7, 'q4hr': 2.88, 'medDur2005': 1.43,
    'gw2025': 513.6, 'gas2025': 151.0, 'active': int((d['event'] == 0).sum()),
    'withdrawn': int((d['event'] == 2).sum()), 'completed': int((d['event'] == 1).sum()),
}

# ---------- entries by tech ----------
TECHS = ['Solar', 'Battery', 'Hybrid', 'Wind', 'Gas', 'Nuclear', 'Other']
piv = (d[d['q_year'] >= 2010].pivot_table(index='q_year', columns='tech', values='mw',
       aggfunc='sum').fillna(0) / 1000).round(1)
OUT['entries'] = {'years': [int(y) for y in piv.index],
                  'series': {t: [float(v) for v in piv[t]] for t in TECHS if t in piv}}

# ---------- duration series + segments ----------
comp['cod_q'] = comp['end_date'].dt.to_period('Q')
qs = comp.groupby('cod_q')['T_years'].median()
qs = qs[(qs.index >= pd.Period('2005Q1')) & (qs.index <= pd.Period('2025Q4'))]
y = qs.values.astype(float)
def dp_breaks(y, k=3, min_size=2):
    n = len(y); c1 = np.concatenate([[0], np.cumsum(y)]); c2 = np.concatenate([[0], np.cumsum(y**2)])
    def sse(s, e):
        if e <= s: return 0.0
        m = (c1[e]-c1[s])/(e-s); return (c2[e]-c2[s]) - (e-s)*m*m
    INF = 1e18; D = np.full((k+2, n+1), INF); arg = np.zeros((k+2, n+1), int)
    for e in range(min_size, n+1): D[1][e] = sse(0, e)
    for j in range(2, k+2):
        for e in range(j*min_size, n+1):
            best, ba = INF, 0
            for s in range((j-1)*min_size, e-min_size+1):
                v = D[j-1][s] + sse(s, e)
                if v < best: best, ba = v, s
            D[j][e], arg[j][e] = best, ba
    bks, e = [], n
    for j in range(k+1, 1, -1):
        s = arg[j][e]; bks.append(s); e = s
    return sorted(bks)
bks = dp_breaks(y)
edges = [0] + bks + [len(y)]
segs = [{'x0': 2005 + edges[i]/4, 'x1': 2005 + edges[i+1]/4,
         'mean': round(float(y[edges[i]:edges[i+1]].mean()), 2)} for i in range(len(edges)-1)]
ann = comp[comp['cod_year'].between(2005, 2025)].groupby('cod_year')['T_years']
OUT['duration'] = {
    'years': [int(v) for v in ann.median().index],
    'median': [round(float(v), 2) for v in ann.median()],
    'q25': [round(float(v), 2) for v in ann.quantile(.25)],
    'q75': [round(float(v), 2) for v in ann.quantile(.75)],
    'n': [int(v) for v in ann.size()],
    'segments': segs,
    'breaks': [str(qs.index[b]) for b in bks],
}

# ---------- CIF curves ----------
COH = ['2000-07', '2008-13', '2014-17', '2018-20', '2021-22', '2023-25']
MIN_AT_RISK = 100
def max_h(g):
    ts = np.sort(g['T_years'].values)[::-1]
    return float(ts[MIN_AT_RISK-1]) if len(ts) >= MIN_AT_RISK else float(ts[-1])
cif = {}
for coh in COH:
    g = d[d['cohort'] == coh]
    hmax = min(max_h(g), 10.0)
    entry = {'n': int(len(g)), 'hmax': round(hmax, 2)}
    for ev, key in [(1, 'cod'), (2, 'wd')]:
        aj = AalenJohansenFitter(calculate_variance=False)
        aj.fit(g['T_years'], g['event'], event_of_interest=ev)
        c = aj.cumulative_density_
        x = c.index.values; v = c.values.ravel()
        keep = x <= hmax
        x, v = x[keep], v[keep]
        # decimate to ~70 points
        idx = np.unique(np.linspace(0, len(x)-1, 70).astype(int))
        entry[key] = [[round(float(a), 2), round(float(b), 4)] for a, b in zip(x[idx], v[idx])]
    cif[coh] = entry
OUT['cif'] = cif

# ---------- geography ----------
act = d[d['event'] == 0].copy()
act['wait'] = (CENSOR - act['q_date']).dt.days / 365.25
stt = act.groupby('state').agg(wait=('wait', 'median'), n=('wait', 'size'),
                               gw=('mw', lambda s: s.sum()/1000))
compst = comp.groupby('state')['T_years'].median()
states = {}
for s, r in stt.iterrows():
    states[s] = {'wait': round(float(r['wait']), 1) if r['n'] >= 30 else None,
                 'n': int(r['n']), 'gw': round(float(r['gw']), 1),
                 'medDur': round(float(compst.get(s, np.nan)), 1) if s in compst and not np.isnan(compst.get(s, np.nan)) else None}
OUT['states'] = states

# region wait distribution summary (for a small multiple)
regs = {}
for rg, g in act.groupby('region'):
    w = g['wait']
    regs[rg] = {'med': round(float(w.median()), 1), 'q25': round(float(w.quantile(.25)), 1),
                'q75': round(float(w.quantile(.75)), 1), 'n': int(len(w))}
OUT['regionWaits'] = regs

# ---------- map geometry (Albers -> viewBox 960x600) ----------
def albers(lon, lat, lon0=-96.0, lat0=23.0, p1=29.5, p2=45.5):
    lon, lat = np.radians(np.asarray(lon, float)), np.radians(np.asarray(lat, float))
    lon0, lat0, p1, p2 = map(np.radians, (lon0, lat0, p1, p2))
    n = (np.sin(p1) + np.sin(p2)) / 2
    Cc = np.cos(p1)**2 + 2*n*np.sin(p1)
    rho = np.sqrt(Cc - 2*n*np.sin(lat)) / n
    rho0 = np.sqrt(Cc - 2*n*np.sin(lat0)) / n
    th = n * (lon - lon0)
    return rho*np.sin(th), rho0 - rho*np.cos(th)

gj = json.load(open(f'{P}/01_data/us_counties.geojson'))
NON = {'02', '15', '60', '66', '69', '72', '78'}
FIPS2ST = {'01':'AL','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY'}
allx, ally = [], []
polys = []   # (state, [ (x,y)... ])
for f in gj['features']:
    fips = f['id']
    if fips[:2] in NON: continue
    geom = f['geometry']
    ringsets = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    for rs in ringsets:
        outer = rs[0]
        x, yv = albers([p[0] for p in outer], [p[1] for p in outer])
        polys.append((FIPS2ST[fips[:2]], np.column_stack([x, yv])))
        allx += [x.min(), x.max()]; ally += [yv.min(), yv.max()]
xmin, xmax = min(allx), max(allx); ymin, ymax = min(ally), max(ally)
W, H = 960, 600
sc = min(W/(xmax-xmin), H/(ymax-ymin)) * 0.97
def tx(p):
    return ((p[:, 0]-xmin)*sc + (W-(xmax-xmin)*sc)/2, (ymax-p[:, 1])*sc + (H-(ymax-ymin)*sc)/2)

# state paths: union of county polygons per state rendered as one path (fill-rule works since outers only)
from collections import defaultdict
state_paths = defaultdict(list)
edge_map = defaultdict(list)
for st, p in polys:
    x, yv = tx(p)
    q = np.round(np.column_stack([x, yv]), 1)
    for i in range(len(q)-1):
        a, b = tuple(q[i]), tuple(q[i+1])
        key = (a, b) if a <= b else (b, a)
        edge_map[key].append(st)
# state boundary segments (outer or inter-state)
segs = []
for (a, b), sts in edge_map.items():
    if len(sts) == 1 or len(set(sts)) > 1:
        segs.append((a, b))
# chain segments into polylines for compact paths
adj = defaultdict(list)
for a, b in segs:
    adj[a].append(b); adj[b].append(a)
used = set()
paths = []
for a, b in segs:
    if (a, b) in used or (b, a) in used: continue
    line = [a, b]; used.add((a, b))
    # extend forward
    while True:
        last = line[-1]; prev = line[-2]
        nxt = [n for n in adj[last] if n != prev and (last, n) not in used and (n, last) not in used]
        if not nxt: break
        line.append(nxt[0]); used.add((last, nxt[0]))
    while True:
        first = line[0]; second = line[1]
        nxt = [n for n in adj[first] if n != second and (first, n) not in used and (n, first) not in used]
        if not nxt: break
        line.insert(0, nxt[0]); used.add((first, nxt[0]))
    paths.append(line)
def path_str(line):
    return 'M' + 'L'.join(f'{p[0]:.0f} {p[1]:.0f}' for p in line)
OUT['mapBorders'] = [path_str(l) for l in paths if len(l) > 2]

# state fill polygons: per-state merged county fills (draw all county polys with state class)
state_polys = defaultdict(list)
for st, p in polys:
    x, yv = tx(p)
    q = np.column_stack([x, yv])
    idx = np.unique(np.linspace(0, len(q)-1, max(4, min(len(q), 60))).astype(int))
    q = q[idx]
    state_polys[st].append('M' + 'L'.join(f'{a:.0f} {b:.0f}' for a, b in q) + 'Z')
OUT['mapStates'] = {st: ''.join(ps) for st, ps in state_polys.items()}

atlas = pd.read_csv(f'{P}/01_data/im3_atlas/im3_open_source_data_center_atlas_v2026.02.09.csv')
atlas = atlas[atlas['state_abb'].isin(FIPS2ST.values())]
fx, fy = albers(atlas['lon'].values, atlas['lat'].values)
q = np.column_stack(tx(np.column_stack([fx, fy])))
sq = atlas['sqft'].fillna(atlas['sqft'].median()).clip(2e4, 4e6)
rr = 1.2 + 5.0*np.sqrt((sq - sq.min())/(sq.max()-sq.min()))
OUT['facilities'] = [[round(float(a), 1), round(float(b), 1), round(float(r), 1)]
                     for (a, b), r in zip(q, rr)]

# ---------- cost ----------
OUT['cost'] = {
    'quartiles': [
        {'q': 'Q2 vs Q1', 'wd': [1.036, 0.879, 1.220], 'cod': [0.766, 0.631, 0.929]},
        {'q': 'Q3 vs Q1', 'wd': [1.281, 1.097, 1.496], 'cod': [0.729, 0.591, 0.899]},
        {'q': 'Q4 vs Q1', 'wd': [2.880, 2.499, 3.319], 'cod': [0.560, 0.428, 0.732]}],
    'outcomes': {'Completed': 3.1, 'Active': 32.9, 'Withdrawn': 59.9},
    'within3y': {'Q1': [0.313, 0.330], 'Q2': [0.198, 0.275], 'Q3': [0.130, 0.309], 'Q4': [0.057, 0.569]},
    'matched': 3544, 'landmark': 3247,
}
mg = pd.read_csv(f'{P}/02_analysis/A11_cost_mechanism (fig8)/cost_merge.csv')
mg['study_date'] = pd.to_datetime(mg['study_date'], errors='coerce', format='mixed')
sy = mg.dropna(subset=['study_date']).copy()
sy['yr'] = sy['study_date'].dt.year
esc = sy[sy['yr'].between(2005, 2024)].groupby('yr')['net_kw'].median().round(1)
OUT['cost']['escalation'] = {'years': [int(a) for a in esc.index], 'med': [float(v) for v in esc.values]}

# ---------- planner grid ----------
npz = np.load(f'{P}/02_analysis/A10_deep_survival (fig6)/np_outputs/planning_curves.npz', allow_pickle=True)
cuts = npz['cuts']; rows = [str(r) for r in npz['rows']]
mean1, lo1, hi1, mean2 = npz['mean1'], npz['lo1'], npz['hi1'], npz['mean2']
qz = lambda M: base64.b64encode(np.clip(np.round(M*250), 0, 250).astype(np.uint8).tobytes()).decode()
OUT['planner'] = {
    'cuts': [round(float(c), 2) for c in cuts],
    'rows': rows,
    'regions': ['CAISO', 'ERCOT', 'ISO-NE', 'MISO', 'NYISO', 'PJM', 'SPP', 'Southeast', 'West'],
    'techs': ['Solar', 'Wind', 'Battery', 'Hybrid', 'Gas'],
    'years': [2020, 2021, 2022, 2023, 2024, 2025],
    'sizes': ['<20 MW', '20-100 MW', '100-300 MW', '300-1000 MW', '>1000 MW'],
    'sizeMW': [10, 50, 200, 650, 1500],
    'mean1': qz(mean1), 'lo1': qz(lo1), 'hi1': qz(hi1), 'mean2': qz(mean2),
    'K': int(mean1.shape[1]),
}
fit = json.load(open(f'{P}/02_analysis/A10_deep_survival (fig6)/np_outputs/ensemble_fit.json'))
OUT['planner']['ctd'] = round(fit['ensemble_ctd_completion'], 2)
OUT['planner']['ci'] = [round(v, 3) for v in fit['boot90']]

# empirical CIF by region+tech for planner "history" comparison (entries 2010-2018, 5y)
def cif5(g, h=5, m=25):
    ts = np.sort(g['T_years'].values)[::-1]
    if len(ts) < m or ts[m-1] < h: return None
    aj = AalenJohansenFitter(calculate_variance=False)
    aj.fit(g['T_years'], g['event'], event_of_interest=1)
    c = aj.cumulative_density_
    idx = c.index[c.index <= h]
    return round(float(c.loc[idx[-1]].iloc[0]), 3) if len(idx) else None
hist = {}
panel = d[d['q_year'].between(2010, 2018)]
for (rg, tc), g in panel.groupby(['region', 'tech'], observed=True):
    if len(g) >= 50:
        v = cif5(g)
        if v is not None: hist[f'{rg}|{tc}'] = v
OUT['history5y'] = hist

json.dump(OUT, open('/home/claude/webapp/app_data.json', 'w'))
import os
print('data prepared:', os.path.getsize('/home/claude/webapp/app_data.json')//1024, 'KB')
print('breaks:', OUT['duration']['breaks'], '| planner rows:', len(rows), '| ctd:', OUT['planner']['ctd'])

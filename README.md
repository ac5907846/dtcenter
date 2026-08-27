# Grid Interconnection as an Upstream Schedule Constraint in Data Center Delivery (companion web app)

Static single-file web app accompanying the paper *Grid Interconnection as an
Upstream Schedule Constraint in Data Center Delivery: Evidence from U.S.
Generation Queues*. Everything (styles,
charts, interactivity, and all data, including the 1,350-row deep-ensemble
planning grid) is inlined in `index.html`. No build step, no server code, no
external requests at runtime. Charts are hand-rolled SVG with hover tooltips;
the U.S. map is projected (Albers equal-area) and dissolved to state borders
at build time.

## Structure

```
06_WebApp/
  index.html            the entire app (self-contained, ~1.1 MB)
  README.md             this file
  build/
    prep_data.py        regenerates the embedded data from ../../05_data and
                        ../../01_analysis (incl. A10 np_outputs planning grid)
    index_template.html app shell with a __DATA__ placeholder
```

## Tabs (hash-routed views; deep links like #findings/p-map work)

- **Findings**: map of the 1,477 IM3 facilities (deep pink, sized by floor
  area) over a state choropleth of median queue waits; capacity entering by
  technology (all entry years labeled); realized durations with the exact
  segmentation breaks 2008Q3 / 2013Q3 / 2021Q3; cumulative-incidence explorer
  by cohort with table view; cost-quartile exit hazards and cost escalation;
  and a closing "Highlights of the findings" section whose six numbered
  results cross-link to the exhibits, the Method page, the planner, and the
  external sources (LBNL, PNNL IM3, FERC).
- **Method**: data sources, sample construction, competing risks estimation,
  changepoint segmentation, temporal validation of the deep ensemble, cost
  identification, reproducibility and scope.
- **Risk Planner**: region x technology x entry year x capacity to ensemble
  delivery curves with 90% bands, cross-region ranking, historical
  comparison, plain-language readout, and an "Applying the estimates" note.
- **About**: anonymized companion-site note (author details added after peer
  review), data acknowledgments, scope disclaimer.

Planner estimates come from the ten-seed deep competing-risks ensemble
(DeepHit family, NumPy implementation in `01_analysis/A10_deep_survival/`),
validated strictly out of time (completion Ctd 0.81, 90% CI 0.796-0.828) and
refitted on all 26,695 requests. They describe generation interconnection
under 2000 to 2025 conditions and are decision support, not a guarantee; keep
the disclaimer visible wherever the planner is embedded.

## Run locally

Open `index.html` in any browser (no server needed), or `python -m http.server`.

## Refresh the data

```
cd build
python prep_data.py            # writes app_data.json
python -c "print(open('index_template.html').read().replace('__DATA__', open('app_data.json').read().replace('</','<\\/')), file=open('../index.html','w'))"
```

## Deploy (dtcenter.electriai.com)

1. Push this folder to a GitHub repository; Settings -> Pages -> deploy from branch.
2. In Cloudflare, CNAME `dtcenter` -> `<user>.github.io`, set the custom domain
   in Pages, keep SSL "Full". The app is fully static; nothing else required.

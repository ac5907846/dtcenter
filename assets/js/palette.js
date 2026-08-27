// Validated study palette. Same hexes as the manuscript figures.
export const C = {
  ink: '#1F2328', char: '#3A3A3A', graph: '#6B6B66', silver: '#9C9C96',
  mist: '#C9C9C4', hairline: '#E4E4DE',
  blue: '#31597E', blueDeep: '#1E3A56',
  green: '#57904F', claret: '#7A2E37', plum: '#7D4A6E',
};

export const TECH_COLORS = {
  Solar: C.green, Gas: C.blue, Wind: C.plum, Battery: C.silver,
  Hybrid: C.mist, Nuclear: C.claret, Other: '#DBDBD6',
};

export const COHORT_COLORS = {
  '2000-07': '#DBDBD6', '2008-13': '#C9C9C4', '2014-17': '#9C9C96',
  '2018-20': '#3A3A3A', '2021-22': '#31597E', '2023-25': '#57904F',
};

export const SLATE_RAMP = ['#F2F2EF', '#C3CDD8', '#7E96AC', '#31597E', '#1E3A56'];

export const FONT = {
  fontFamily: 'Inter, sans-serif',
  color: C.char,
};

// shared ECharts defaults
export function baseOptions() {
  return {
    textStyle: FONT,
    grid: { left: 52, right: 18, top: 42, bottom: 40 },
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#E4E4DE',
      textStyle: { color: '#1F2328', fontSize: 12 } },
  };
}

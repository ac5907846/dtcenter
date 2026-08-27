// Data loading layer. Every file lives in ./data relative to index.html.
const BASE = 'data/';

export async function loadJSON(name) {
  const r = await fetch(BASE + name);
  if (!r.ok) throw new Error(`failed to load ${name}: ${r.status}`);
  return r.json();
}

export async function loadCSV(name) {
  const r = await fetch(BASE + name);
  if (!r.ok) throw new Error(`failed to load ${name}: ${r.status}`);
  return parseCSV(await r.text());
}

// minimal CSV parser (no quoted commas in our files)
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    head.forEach((h, i) => {
      const v = cells[i];
      row[h] = v === '' || v === undefined ? null : (isNaN(+v) ? v : +v);
    });
    return row;
  });
}

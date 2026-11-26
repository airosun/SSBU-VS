// Iterative tuner: full sim -> nudge each outlier's skill bonus (fallback: passive number) -> repeat.
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const { N } = require('../src/fighters');
const BASE = JSON.parse(JSON.stringify(N));
const ADDON = new Set(['gnw', 'pacman', 'hero', 'pyra', 'samus', 'sora']); // s is an add-on, may go negative
const ovFile = 'overrides.json';
let ov = fs.existsSync(ovFile) ? JSON.parse(fs.readFileSync(ovFile)) : {};
const rounds = +(process.argv[2] || 4), games = +(process.argv[3] || 60), band = +(process.argv[4] || 2.5);
const cur = id => ({ ...BASE[id], ...(ov[id] || {}) });
for (let r = 0; r < rounds; r++) {
  fs.writeFileSync(ovFile, JSON.stringify(ov));
  execSync(`node ${__dirname}/sim.js ${games} tune.json ${ovFile}`, { stdio: 'inherit' });
  const res = JSON.parse(fs.readFileSync('tune.json'));
  const wr = res.field.map(f => 100 * f.wr), sd = Math.sqrt(wr.reduce((a, b) => a + (b - 50) ** 2, 0) / wr.length);
  console.log(`round ${r}: sd ${sd.toFixed(2)} min ${Math.min(...wr).toFixed(1)} max ${Math.max(...wr).toFixed(1)}`);
  let changed = 0;
  for (const f of res.field) {
    const w = 100 * f.wr, dev = 50 - w;
    if (Math.abs(dev) <= band) continue;
    const c = cur(f.id), key = f.id === 'sora' ? 'x' : 's';
    let step = Math.max(-4, Math.min(4, Math.round(dev / 2.2))) || Math.sign(dev);
    const floor = ADDON.has(f.id) ? -6 : 1;
    let nv = Math.max(floor, c[key] + step);
    ov[f.id] = { ...(ov[f.id] || {}) };
    if (nv === c[key] && dev < 0 && c.p > 1) ov[f.id].p = c.p - 1;     // skill at floor: trim passive
    else ov[f.id][key] = nv;
    changed++;
  }
  if (!changed) break;
}
fs.writeFileSync(ovFile, JSON.stringify(ov, null, 1));
console.log(JSON.stringify(ov));

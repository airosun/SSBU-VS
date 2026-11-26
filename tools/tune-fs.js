// Final Smash tuner: full sim -> nudge each outlier's Final Smash damage (FSN[id]) toward 50% -> repeat.
// Usage: node tools/tune-fs.js rounds games band   (reads/writes tools/fs-overrides.json)
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const file = __dirname + '/fs-overrides.json';
let ov = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : { _fs: { _all: 3 } };
const [rounds, games, band] = [+(process.argv[2] || 4), +(process.argv[3] || 60), +(process.argv[4] || 2.5)];
for (let r = 0; r < rounds; r++) {
  fs.writeFileSync(file, JSON.stringify(ov));
  execSync(`node ${__dirname}/sim.js ${games} ${__dirname}/tune.json ${file}`, { stdio: 'inherit' });
  const res = JSON.parse(fs.readFileSync(__dirname + '/tune.json'));
  const w = res.field.map(f => 100 * f.wr);
  console.log(`round ${r}: min ${Math.min(...w).toFixed(1)} max ${Math.max(...w).toFixed(1)} sd ${Math.sqrt(w.reduce((a, b) => a + (b - 50) ** 2, 0) / w.length).toFixed(2)} in-band ${w.filter(x => Math.abs(x - 50) <= band).length}/83`);
  let changed = 0;
  for (const f of res.field) {
    const dev = 50 - 100 * f.wr; if (Math.abs(dev) <= band) continue;
    const step = Math.max(-5, Math.min(5, Math.round(dev / 2.1))) || Math.sign(dev);
    ov._fs[f.id] = (ov._fs[f.id] || 0) + step; changed++;
  }
  if (!changed) break;
}
fs.writeFileSync(file, JSON.stringify(ov, null, 1));
console.log(JSON.stringify(ov._fs));

// All-pairs simulation. Usage: node sim.js [gamesPerPair] [out.json] [overrides.json]
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const fs = require('fs');

function applyOverrides(N, ov) { for (const k in ov || {}) if (k[0] !== '_') Object.assign(N[k], ov[k]); }

function playGame(E, AI, fa, fb, seed) {
  const g = E.newGame(fa, fb, seed);
  let turns = 0;
  while (!g.over) { E.resolve(g, AI.chooseActions(g)); turns++; }
  return { w: g.winner, turns };
}

if (isMainThread) {
  const games = +(process.argv[2] || 40);
  const out = process.argv[3] || 'results.json';
  const ovFile = process.argv[4];
  const ov = ovFile ? JSON.parse(fs.readFileSync(ovFile, 'utf8')) : {};
  const { FIGHTERS } = require('../src/fighters');
  const ids = FIGHTERS.map(f => f.id);
  const pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push([i, j]);
  const nW = Math.max(1, os.cpus().length);
  const chunks = Array.from({ length: nW }, (_, k) => pairs.filter((_, x) => x % nW === k));
  const t0 = Date.now();
  let done = 0; const results = [];
  chunks.forEach(chunk => {
    const w = new Worker(__filename, { workerData: { chunk, games, ov } });
    w.on('message', m => { results.push(...m); if (++done === nW) finish(); });
  });
  function finish() {
    const n = ids.length;
    const W = Array.from({ length: n }, () => new Array(n).fill(null));
    let turnSum = 0, gameCount = 0, draws = 0;
    for (const r of results) {
      W[r.i][r.j] = r.a / r.g; W[r.j][r.i] = r.b / r.g;
      turnSum += r.turns; gameCount += r.g; draws += r.g - r.a - r.b;
    }
    // win rate vs field: draws count as half
    const field = ids.map((id, i) => {
      let s = 0; for (let j = 0; j < n; j++) if (j !== i) s += (W[i][j] + (1 - W[i][j] - W[j][i])) / 2 + (W[i][j] - (1 - W[i][j] - W[j][i])) / 2 * 0 ;
      let pts = 0; for (let j = 0; j < n; j++) if (j !== i) pts += W[i][j] + 0.5 * (1 - W[i][j] - W[j][i]);
      return { id, name: FIGHTERS[i].name, wr: pts / (n - 1) };
    });
    fs.writeFileSync(out, JSON.stringify({ ids, W, field, avgTurns: turnSum / gameCount, drawRate: draws / gameCount, games }, null, 0));
    console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s, avg turns ${(turnSum / gameCount).toFixed(1)}, draws ${(100 * draws / gameCount).toFixed(1)}%`);
  }
} else {
  const E = require('../src/engine'), AI = require('../src/ai'), Fm = require('../src/fighters');
  if (workerData.ov._rules) Object.assign(E.RULES, workerData.ov._rules);
  if (workerData.ov._fs) Object.assign(Fm.FSN, workerData.ov._fs);
  applyOverrides(Fm.N, workerData.ov);
  const F = Fm.FIGHTERS; const out = [];
  for (const [i, j] of workerData.chunk) {
    let a = 0, b = 0, turns = 0;
    for (let k = 0; k < workerData.games; k++) {
      const seed = (i * 7919 + j * 104729 + k * 15485863) >>> 0;
      const r = playGame(E, AI, F[i], F[j], seed);
      if (r.w === 0) a++; else if (r.w === 1) b++;
      turns += r.turns;
    }
    out.push({ i, j, a, b, g: workerData.games, turns });
  }
  parentPort.postMessage(out);
}

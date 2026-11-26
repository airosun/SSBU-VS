// Win rate of one fighter vs the field under overrides. Usage: node row.js id games '{"rob":{"s":10}}'
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
if (isMainThread) {
  const [id, games, ovs] = [process.argv[2], +(process.argv[3] || 100), process.argv[4] || '{}'];
  const ov = JSON.parse(ovs);
  let done = 0, pts = 0, n = 0;
  for (let k = 0; k < 2; k++) {
    const w = new Worker(__filename, { workerData: { id, games, ov, k } });
    w.on('message', m => { pts += m.pts; n += m.n; if (++done === 2) console.log(id, JSON.stringify(ov), (100 * pts / n).toFixed(1)); });
  }
} else {
  const E = require('../src/engine'), AI = require('../src/ai'), Fm = require('../src/fighters');
  for (const key in workerData.ov) if (key[0] !== '_') Object.assign(Fm.N[key], workerData.ov[key]);
  if (workerData.ov._fs) Object.assign(Fm.FSN, workerData.ov._fs);
  if (workerData.ov._rules) Object.assign(E.RULES, workerData.ov._rules);
  const me = Fm.BY_ID[workerData.id]; let pts = 0, n = 0;
  Fm.FIGHTERS.forEach((o, j) => {
    if (o === me || j % 2 !== workerData.k) return;
    for (let g = 0; g < workerData.games; g++) {
      const G = E.newGame(me, o, (j * 7919 + g * 104729 + 17) >>> 0);
      while (!G.over) E.resolve(G, AI.chooseActions(G));
      pts += G.winner === 0 ? 1 : G.winner === -1 ? 0.5 : 0; n++;
    }
  });
  parentPort.postMessage({ pts, n });
}

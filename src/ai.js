// CPU player: 1-turn lookahead payoff matrix, solved as a zero-sum game (fictitious play), then sampled.
'use strict';
const E = require('./engine');
const METER_VALUE = 2.5; // how much the CPU values 1 meter, in HP

function score(p, o, g) {
  const T = g.T;
  let s = p.hp + METER_VALUE * p.meter + 0.8 * p.charge - 0.8 * p.weaken;
  for (const b of p.burns) s -= b.x * b.left;
  if (E.active(p, 'stagger', T)) s -= 3;
  if (E.active(p, 'paralyze', T)) s -= 2;
  if (E.active(p, 'lock', T)) s -= 4;
  const ar = E.active(p, 'armor', T); if (ar) s += 0.8 * ar.v * (ar.until - T + 1);
  if (p.f.potential) s += p.f.potential(p, g);
  return s;
}
function evaluate(g) {
  if (g.over) return g.winner === 0 ? 1000 : g.winner === 1 ? -1000 : 0;
  return score(g.p[0], g.p[1], g) - score(g.p[1], g.p[0], g);
}
function solve(M, iters = 120) {
  const n = M.length, m = M[0].length;
  const rc = new Array(n).fill(0), cc = new Array(m).fill(0);
  const rowPay = new Array(n).fill(0), colPay = new Array(m).fill(0);
  let r = 0, c = 0;
  for (let t = 0; t < iters; t++) {
    rc[r]++; cc[c]++;
    for (let i = 0; i < n; i++) rowPay[i] += M[i][c];
    for (let j = 0; j < m; j++) colPay[j] += M[r][j];
    r = 0; for (let i = 1; i < n; i++) if (rowPay[i] > rowPay[r]) r = i;
    c = 0; for (let j = 1; j < m; j++) if (colPay[j] < colPay[c]) c = j;
  }
  return [rc.map(x => x / iters), cc.map(x => x / iters)];
}
function sample(probs, rng) { let x = rng(); for (let i = 0; i < probs.length; i++) { x -= probs[i]; if (x <= 0) return i; } return probs.length - 1; }

function chooseActions(g) {
  const A0 = E.legalActions(g, 0), A1 = E.legalActions(g, 1);
  const M = A0.map(a => A1.map(b => { const c = E.cloneGame(g); E.resolve(c, [a, b]); return evaluate(c); }));
  const [p0, p1] = solve(M);
  return [A0[sample(p0, g.rng)], A1[sample(p1, g.rng)]];
}
module.exports = { chooseActions, evaluate, solve };

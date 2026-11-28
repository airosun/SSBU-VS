// Quick model of the v2 rules (triangle, Special types, clash, shield gauge) with generic Specials.
// No per-fighter passives yet: this only checks whether the rules and the six Special types are balanced.
const R = { HP: 100, ATK: 10, GRAB: 10, PUNISH: 8, PIPS: 3, BUFF_TAKEN: 0.75 };
const ARCH = {
  close:   { type: 'CA', dmg: 14, cd: 1 },
  ranged:  { type: 'RA', dmg: 8, cd: 1 },
  command: { type: 'CG', dmg: 14, cd: 1 },
  tether:  { type: 'TG', dmg: 8, cd: 1 },
  counter: { type: 'CT', mult: 1.0, cd: 1 },
  buff:    { type: 'BF', cd: 3, turns: 3, plus: 4 },
};
// class of each pick: A=close attack, R=ranged, G=grab/command, T=tether, S=shield, C=counter, B=buff
const cls = (p, a) => a === 'A' ? 'A' : a === 'G' ? 'G' : a === 'S' ? 'S' : { CA: 'A', RA: 'R', CG: 'G', TG: 'T', CT: 'C', BF: 'B' }[p.sp.type];
const BEATS = { A: ['G', 'T', 'B'], R: ['A', 'G', 'T', 'B'], G: ['S', 'C', 'B'], T: ['G', 'S', 'C', 'B'], S: ['A', 'R', 'B'], C: ['A', 'R', 'B'], B: [] };
function hitDmg(p, a) {   // damage p's pick does when it lands
  const plus = p.buff > 0 ? ARCH.buff.plus : 0;
  if (a === 'A') return R.ATK + plus; if (a === 'G') return R.GRAB + plus; if (a === 'S') return R.PUNISH + plus;
  return (p.sp.dmg || R.ATK) + plus;
}
function outcome(st, acts) {   // → [dmg to p0, dmg to p1] and side effects
  const [p, q] = st, [a, b] = acts;
  const dmg = [0, 0];
  if (p.dizzy) { dmg[0] = b === 'S' || cls(q, b) === 'C' || cls(q, b) === 'B' ? 0 : hitDmg(q, b); return dmg; }
  if (q.dizzy) { dmg[1] = a === 'S' || cls(p, a) === 'C' || cls(p, a) === 'B' ? 0 : hitDmg(p, a); return dmg; }
  const ca = cls(p, a), cb = cls(q, b);
  const taken = (who, d) => Math.round(d * (st[who].buffing ? R.BUFF_TAKEN : 1));
  if ((ca === 'A' && cb === 'A') || (ca === 'R' && cb === 'R')) { dmg[0] = Math.round(hitDmg(q, b) / 2); dmg[1] = Math.round(hitDmg(p, a) / 2); return dmg; }
  if (BEATS[ca].includes(cb)) dmg[1] = taken(1, ca === 'C' ? Math.round(hitDmg(q, b) * p.sp.mult) : hitDmg(p, a));
  else if (BEATS[cb].includes(ca)) dmg[0] = taken(0, cb === 'C' ? Math.round(hitDmg(p, a) * q.sp.mult) : hitDmg(q, b));
  if (ca === 'C' && cb === 'B') dmg[1] = taken(1, R.PUNISH); if (cb === 'C' && ca === 'B') dmg[0] = taken(0, R.PUNISH);
  return dmg;
}
const legal = p => p.dizzy ? ['-'] : ['A', 'G', 'S', ...(p.cd === 0 ? ['P'] : []), ...(p.pips > 0 ? [] : [])];
function step(st, acts) {
  const n = st.map(p => ({ ...p }));
  const d = outcome(st, acts);
  n[0].hp -= d[0]; n[1].hp -= d[1];
  n.forEach((p, i) => {
    const a = acts[i], wasDizzy = st[i].dizzy;
    p.dizzy = false; p.buffing = false;
    if (p.buff > 0) p.buff--;
    if (!wasDizzy && a === 'S') { p.pips--; if (p.pips <= 0) { p.dizzy = true; p.pips = R.PIPS; } }
    else if (p.pips < R.PIPS) p.pips++;
    if (p.cd > 0) p.cd--;
    if (a === 'P') { p.cd = p.sp.cd; if (p.sp.type === 'BF') { p.buff = p.sp.turns; } }
  });
  return n;
}
// one-turn lookahead payoff with small terms for shield pips / dizziness / cooldowns
const val = (st, me) => { const p = st[me], q = st[1 - me];
  return (p.hp - q.hp) + 2.5 * (p.pips - q.pips) - 9 * ((p.dizzy ? 1 : 0) - (q.dizzy ? 1 : 0)) - 1.5 * (p.cd - q.cd) + (R.BUFFW || 3) * (p.buff - q.buff); };
function solve(M) {   // fictitious play on a zero-sum matrix → row mix
  const r = M.length, c = M[0].length, rc = Array(r).fill(0), cc = Array(c).fill(0); let ri = 0, ci = 0;
  for (let t = 0; t < 400; t++) { rc[ri]++; cc[ci]++;
    let best = -1e9; for (let i = 0; i < r; i++) { let v = 0; for (let j = 0; j < c; j++) v += M[i][j] * cc[j]; if (v > best) { best = v; ri = i; } }
    best = 1e9; for (let j = 0; j < c; j++) { let v = 0; for (let i = 0; i < r; i++) v += M[i][j] * rc[i]; if (v < best) { best = v; ci = j; } } }
  const s = rc.reduce((a, b) => a + b); return rc.map(x => x / s);
}
const pick = (L, w, rng) => { let x = rng(); for (let i = 0; i < L.length; i++) { x -= w[i]; if (x <= 0) return L[i]; } return L[L.length - 1]; };
function game(A, B, rng, tally) {
  let st = [A, B].map(sp => ({ sp, hp: R.HP, pips: R.PIPS, cd: 0, dizzy: false, buff: 0 }));
  for (let T = 0; T < 60; T++) {
    const L = st.map(legal);
    const acts = [0, 1].map(me => { const M = L[me].map(a => L[1 - me].map(b => { const ac = me ? [b, a] : [a, b]; const n = step(st, ac); return val(n, me) - val(st, me); }));
      const a = pick(L[me], solve(M), rng); tally[me][a] = (tally[me][a] || 0) + 1; return a; });
    st = st.map((p, i) => ({ ...p, buffing: acts[i] === 'P' && p.sp.type === 'BF' }));
    st = step(st, acts);
    if (st[0].hp <= 0 || st[1].hp <= 0) return st[0].hp > st[1].hp ? 0 : st[1].hp > st[0].hp ? 1 : 0.5;
  }
  return st[0].hp > st[1].hp ? 0 : st[1].hp > st[0].hp ? 1 : 0.5;
}
let seed = 12345; const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
if (process.argv[3]) { const o = JSON.parse(process.argv[3]); for (const k in o) Object.assign(ARCH[k] || R, o[k]); }
const names = Object.keys(ARCH), N = +(process.argv[2] || 400);
const win = {}, mix = {}; names.forEach(n => { win[n] = [0, 0]; mix[n] = {}; });
const grid = {};
for (const a of names) for (const b of names) { if (a >= b) continue; let w = 0;
  for (let g = 0; g < N; g++) { const t = [{}, {}]; const r = g % 2 ? game(ARCH[b], ARCH[a], rng, t) : game(ARCH[a], ARCH[b], rng, t);
    const aw = g % 2 ? (r === 1 ? 1 : r === 0.5 ? 0.5 : 0) : (r === 0 ? 1 : r === 0.5 ? 0.5 : 0); w += aw;
    const [ta, tb] = g % 2 ? [t[1], t[0]] : [t[0], t[1]];
    for (const [k, v] of Object.entries(ta)) mix[a][k] = (mix[a][k] || 0) + v; for (const [k, v] of Object.entries(tb)) mix[b][k] = (mix[b][k] || 0) + v; }
  grid[a + '/' + b] = (100 * w / N).toFixed(0); win[a][0] += w; win[a][1] += N; win[b][0] += N - w; win[b][1] += N; }
console.log('Overall win rate by Special type:');
for (const n of names) { const m = mix[n], t = Object.values(m).reduce((x, y) => x + y, 0);
  console.log(n.padEnd(8), (100 * win[n][0] / win[n][1]).toFixed(1) + '%', '  picks:', ['A', 'G', 'S', 'P', '-'].map(k => `${k === 'P' ? 'Special' : k === '-' ? 'dizzy' : k} ${(100 * (m[k] || 0) / t).toFixed(0)}%`).join(' ')); }
console.log('Head to head (row type win %):', JSON.stringify(grid));

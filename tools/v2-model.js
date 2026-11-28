// Quick model of the v2 rules with one generic Special per type (no passives yet).
// Checks whether the triangle, Special types, shield gauge and Smash Meter economy are balanced.
//   node tools/v2-model.js [games per pair] ['{"ranged":{"dmg":6},"R":{"BLOCK_METER":1}}']
const R = {
  HP: 100, ATK: 10, GRAB: 10,
  PIPS: 3,            // shield gauge
  BLOCK_METER: 1,     // Smash Meter for a successful Shield (blocks an Attack or a Final Smash)
  HIT_METER: 1,       // Smash Meter for landing a hit (not on a turn you used a Special)
  METER_MAX: 8, FS_DMG: 18, FS_PIPS: 2,   // a Final Smash can be Shielded but takes 2 pips
  BLOCK_DRAIN: 0,     // Smash Meter the blocked attacker loses
  BLOCK_STUN: 0,      // 1 = a blocked attacker can't Shield next turn
  BUFF_TAKEN: 0.5,
  METER_W: 2.5, PIP_W: 2.5, DIZZY_W: 9, BUFF_W: 5,   // CPU's value of each resource
};
const ARCH = {
  close:   { type: 'CA', dmg: 14, cost: 2 },
  ranged:  { type: 'RA', dmg: 6,  cost: 2 },
  command: { type: 'CG', dmg: 16, cost: 2 },
  tether:  { type: 'TG', dmg: 11, cost: 2 },
  counter: { type: 'CT', mult: 1.0, cost: 2 },
  buff:    { type: 'BF', cost: 2, turns: 3, plus: 6 },
};
if (process.argv[3]) { const o = JSON.parse(process.argv[3]); for (const k in o) Object.assign(k === 'R' ? R : ARCH[k], o[k]); }

// classes: A close attack, R ranged, G grab/command, T tether, S shield, C counter, B buff, F final smash, D dodge
const cls = (p, a) => ({ A: 'A', G: 'G', S: 'S', F: 'F', D: 'D', '-': '-' })[a] || { CA: 'A', RA: 'R', CG: 'G', TG: 'T', CT: 'C', BF: 'B' }[p.sp.type];
const BEATS = { A: ['G', 'T', 'B', 'D'], R: ['A', 'G', 'T', 'B', 'D'], G: ['C', 'B', 'D', 'S'], T: ['G', 'C', 'B', 'D', 'S'], S: [], C: ['A', 'R', 'B', 'D'], B: ['D'], F: ['A', 'R', 'G', 'T', 'C', 'B'], D: [] };
const isAtk = c => c === 'A' || c === 'R';
function hitDmg(p, a) {
  const plus = p.buff > 0 ? ARCH.buff.plus : 0;
  if (a === 'A') return R.ATK + plus; if (a === 'G') return R.GRAB + plus; if (a === 'F') return R.FS_DMG + plus;
  return (p.sp.dmg || R.ATK) + plus;
}
// resolve one exchange → damage taken by each side + who blocked
function outcome(st, acts) {
  const [p, q] = st, [a, b] = acts, ca = cls(p, a), cb = cls(q, b), dmg = [0, 0], block = [false, false];
  const deals = c => !['S', 'C', 'B', 'D', '-'].includes(c);
  if (p.dizzy) { if (deals(cb)) dmg[0] = hitDmg(q, b); return { dmg, block }; }
  if (q.dizzy) { if (deals(ca)) dmg[1] = hitDmg(p, a); return { dmg, block }; }
  const taken = (i, d) => Math.round(d * (acts[i] === 'P' && st[i].sp.type === 'BF' ? R.BUFF_TAKEN : 1));
  // Shield nullifies Attacks and Final Smashes (no retaliation), loses to Grabs
  if (ca === 'S' && (isAtk(cb) || cb === 'F')) { block[0] = true; return { dmg, block }; }
  if (cb === 'S' && (isAtk(ca) || ca === 'F')) { block[1] = true; return { dmg, block }; }
  if ((ca === 'A' && cb === 'A') || (ca === 'R' && cb === 'R')) { dmg[0] = Math.round(hitDmg(q, b) / 2); dmg[1] = Math.round(hitDmg(p, a) / 2); return { dmg, block }; }
  if (ca === 'F' && cb === 'F') { dmg[0] = dmg[1] = R.FS_DMG / 2; return { dmg, block }; }
  if (BEATS[ca].includes(cb)) dmg[1] = taken(1, ca === 'C' ? Math.round((cb === 'B' ? R.ATK : hitDmg(q, b)) * p.sp.mult) : hitDmg(p, a));
  else if (BEATS[cb].includes(ca)) dmg[0] = taken(0, cb === 'C' ? Math.round((ca === 'B' ? R.ATK : hitDmg(p, a)) * q.sp.mult) : hitDmg(q, b));
  return { dmg, block };
}
function legal(p, q) {
  if (p.dizzy) return ['-'];
  const L = p.stunned ? ['A', 'G'] : ['A', 'G', 'S'];
  if (p.meter >= p.sp.cost) L.push('P');
  if (p.meter >= R.METER_MAX) L.push('F');
  if (q.meter >= R.METER_MAX) L.push('D');
  return L;
}
function step(st, acts) {
  const n = st.map(p => ({ ...p })), { dmg, block } = outcome(st, acts);
  n[0].hp -= dmg[0]; n[1].hp -= dmg[1];
  n.forEach((p, i) => {
    const a = acts[i], o = acts[1 - i], wasDizzy = st[i].dizzy;
    p.dizzy = false; if (p.buff > 0) p.buff--;
    if (a === 'P') { p.meter -= p.sp.cost; if (p.sp.type === 'BF') p.buff = p.sp.turns; }
    if (a === 'F') p.meter = 0;
    if (dmg[1 - i] > 0 && a !== 'P' && a !== 'F') p.meter += R.HIT_METER;
    if (block[i]) p.meter += R.BLOCK_METER;
    p.stunned = false;
    if (block[1 - i]) { p.meter = Math.max(0, p.meter - R.BLOCK_DRAIN); if (R.BLOCK_STUN) p.stunned = true; }
    p.meter = Math.min(R.METER_MAX, p.meter);
    if (!wasDizzy && a === 'S') {
      p.pips -= 1 + (block[i] && o === 'F' ? R.FS_PIPS - 1 : 0);
      if (p.pips <= 0) { p.dizzy = true; p.pips = R.PIPS; }
    } else if (p.pips < R.PIPS) p.pips++;
  });
  return n;
}
const val = (st, me) => { const p = st[me], q = st[1 - me];
  return (p.hp - q.hp) + R.PIP_W * (p.pips - q.pips) - R.DIZZY_W * ((p.dizzy ? 1 : 0) - (q.dizzy ? 1 : 0)) + R.METER_W * (p.meter - q.meter) + R.BUFF_W * (p.buff - q.buff); };
function solve(M) {
  const r = M.length, c = M[0].length, rc = Array(r).fill(0), cc = Array(c).fill(0); let ri = 0, ci = 0;
  for (let t = 0; t < 400; t++) { rc[ri]++; cc[ci]++;
    let best = -1e9; for (let i = 0; i < r; i++) { let v = 0; for (let j = 0; j < c; j++) v += M[i][j] * cc[j]; if (v > best) { best = v; ri = i; } }
    best = 1e9; for (let j = 0; j < c; j++) { let v = 0; for (let i = 0; i < r; i++) v += M[i][j] * rc[i]; if (v < best) { best = v; ci = j; } } }
  const s = rc.reduce((a, b) => a + b); return rc.map(x => x / s);
}
const pick = (L, w, rng) => { let x = rng(); for (let i = 0; i < L.length; i++) { x -= w[i]; if (x <= 0) return L[i]; } return L[L.length - 1]; };
function game(A, B, rng, tally) {
  let st = [A, B].map(sp => ({ sp, hp: R.HP, pips: R.PIPS, meter: 0, dizzy: false, buff: 0 }));
  for (let T = 0; T < 60; T++) {
    const L = [legal(st[0], st[1]), legal(st[1], st[0])];
    const acts = [0, 1].map(me => {
      const M = L[me].map(a => L[1 - me].map(b => { const n = step(st, me ? [b, a] : [a, b]); return val(n, me) - val(st, me); }));
      const a = pick(L[me], solve(M), rng); tally[me][a] = (tally[me][a] || 0) + 1; return a; });
    st = step(st, acts);
    if (st[0].hp <= 0 || st[1].hp <= 0) break;
  }
  return st[0].hp > st[1].hp ? 0 : st[1].hp > st[0].hp ? 1 : 0.5;
}
let seed = 12345; const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const names = Object.keys(ARCH), N = +(process.argv[2] || 300);
const win = {}, mix = {}; names.forEach(n => { win[n] = [0, 0]; mix[n] = {}; });
for (const a of names) for (const b of names) { if (a >= b) continue; let w = 0;
  for (let g = 0; g < N; g++) { const t = [{}, {}], flip = g % 2, r = flip ? game(ARCH[b], ARCH[a], rng, t) : game(ARCH[a], ARCH[b], rng, t);
    const aw = r === 0.5 ? 0.5 : (r === (flip ? 1 : 0) ? 1 : 0); w += aw;
    const [ta, tb] = flip ? [t[1], t[0]] : [t[0], t[1]];
    for (const [k, v] of Object.entries(ta)) mix[a][k] = (mix[a][k] || 0) + v; for (const [k, v] of Object.entries(tb)) mix[b][k] = (mix[b][k] || 0) + v; }
  win[a][0] += w; win[a][1] += N; win[b][0] += N - w; win[b][1] += N; }
const LBL = { A: 'Attack', G: 'Grab', S: 'Shield', P: 'Special', F: 'FS', D: 'Dodge', '-': 'dizzy' };
for (const n of names) { const m = mix[n], t = Object.values(m).reduce((x, y) => x + y, 0);
  console.log(n.padEnd(8), (100 * win[n][0] / win[n][1]).toFixed(1).padStart(5) + '%  ', Object.keys(LBL).map(k => `${LBL[k]} ${(100 * (m[k] || 0) / t).toFixed(0)}%`).join('  ')); }

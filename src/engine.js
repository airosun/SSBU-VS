// Smash RPS Battler — core engine. Shared by the simulator and (later) the real game server.
'use strict';

const RULES = {
  HP: 100, BASE: 10, CLASH: 5, FS_DMG: 14, FS_COST: 8, ENDLAG: 0, METER_MAX: 8, TURN_LIMIT: 40, HIT_METER: 1,
};
const BEATS = { A: 'G', G: 'C', C: 'A' }; // key beats value

// ---------- RNG ----------
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------- status helpers ----------
// statuses live on p.st[name] = {from, until, v}
function setStatus(g, p, name, turns = 1, v = true) {
  if ((name === 'stagger' || name === 'paralyze') && p.f.immune) return;
  const from = g.T + 1, until = g.T + turns;
  const cur = p.st[name];
  if (cur && cur.until >= from && name !== 'lock' && name !== 'armor') { cur.until = Math.max(cur.until, until); return; }
  if (name === 'armor' && cur && cur.until >= from) { cur.v = Math.max(cur.v, v); cur.until = Math.max(cur.until, until); return; }
  p.st[name] = { from, until, v };
}
function active(p, name, T) { const s = p.st[name]; return s && s.from <= T && s.until >= T ? s : null; }

function gain(g, p, n) {
  if (n <= 0) return;
  if (active(p, 'paralyze', g.T)) return;
  p.meter = Math.min(RULES.METER_MAX, p.meter + n);
}
function drain(p, n) { p.meter = Math.max(0, p.meter - n); }
function heal(p, n) { if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + n); }
function selfDmg(p, n) { p.hp -= n; p.dmgTurn += n; }  // recoil / burn / trap damage (not a "hit")
function burn(g, p, x, turns) { p.burns.push({ x, left: turns, start: g.T + 1 }); }
function charge(p, n) { p.charge = Math.max(p.charge, n); }
function weaken(p, n) { p.weaken = Math.max(p.weaken, n); }

// ---------- players ----------
function makePlayer(f) {
  const hp = typeof f.maxHp === 'function' ? f.maxHp() : (f.maxHp || RULES.HP);
  return { f, hp, maxHp: hp, meter: 0, st: {}, burns: [], charge: 0, weaken: 0,
    mem: f.initMem ? f.initMem() : {}, hist: [], dmgTurn: 0, copy: null };
}
function clonePlayer(p) {
  const st = {};
  for (const k in p.st) st[k] = { ...p.st[k] };
  return { f: p.f, hp: p.hp, maxHp: p.maxHp, meter: p.meter, st, burns: p.burns.map(b => ({ ...b })), charge: p.charge,
    weaken: p.weaken, mem: { ...p.mem }, hist: p.hist.slice(-4), dmgTurn: 0, copy: p.copy };
}
function newGame(fA, fB, seed) {
  return { T: 1, p: [makePlayer(fA), makePlayer(fB)], rng: makeRng(seed), over: false, winner: null };
}
function cloneGame(g) {
  return { T: g.T, p: [clonePlayer(g.p[0]), clonePlayer(g.p[1])], rng: g.rng, over: g.over, winner: g.winner, sim: true };
}

// ---------- skill access ----------
function skillOf(p) { return p.copy || p.f.skill; }
function skillType(p, g) { const s = skillOf(p); return typeof s.type === 'function' ? s.type(p, g) : s.type; }
function skillCost(g, p, o) {
  const s = skillOf(p);
  let c = typeof s.cost === 'function' ? s.cost(p, o, g) : s.cost;
  if (p.f.costMod) c += p.f.costMod(p, o, g);
  if (o.f.taxOpp) c += o.f.taxOpp;
  return Math.max(s.minCost ?? 0, c);
}
function last(p, k = 1) { return p.hist[p.hist.length - k]; }
function wonLast(p) { const h = last(p); return !!(h && h.res === 'win'); }
function lostLast(p) { const h = last(p); return !!(h && h.res === 'lose'); }

function legalActions(g, i) {
  const p = g.p[i], o = g.p[1 - i], T = g.T;
  const lock = active(p, 'lock', T);
  const acts = [];
  for (const t of ['A', 'C', 'G']) if (!lock || lock.v !== t) acts.push({ kind: 'basic', type: t });
  const s = skillOf(p);
  const st = skillType(p, g);
  if (!active(p, 'stagger', T) && (!lock || lock.v !== st) && p.meter >= skillCost(g, p, o) && (!s.can || s.can(p, o, g)))
    acts.push({ kind: 'skill', type: st });
  if (p.meter >= RULES.FS_COST) acts.push({ kind: 'fs', type: 'FS' });
  return acts;
}

// ---------- hits ----------
function hook(p, name, ...a) { const fn = p.f[name]; return fn ? (fn(...a) || 0) : 0; }

function hit(g, att, def, o) {
  // o: {base, win, clash, fs, aAct, dAct, ignoreArmor}
  const c = { g, me: att, opp: def, act: o.aAct, oppAct: o.dAct, T: g.T };
  let d = o.base;
  if (o.win) {
    if (o.aAct.kind === 'skill') { const s = skillOf(att); d += s.bonus ? s.bonus(c) : 0; if (s.ignoreArmor) o.ignoreArmor = true; }
    d += hook(att, 'winBonus', c);
    d += att.charge; att.charge = 0;
    if (!o.ignoreArmor) d -= att.weaken;
    att.weaken = 0;
    if (o.dAct.kind === 'skill') {
      const ds = skillOf(def);
      d += ds.endlag ?? def.f.endlag ?? RULES.ENDLAG;
      d += hook(att, 'punishBonus', c);
    }
    d += hook(def, 'vuln', { g, me: def, opp: att, act: o.dAct, oppAct: o.aAct, T: g.T });
    if (att.mem.double > 0) { d *= 2; att.mem.double--; }
  }
  if (o.clash) {
    d += hook(att, 'clashDealt', c);
    d += hook(def, 'clashTaken', { g, me: def, opp: att, T: g.T });
  }
  d += hook(att, 'hitBonus', c); // applies to wins and clashes
  if (!o.fs) {
    if (!o.ignoreArmor) { const ar = active(def, 'armor', g.T); if (ar) d -= ar.v; }
    if (def.f.reduce) d = def.f.reduce({ g, me: def, opp: att, act: o.dAct, oppAct: o.aAct, T: g.T, win: o.win, clash: o.clash }, d);
    d += hook(def, 'takeMod', { g, me: def, opp: att, T: g.T });
  }
  d = Math.max(0, Math.round(d));
  if (def.f.absorb) d = def.f.absorb({ g, me: def, opp: att, T: g.T }, d);
  def.hp -= d; def.dmgTurn += d;
  if (d > 0) { gain(g, def, RULES.HIT_METER); if (def.f.onHit) def.f.onHit({ g, me: def, opp: att, T: g.T }, d); }
  return d;
}

// ---------- resolve one turn ----------
function resolve(g, acts) {
  const T = g.T, P = g.p;
  const res = ['tie', 'tie'];
  for (let i = 0; i < 2; i++) {
    const p = P[i], o = P[1 - i], a = acts[i];
    p.dmgTurn = 0;
    if (a.kind === 'skill') { p.meter -= skillCost(g, p, o); const s = skillOf(p); if (s.onUse) s.onUse({ g, me: p, opp: o, act: a, oppAct: acts[1 - i], T }); }
    else if (a.kind === 'fs') p.meter = 0;
  }
  for (let i = 0; i < 2; i++) {
    const p = P[i], o = P[1 - i];
    if (acts[i].kind === 'basic') gain(g, p, 1);
    if (p.f.turnMeter) gain(g, p, p.f.turnMeter({ g, me: p, opp: o, T, act: acts[i] }));
    if (acts[1 - i].kind === 'skill' && p.f.onOppSkill) p.f.onOppSkill({ g, me: p, opp: o, T });
  }
  const [a0, a1] = acts;
  let winner = -1, kind = 'none';
  if (a0.kind === 'fs' || a1.kind === 'fs') {
    kind = 'fs';
    if (a0.kind === 'fs') hit(g, P[0], P[1], { base: RULES.FS_DMG, fs: true, aAct: a0, dAct: a1 });
    if (a1.kind === 'fs') hit(g, P[1], P[0], { base: RULES.FS_DMG, fs: true, aAct: a1, dAct: a0 });
  } else if (a0.type === a1.type) {
    if (a0.kind !== a1.kind) winner = a0.kind === 'skill' ? 0 : 1;          // Priority
    else if (a0.type === 'A') {
      const w0 = a0.kind === 'skill' && skillOf(P[0]).clashWin, w1 = a1.kind === 'skill' && skillOf(P[1]).clashWin;
      if (w0 && !w1) winner = 0; else if (w1 && !w0) winner = 1; else kind = 'clash';
    } else kind = 'whiff';
  } else winner = BEATS[a0.type] === a1.type ? 0 : 1;

  if (winner >= 0) {
    kind = 'win';
    const W = P[winner], L = P[1 - winner], wa = acts[winner], la = acts[1 - winner];
    res[winner] = 'win'; res[1 - winner] = 'lose';
    const cW = { g, me: W, opp: L, act: wa, oppAct: la, T };
    const cL = { g, me: L, opp: W, act: la, oppAct: wa, T };
    hit(g, W, L, { base: RULES.BASE, win: true, aAct: wa, dAct: la });
    if (wa.kind === 'skill') { const s = skillOf(W); if (s.rider) s.rider(cW); }
    if (W.f.onWin) W.f.onWin(cW);
    if (L.f.onLose) L.f.onLose(cL);
    if (la.kind === 'skill') { const s = skillOf(L); if (s.onSkillLose) s.onSkillLose(cL); if (L.f.onSkillLose) L.f.onSkillLose(cL); }
  } else if (kind === 'clash') {
    hit(g, P[0], P[1], { base: RULES.CLASH, clash: true, aAct: a0, dAct: a1 });
    hit(g, P[1], P[0], { base: RULES.CLASH, clash: true, aAct: a1, dAct: a0 });
  }
  if (kind === 'clash' || kind === 'whiff') for (let i = 0; i < 2; i++) {
    const p = P[i]; if (p.f.onTie) p.f.onTie({ g, me: p, opp: P[1 - i], act: acts[i], oppAct: acts[1 - i], T, kind });
  }
  // end of turn
  for (let i = 0; i < 2; i++) {
    const p = P[i];
    for (const b of p.burns) if (b.start <= T && b.left > 0 && p.hp > 0) { selfDmg(p, b.x); b.left--; }
    p.burns = p.burns.filter(b => b.left > 0);
  }
  for (let i = 0; i < 2; i++) {
    const p = P[i];
    p.hist.push({ kind: acts[i].kind, type: acts[i].type, res: res[i], T, oppSkill: acts[1 - i].kind === 'skill', fsk: kind });
    if (p.hist.length > 6) p.hist.shift();
    if (p.f.onTurnEnd) p.f.onTurnEnd({ g, me: p, opp: P[1 - i], act: acts[i], oppAct: acts[1 - i], T, res: res[i] });
    if (p.hp <= 0 && p.f.onLethal) p.f.onLethal({ g, me: p, T });
  }
  const ko0 = P[0].hp <= 0, ko1 = P[1].hp <= 0;
  if (ko0 || ko1) { g.over = true; g.winner = ko0 && ko1 ? -1 : ko0 ? 1 : 0; }
  g.T++;
  if (!g.over && g.T > RULES.TURN_LIMIT) { g.over = true; g.winner = -1; }
  return { winner, kind };
}

module.exports = { RULES, BEATS, makeRng, setStatus, active, gain, drain, heal, selfDmg, burn, charge, weaken,
  newGame, cloneGame, legalActions, resolve, skillOf, skillType, skillCost, last, wonLast, lostLast };

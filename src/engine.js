// Smash RPS Battler — core engine. Shared by the simulator and (later) the real game server.
'use strict';

const RULES = {
  HP: 100, BASE: 10, CLASH: 5, FS_DMG: 14, FS_COST: 8, ENDLAG: 0, METER_MAX: 8, TURN_LIMIT: 40, HIT_METER: 1,
  SKILL_TURN_HIT_METER: false, // no meter from taking hits on a turn you used your skill
  DODGE: true,                 // 5th action: offered when the opponent can Final Smash; loses to everything else
};
const BEATS = { A: 'G', G: 'C', C: 'A' }; // key beats value
const NAME = { A: 'Attack', C: 'Counter', G: 'Grab', FS: 'Final Smash' };

// ---------- RNG ----------
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------- event log (only for real games, not CPU lookahead clones) ----------
function emit(g, text) { if (g.events) g.events.push(text); }
// A unique effect firing: shown as a callout over that fighter during the reveal and starred in the log
function announce(g, p, text) { if (!g.events) return; g.events.push('★ ' + text); (g.announce = g.announce || []).push({ side: g.p.indexOf(p), text }); }
function who(g, p) { return nameOf(p); }
const STATUS_TXT = { stagger: 'Staggered', paralyze: 'Paralyzed', lock: 'Locked', armor: 'Armor' };

// ---------- status helpers ----------
// statuses live on p.st[name] = {from, until, v}
function setStatus(g, p, name, turns = 1, v = true) {
  if ((name === 'stagger' || name === 'lock') && (p.mem.unshakable || 0) > g.T) { emit(g, `${who(g, p)} shrugs it off.`); return; }
  if ((name === 'stagger' || name === 'paralyze') && p.f.immune) { emit(g, `${who(g, p)} is immune to ${STATUS_TXT[name]} (${p.f.passiveName}).`); return; }
  if (g.events) {
    const dur = turns > 1 ? ` for ${turns} turns` : ' next turn';
    const what = name === 'lock' ? `Locked out of ${({ A: 'Attack', C: 'Counter', G: 'Grab' })[v]}` : name === 'armor' ? `gains Armor ${v}` : STATUS_TXT[name];
    emit(g, `${who(g, p)} ${name === 'armor' ? what : 'is ' + what}${dur}${g.src ? ` (${g.src})` : ''}.`);
  }
  const from = g.T + 1, until = g.T + turns;
  const cur = p.st[name];
  if (cur && cur.until >= from && name !== 'lock' && name !== 'armor') { cur.until = Math.max(cur.until, until); return; }
  if (name === 'armor' && cur && cur.until >= from) { cur.v = Math.max(cur.v, v); cur.until = Math.max(cur.until, until); return; }
  p.st[name] = { from, until, v };
}
function active(p, name, T) { const s = p.st[name]; return s && s.from <= T && s.until >= T ? s : null; }

function gain(g, p, n, quiet) {
  if (n <= 0) return;
  if (active(p, 'paralyze', g.T)) { if (!quiet) emit(g, `${who(g, p)} is Paralyzed and gains no meter.`); return; }
  const before = p.meter;
  p.meter = Math.min(RULES.METER_MAX, p.meter + n);
  if (!quiet && g.src && p.meter > before) { emit(g, `${who(g, p)} gains ${p.meter - before} meter (${g.src}).`); if (!g.srcP || g.srcP === p) ustat(g, p, `Meter from ${g.src}`, p.meter - before); }
}
function drain(p, n, g) {
  const t = Math.min(n, p.meter); p.meter -= t;
  if (g && t) emit(g, `${who(g, p)} loses ${t} meter${g.src ? ` (${g.src})` : ''}.`);
}
function stat(g, p) { return g && g.stats ? g.stats[g.p.indexOf(p)] : null; }
// fighter-specific stat counters, shown in the post-battle "Fighter mechanics" section
function ustat(g, p, key, n = 1) { const st = stat(g, p); if (!st || !n) return; st.unique = st.unique || {}; st.unique[key] = (st.unique[key] || 0) + n; }
function heal(p, n, g) {
  if (p.hp <= 0) return; const b = p.hp; p.hp = Math.min(p.maxHp, p.hp + n);
  const st = stat(g, p); if (st) { st.healed += p.hp - b; if (g.src) ustat(g, p, `HP healed by ${g.src}`, p.hp - b); }
  if (g && p.hp > b) emit(g, `${who(g, p)} heals ${p.hp - b} HP${g.src ? ` (${g.src})` : ''}.`);
}
// recoil / burn / trap damage (not a "hit")
function selfDmg(p, n, g, why, owner) { p.hp -= n; p.dmgTurn += n; const st = stat(g, p); if (st) st.otherTaken += n;
  const by = owner || (g && g.srcP); if (g && by && by !== p) ustat(g, by, ['Burn', 'Poison', 'Frostbite'].includes(why) ? `${why} damage dealt` : `Damage from ${why || g.src}`, n); else if (g && g.src && !['Burn', 'Poison', 'Frostbite'].includes(why)) ustat(g, p, `Recoil taken (${g.src})`, n); if (g) emit(g, `${who(g, p)} takes ${n} damage (${why || g.src || 'effect'}).`); }
const DOT = { burn: ['Burned', 'Burn'], poison: ['Poisoned', 'Poison'], freeze: ['Frozen', 'Frostbite'] };
function burn(g, p, x, turns, kind = 'burn') { p.burns.push({ x, left: turns, start: g.T + 1, by: g.srcP ? g.p.indexOf(g.srcP) : -1, kind }); emit(g, `${who(g, p)} is ${DOT[kind][0]}: ${x} damage at the end of the next ${turns > 1 ? turns + ' turns' : 'turn'}${g.src ? ` (${g.src})` : ''}.`); }
function charge(p, n, g) { if (n > p.charge) { p.charge = n; if (g) emit(g, `${who(g, p)} gains Charge ${n}: next win deals +${n}${g.src ? ` (${g.src})` : ''}.`); } }
function weaken(p, n, g) { if (n > p.weaken) { p.weaken = n; if (g) emit(g, `${who(g, p)} is Weakened ${n}: next win deals ${n} less${g.src ? ` (${g.src})` : ''}.`); } }

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
  if (RULES.DODGE && (o.meter >= RULES.FS_COST || o.f.hiddenMeter)) acts.push({ kind: 'dodge', type: 'D' });
  return acts;
}

// ---------- hits ----------
function hook(p, name, ...a) { const fn = p.f[name]; return fn ? (fn(...a) || 0) : 0; }
// run a fighter hook with its passive (or skill) name as the event source
function withSrc(g, src, fn, owner) { const prev = g.src, prevP = g.srcP; g.src = src; if (owner) g.srcP = owner; try { return fn(); } finally { g.src = prev; g.srcP = prevP; } }
function part(parts, label, v, owner) { if (parts && v) parts.push({ label, v, owner }); }
const fmtPart = x => x.text || `${x.v > 0 ? '+' : '−'}${Math.abs(x.v)} ${x.label}`;

function hit(g, att, def, o) {
  // o: {base, win, clash, fs, aAct, dAct, ignoreArmor}
  const c = { g, me: att, opp: def, act: o.aAct, oppAct: o.dAct, T: g.T };
  const dc = { g, me: def, opp: att, act: o.dAct, oppAct: o.aAct, T: g.T, win: o.win, clash: o.clash };
  const parts = (g.events || g.stats) ? [] : null;
  const AP = att.f.passiveName, DP = def.f.passiveName;
  let d = o.base, v;
  if (o.win) {
    if (o.aAct.kind === 'skill') {
      const s = skillOf(att);
      const sn = skillName(att); v = s.bonus ? withSrc(g, sn, () => s.bonus(c), att) : 0; d += v; part(parts, sn, v, 'a');
      if (s.ignoreArmor) o.ignoreArmor = true;
    }
    v = withSrc(g, AP, () => hook(att, 'winBonus', c), att); d += v; part(parts, AP, v, 'a');
    if (att.charge) { d += att.charge; part(parts, 'Charge', att.charge, 'a'); att.charge = 0; }
    if (att.weaken) { if (!o.ignoreArmor) { d -= att.weaken; part(parts, 'Weaken', -att.weaken); } att.weaken = 0; }
    if (o.dAct.kind === 'skill') {
      const ds = skillOf(def);
      v = ds.endlag ?? def.f.endlag ?? RULES.ENDLAG; d += v; part(parts, 'Endlag', v);
      v = hook(att, 'punishBonus', c); d += v; part(parts, AP, v, 'a');
    }
    v = hook(def, 'vuln', dc); d += v; part(parts, DP, v, 'd');
    if (att.mem.double > 0) { const b0 = d; d *= 2; att.mem.double--; if (parts) parts.push({ text: `×2 ${AP}`, label: AP, v: b0, owner: 'a' }); }
  }
  if (o.clash) {
    v = hook(att, 'clashDealt', c); d += v; part(parts, AP, v, 'a');
    v = hook(def, 'clashTaken', dc); if (v < -50) { if (parts) parts.push({ text: `blocked by ${DP}`, label: DP, v: -Math.max(0, d), owner: 'd' }); } else part(parts, DP, v, 'd'); d += v;
  }
  v = hook(att, 'hitBonus', c); d += v; part(parts, AP, v, 'a');
  if (!o.fs || !o.ignoreArmor) {
    if (!o.ignoreArmor) { const ar = active(def, 'armor', g.T); if (ar) { const m = o.armorMult || 1; d -= ar.v * m; part(parts, 'Armor', -ar.v * m); } }
    if (def.f.reduce) { const b = d; d = def.f.reduce(dc, d); if (parts && d !== b) parts.push({ label: DP, v: d - b, owner: 'd', absorb: def.f.id === 'krool' }); }
    v = hook(def, 'takeMod', dc); d += v; part(parts, DP, v, 'd');
  }
  d = Math.max(0, Math.round(d));
  if (def.f.absorb) { const b = d; d = withSrc(g, DP, () => def.f.absorb(dc, d)); if (b !== d && parts) parts.push({ text: `${DP} absorbs ${b - d}`, label: DP, v: -(b - d), owner: 'd', absorb: true }); }
  def.hp -= d; def.dmgTurn += d;
  if (g.stats) {
    const a = stat(g, att), b = stat(g, def);
    a.dealt += d; b.hitTaken += d;
    if (d > a.biggest) { a.biggest = d; a.biggestWith = o.fs ? fsNameOf(att) : o.aAct.kind === 'skill' ? skillName(att) : o.clash ? 'Clash' : NAME[o.aAct.type]; a.biggestTurn = g.T; }
    if (o.fs) a.fsDamage += d;
    for (const x of parts) {
      if (x.owner === 'a' && x.v > 0 && x.label !== 'Charge') ustat(g, att, `${x.label} bonus damage`, x.v);
      if (x.owner === 'a' && x.label === 'Charge') ustat(g, att, 'Charge bonus damage', x.v);
      if (x.owner === 'd' && x.v < 0) ustat(g, def, x.absorb ? `Damage absorbed by ${x.label}` : `Damage blocked by ${x.label}`, -x.v);
      if (x.owner === 'd' && x.v > 0) ustat(g, def, `Extra damage taken (${x.label})`, x.v);
    }
  }
  if (g.events) {
    const label = o.fs ? 'FINAL SMASH' : o.clash ? 'clash' : 'hit';
    emit(g, `${nameOf(att)}'s ${o.fs ? fsNameOf(att) : label} deals ${d} to ${nameOf(def)}${parts.length ? ` (${o.base} base ${parts.map(fmtPart).join(' ')})` : ''}.`);
  }
  if (d > 0) { if (RULES.SKILL_TURN_HIT_METER || !o.dAct || o.dAct.kind !== 'skill') gain(g, def, RULES.HIT_METER, true); if (def.f.onHit) withSrc(g, DP, () => def.f.onHit(dc, d)); }
  return d;
}

// ---------- Final Smash ----------
// Each fighter's f.fs = { dmg: number | c => number, ignoreArmor, armorMult, rider(c) }. Dodge avoids all of it.
function finalSmash(g, att, def, aAct, dAct) {
  const fs = att.f.fs || { dmg: RULES.FS_DMG };
  if (dAct.kind === 'dodge') {
    announce(g, def, `${nameOf(def)} dodged ${fsNameOf(att)}!`);
    const st = stat(g, def); if (st) st.fsDodged = (st.fsDodged || 0) + 1; ustat(g, def, 'Final Smashes dodged');
    return;
  }
  const c = { g, me: att, opp: def, act: aAct, oppAct: dAct, T: g.T };
  const base = typeof fs.dmg === 'function' ? fs.dmg(c) : fs.dmg;
  hit(g, att, def, { base, fs: true, aAct, dAct, ignoreArmor: !!fs.ignoreArmor, armorMult: fs.armorMult || 1 });
  if (fs.rider && def.hp > -999) withSrc(g, fsNameOf(att), () => fs.rider(c), att);
}

// ---------- resolve one turn ----------
// Pyra/Mythra's Final Smash depends on who is out
// Display name follows the active form (Pyra/Mythra) or Pokémon (Pokémon Trainer)
function nameOf(p) {
  if (p.f.id === 'pyra') return (p.mem.form || 'P') === 'P' ? 'Pyra' : 'Mythra';
  if (p.f.id === 'pt') return ['Squirtle', 'Ivysaur', 'Charizard'][p.mem.poke || 0];
  return p.f.name;
}
// Skill name for the active form: Pyra's Prominence Revolt / Mythra's Foresight
function skillName(p) {
  const n = skillOf(p).name;
  if (n === 'Prominence Revolt / Foresight') return (p.mem.form || 'P') === 'P' ? 'Prominence Revolt' : 'Foresight';
  return n;
}
function fsNameOf(p) { if (p.f.id === 'pyra') return (p.mem.form || 'P') === 'P' ? 'Burning Sword' : 'Sacred Arrow'; return p.f.fsName || 'Final Smash'; }
function resolve(g, acts) {
  const T = g.T, P = g.p;
  const res = ['tie', 'tie'];
  const S = (p, fn) => withSrc(g, p.f.passiveName, fn, p);
  for (let i = 0; i < 2; i++) {
    const p = P[i], o = P[1 - i], a = acts[i];
    p.dmgTurn = 0;
    if (a.kind === 'skill') {
      const cost = skillCost(g, p, o); p.meter -= cost; const s = skillOf(p);
      emit(g, `${nameOf(p)} spends ${cost} meter on ${skillName(p)}.`); if (o.f.taxOpp) ustat(g, o, `Extra meter paid by opponent (${o.f.passiveName})`, o.f.taxOpp);
      if (s.onUse) withSrc(g, skillName(p), () => s.onUse({ g, me: p, opp: o, act: a, oppAct: acts[1 - i], T }), p);
    } else if (a.kind === 'fs') { emit(g, `${nameOf(p)} unleashes a FINAL SMASH: ${fsNameOf(p)}!`); p.meter = 0; }
  }
  for (let i = 0; i < 2; i++) {
    const p = P[i], o = P[1 - i];
    if (acts[i].kind === 'basic') gain(g, p, 1, true);
    if (p.f.turnMeter) S(p, () => gain(g, p, p.f.turnMeter({ g, me: p, opp: o, T, act: acts[i] })));
    if (acts[1 - i].kind === 'skill' && p.f.onOppSkill) S(p, () => p.f.onOppSkill({ g, me: p, opp: o, T }));
  }
  const [a0, a1] = acts;
  let winner = -1, kind = 'none', priority = false, outright = false;
  if (a0.kind === 'fs' || a1.kind === 'fs') {
    kind = 'fs';
    for (const i of [0, 1]) if (acts[i].kind === 'fs') finalSmash(g, P[i], P[1 - i], acts[i], acts[1 - i]);
  } else if (a0.kind === 'dodge' || a1.kind === 'dodge') {
    if (a0.kind === 'dodge' && a1.kind === 'dodge') kind = 'whiff';
    else { winner = a0.kind === 'dodge' ? 1 : 0; emit(g, `${nameOf(P[1 - winner])} dodged, but there was no Final Smash to avoid.`); }
  } else if (a0.type === a1.type) {
    if (a0.kind !== a1.kind) { winner = a0.kind === 'skill' ? 0 : 1; priority = true; }          // Priority
    else if (a0.type === 'A') {
      const w0 = a0.kind === 'skill' && skillOf(P[0]).clashWin, w1 = a1.kind === 'skill' && skillOf(P[1]).clashWin;
      if (w0 && !w1) { winner = 0; outright = true; } else if (w1 && !w0) { winner = 1; outright = true; } else kind = 'clash';
    } else kind = 'whiff';
  } else winner = BEATS[a0.type] === a1.type ? 0 : 1;

  if (winner >= 0) {
    kind = 'win';
    const W = P[winner], L = P[1 - winner], wa = acts[winner], la = acts[1 - winner];
    res[winner] = 'win'; res[1 - winner] = 'lose';
    if (priority) emit(g, `Priority: ${nameOf(W)}'s skill beats a basic ${NAME[wa.type]}.`);
    else if (outright) emit(g, `${nameOf(W)}'s ${skillName(W)} wins the clash outright.`);
    else emit(g, `${NAME[wa.type]} beats ${NAME[la.type]}: ${nameOf(W)} wins the exchange.`);
    const cW = { g, me: W, opp: L, act: wa, oppAct: la, T };
    const cL = { g, me: L, opp: W, act: la, oppAct: wa, T };
    hit(g, W, L, { base: RULES.BASE, win: true, aAct: wa, dAct: la });
    if (wa.kind === 'skill') { const s = skillOf(W); if (s.rider) withSrc(g, skillName(W), () => s.rider(cW), W); }
    if (W.f.onWin) S(W, () => W.f.onWin(cW));
    if (L.f.onLose) S(L, () => L.f.onLose(cL));
    if (la.kind === 'skill') { const s = skillOf(L); emit(g, `${nameOf(L)}'s ${skillName(L)} was read.`); if (s.onSkillLose) s.onSkillLose(cL); if (L.f.onSkillLose) S(L, () => L.f.onSkillLose(cL)); }
  } else if (kind === 'clash') {
    emit(g, 'Attack vs Attack: CLASH!');
    hit(g, P[0], P[1], { base: RULES.CLASH, clash: true, aAct: a0, dAct: a1 });
    hit(g, P[1], P[0], { base: RULES.CLASH, clash: true, aAct: a1, dAct: a0 });
  } else if (kind === 'whiff') emit(g, `${NAME[a0.type]} vs ${NAME[a1.type]}: whiff, nothing happens.`);
  if (kind === 'clash' || kind === 'whiff') for (let i = 0; i < 2; i++) {
    const p = P[i]; if (p.f.onTie) S(p, () => p.f.onTie({ g, me: p, opp: P[1 - i], act: acts[i], oppAct: acts[1 - i], T, kind }));
  }
  // end of turn
  for (let i = 0; i < 2; i++) {
    const p = P[i];
    for (const b of p.burns) if (b.start <= T && b.left > 0 && p.hp > 0) { selfDmg(p, b.x, g, DOT[b.kind || 'burn'][1], b.by >= 0 ? g.p[b.by] : null); b.left--; }
    p.burns = p.burns.filter(b => b.left > 0);
  }
  for (let i = 0; i < 2; i++) {
    const p = P[i];
    p.hist.push({ kind: acts[i].kind, type: acts[i].type, res: res[i], T, oppSkill: acts[1 - i].kind === 'skill', fsk: kind });
    if (p.hist.length > 6) p.hist.shift();
    if (p.f.onTurnEnd) S(p, () => p.f.onTurnEnd({ g, me: p, opp: P[1 - i], act: acts[i], oppAct: acts[1 - i], T, res: res[i] }));
    if (p.hp <= 0 && p.f.onLethal) S(p, () => p.f.onLethal({ g, me: p, T }));
  }
  const ko0 = P[0].hp <= 0, ko1 = P[1].hp <= 0;
  if (ko0 || ko1) { g.over = true; g.winner = ko0 && ko1 ? -1 : ko0 ? 1 : 0; }
  g.T++;
  if (!g.over && g.T > RULES.TURN_LIMIT) { g.over = true; g.winner = -1; emit(g, 'Turn limit reached: draw.'); }
  return { winner, kind };
}

module.exports = { RULES, BEATS, makeRng, setStatus, active, gain, drain, heal, selfDmg, burn, charge, weaken,
  newGame, cloneGame, emit, announce, withSrc, finalSmash, fsNameOf, nameOf, skillName, ustat, legalActions, resolve, skillOf, skillType, skillCost, last, wonLast, lostLast };

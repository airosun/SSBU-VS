// What each player is allowed to see: sides, resources, and the turn reveal.
'use strict';
const E = require('./engine');
const { N } = require('./fighters');

const TYPE = { A: 'Attack', C: 'Counter', G: 'Grab', FS: 'Final Smash' };
const POKE = ['Squirtle', 'Ivysaur', 'Charizard'];

// Resource widgets, one spec per fighter resource. The client draws each `kind` (public/widgets.js).
const nextMultiple = (T, n) => Math.ceil(T / n) * n;
const FRUITS = ['Cherry', 'Strawberry', 'Orange', 'Apple', 'Melon', 'Galaxian', 'Bell', 'Key'];

function resources(p, o, g) {
  const m = p.mem, T = g.T, R = [];
  const once = (label, icon, state, extra = {}) => R.push({ kind: 'once', label, icon, state, ...extra });
  const cond = (label, icon, on, hint) => R.push({ kind: 'cond', label, icon, on: !!on, hint });
  const countdown = (label, icon, every, what) => R.push({ kind: 'countdown', label, icon, now: T % every === 0, turns: nextMultiple(T, every) - T, what });
  switch (p.f.id) {
    case 'samus': R.push({ kind: 'segbar', style: 'samus', label: 'Charge Shot', value: m.cs || 0, max: 5 }); break;
    case 'wario': R.push({ kind: 'segbar', style: 'waft', label: 'Waft', value: m.gas || 0, max: 5 }); break;
    case 'inkling': R.push({ kind: 'segbar', style: 'ink', label: 'Ink on opponent', value: m.ink || 0, max: 3 }); break;
    case 'cloud': R.push({ kind: 'bar', style: 'limit', label: 'Limit', value: m.limit ? 20 : m.acc || 0, max: 20, text: m.limit ? 'LIMIT BREAK READY' : null }); break;
    case 'joker': R.push((m.ars || 0) >= T
      ? { kind: 'bar', style: 'arsene', label: 'Arsene', value: m.ars - T + 1, max: 4, text: `ARSENE · ${m.ars - T + 1} turns left` }
      : { kind: 'bar', style: 'rebellion', label: 'Rebellion', value: m.acc || 0, max: 30 }); break;
    case 'rosa': R.push({ kind: 'luma', hp: m.luma, max: N.rosa.luma, back: m.luma > 0 ? 0 : Math.max(0, N.rosa.re - (T - 1 - m.down)) }); break;
    case 'krool': R.push({ kind: 'belly', value: m.belly, max: 20, back: m.belly ? 0 : Math.max(0, 5 - (T - 1 - m.broke)) }); break;
    case 'pacman': { const n = Math.min(8, T - (m.lt || 0)); R.push({ kind: 'fruit', idx: n - 1, name: FRUITS[n - 1], bonus: n });
      once('Power Pellet', 'pellet', m.ppu ? 'used' : 'ready'); break; }
    case 'banjo': R.push({ kind: 'icons', label: 'Golden Feathers', icon: 'img:golden_feather', value: m.feathers ?? 5, max: 5, mode: 'remove' }); break;
    case 'mac': R.push({ kind: 'icons', label: 'KO Stars', icon: 'star', value: m.ko || 0, max: 2, color: '#e5413a' }); break;
    case 'megaman': R.push({ kind: 'icons', label: 'Weapon Get', icon: 'dot', value: m.wg || 0, max: 3, color: '#ffd23f' }); break;
    case 'lucario': R.push({ kind: 'icons', label: 'Aura', icon: 'flame', value: Math.min(4, Math.floor((p.maxHp - p.hp) / 20)), max: 4, color: '#3d8bfd' }); break;
    case 'falcon': R.push({ kind: 'icons', label: 'Attack streak', icon: 'tally', value: Math.min(3, m.st || 0), max: 3, color: '#ff7a1a' }); break;
    case 'olimar': R.push({ kind: 'pikmin', label: 'Pikmin', colors: (m.pc || []).slice(0, m.pik || 0), max: 3 }); break;
    case 'villager': R.push({ kind: 'villager', saplings: Math.min(3, m.tu || 0), max: 3, pocket: m.pocket || 0, from: m.pocketFrom || '' }); break;
    case 'steve': R.push({ kind: 'tier', tier: m.tier || 0, names: ['Wood', 'Stone', 'Iron', 'Diamond'], next: (m.tier || 0) < 3 ? nextMultiple(T, 4) : null }); break;
    case 'hero': { const lv = Math.min(3, Math.floor((T - 1) / 5));
      R.push({ kind: 'hero', level: lv, xp: lv >= 3 ? 5 : (T - 1) % 5, xpMax: 5, levelUp: T > 1 && (T - 1) % 5 === 0 && (T - 1) / 5 <= 3 }); break; }
    case 'wft': { const h = p.hist.slice(-3).map(x => x.type).filter(t => t !== 'FS'); R.push({ kind: 'routine', acts: h, ready: !!m.br }); break; }
    case 'sora': R.push({ kind: 'spell', spell: ['firaga', 'blizzaga', 'thundaga'][m.spn || 0] });
      once('Second Chance', 'img:sora-icon', m.sc ? 'used' : 'ready'); break;
    case 'shulk': R.push({ kind: 'art', art: p.mem.artPick || null }); break;
    case 'ics': once('Nana', 'img:ice-climbers-icon', m.nanaLost ? 'used' : 'ready', { readyText: 'With you', usedText: 'Lost' }); break;
    case 'peach': countdown('Turnip Pull', 'img:stitch', 4, 'Stitchface'); break;
    case 'tlink': countdown('Bomb Bag', 'img:bomb', 3, 'Bomb'); break;
    case 'isabelle': countdown('Lloid Trap', 'img:lloid', 4, 'Lloid Rocket'); break;
    case 'zelda': once('Phantom Guard', 'shield', m.pg ? 'used' : 'ready'); break;
    case 'doc': once('Megavitamin', 'pill', m.mv ? 'used' : 'ready', { colors: m.pill || ['red', 'blue'] }); break;
    case 'chrom': once('Exalted Prince', 'crown', m.ep ? 'used' : 'ready'); break;
    case 'richter': once("Hunter's Resolve", 'cross', m.hr === 2 ? 'used' : m.hr === 1 ? 'active' : 'ready'); break;
    case 'byleth': once('Divine Pulse', 'eye', m.dp ? 'used' : 'ready'); break;
    case 'kazuya': once('Rage Drive', 'img:devil-gene', m.rd ? 'used' : 'ready'); break;
    case 'seph': cond('One-Winged Angel', 'wing', o.hp - p.hp >= 30, 'Active when 30+ HP behind'); break;
    case 'terry': cond('GO!', 'go', p.hp < 40, 'Active below 40 HP'); break;
    case 'dsamus': cond('Phazon Overload', 'plasma', p.meter >= 4, 'Active at 4+ meter'); break;
    case 'link': cond('Sword Beam', 'sword', p.hp >= 80, 'Active at 80+ HP'); break;
  }
  return R;
}

// Effects drawn on the HP bar or portrait rather than in the resource area
function effects(p, o, g, viewerIsP, viewerIsO) {
  const fx = { hp: null, marks: [] };
  if (p.f.id === 'kazuya' && p.hp < 35) fx.hp = 'rage';
  if (p.f.id === 'daisy' && p.hp < 50) fx.hp = 'glow';
  if (p.f.id === 'joker' && (p.mem.ars || 0) >= g.T) fx.summon = 'arsene';   // Arsene appears beside Joker
  if (o.f.id === 'wolf' && p.hp < 50) fx.marks.push('crosshair');          // Wolf's Predator targets this side
  if (o.f.id === 'snake' && o.mem.c4 && viewerIsO) fx.marks.push('c4');    // only Snake's player sees the C4
  return fx;
}

// Structured effects for the portrait indicators (debuffs first)
function effectList(p, g) {
  const T = g.T, out = [];
  // damage over time, split by look: Burn (orange), Poison (purple), Frozen (light blue)
  for (const [kind, name] of [['burn', 'Burn'], ['poison', 'Poison'], ['freeze', 'Frozen']]) {
    const bs = p.burns.filter(b => (b.kind || 'burn') === kind); if (!bs.length) continue;
    const total = bs.reduce((a, b) => a + b.x * b.left, 0), per = bs.reduce((a, b) => a + b.x, 0);
    out.push({ id: kind, debuff: true, n: per, tip: `${name}: ${bs.map(b => `${b.x} × ${b.left} turn${b.left > 1 ? 's' : ''}`).join(', ')} (${total} total)` });
  }
  if (p.weaken) out.push({ id: 'weaken', debuff: true, n: p.weaken, tip: `Weakened: next win deals ${p.weaken} less` });
  if (E.active(p, 'stagger', T)) out.push({ id: 'stagger', debuff: true, tip: "Staggered: can't use their skill this turn" });
  if (E.active(p, 'paralyze', T)) out.push({ id: 'paralyze', debuff: true, tip: 'Paralyzed: gains no meter this turn' });
  const l = E.active(p, 'lock', T); if (l) out.push({ id: 'lock', debuff: true, n: l.v, tip: `Locked: can't choose ${TYPE[l.v]} this turn` });
  if ((p.mem.wman || 0) >= T) out.push({ id: 'warioman', debuff: false, n: p.mem.wman - T + 1, tip: `Wario-Man: wins deal +3 (${p.mem.wman - T + 1} turn${p.mem.wman - T ? 's' : ''} left)` });
  if (p.charge) out.push({ id: 'charge', debuff: false, n: p.charge, tip: `Charge: next win deals +${p.charge}` });
  const a = E.active(p, 'armor', T); if (a) out.push({ id: 'armor', debuff: false, n: a.v, tip: `Armor: takes ${a.v} less damage from hits (until turn ${a.until})` });
  return out;
}

function statuses(p, g) {
  const T = g.T, s = [];
  if (E.active(p, 'stagger', T)) s.push('Staggered');
  if (E.active(p, 'paralyze', T)) s.push('Paralyzed');
  const l = E.active(p, 'lock', T); if (l) s.push(`Locked: ${TYPE[l.v]}`);
  const a = E.active(p, 'armor', T); if (a) s.push(`Armor ${a.v}`);
  if (p.charge) s.push(`Charge +${p.charge}`);
  if (p.weaken) s.push(`Weakened −${p.weaken}`);
  for (const b of p.burns) s.push(`Burn ${b.x} ×${b.left}`);
  return s;
}

function art(p) {
  if (p.f.id === 'pt') return `pt-${POKE[p.mem.poke || 0].toLowerCase()}`;
  if (p.f.id === 'pyra') return (p.mem.form || 'P') === 'P' ? 'pyra-pyra' : 'pyra-mythra';
  return p.f.id;
}

function side(g, i, self) {
  const p = g.p[i], o = g.p[1 - i];
  const sk = E.skillOf(p);
  const hidden = !self && p.f.hiddenMeter;
  const res = resources(p, o, g);
  return {
    id: p.f.id, art: art(p), name: E.nameOf(p), fs: E.fsNameOf(p), passive: p.f.passiveName, hp: Math.max(0, p.hp), maxHp: p.maxHp,
    meter: hidden ? null : p.meter, meterMax: E.RULES.METER_MAX,
    skill: { name: E.skillName(p), type: E.skillType(p, g), cost: hidden ? null : E.skillCost(g, p, o), copied: !!p.copy, copiedFrom: p.copy ? (require('./fighters').FIGHTERS.find(f => f.skill === p.copy) || {}).id : null, protean: p.f.id === 'greninja' },
    fx: effects(p, o, g, self, !self),
    statuses: statuses(p, g), effects: effectList(p, g), resources: res,
  };
}

// Why the skill can't be used right now (null = usable)
function skillBlock(g, i) {
  const p = g.p[i], o = g.p[1 - i], T = g.T, sk = E.skillOf(p), type = E.skillType(p, g), cost = E.skillCost(g, p, o);
  if (E.active(p, 'stagger', T)) return 'Staggered';
  const l = E.active(p, 'lock', T); if (l && l.v === type) return `${TYPE[type]} locked`;
  if (sk.can && !sk.can(p, o, g)) return p.f.id === 'banjo' ? 'No feathers left' : 'Unavailable';
  if (p.meter < cost) return `Needs ${cost} meter`;
  return null;
}

function view(g, seat, pending, reveal) {
  let rv = null;
  if (reveal) {
    const flip = seat === 1;
    const pick = a => (flip ? [a[1], a[0]] : a);
    const hideMeter = (arr, i) => arr.map((v, k) => (k !== seat && g.p[k].f.hiddenMeter ? null : v));
    rv = {
      turn: reveal.turn, kind: reveal.kind,
      winner: reveal.winner < 0 ? -1 : reveal.winner === seat ? 'me' : 'opp',
      acts: pick(reveal.acts),
      before: { hp: pick(reveal.before.hp), meter: pick(hideMeter(reveal.before.meter)) },
      events: reveal.events,
      announce: (reveal.announce || []).map(a => ({ side: a.side === seat ? 'me' : 'opp', text: a.text })),
    };
  }
  return {
    turn: g.T, over: g.over, winner: g.winner, seat,
    me: side(g, seat, true), opp: side(g, 1 - seat, false),
    actions: g.over ? [] : E.legalActions(g, seat),
    skillBlocked: g.over ? null : skillBlock(g, seat),
    waiting: !!pending[seat], oppReady: !!pending[1 - seat],
    shulk: g.p[seat].f.id === 'shulk', pulse: g.p[seat].f.id === 'byleth' && !g.p[seat].mem.dp, reveal: rv,
  };
}

function actLabel(p, a) {
  if (a.kind === 'fs') return { title: E.fsNameOf(p), sub: 'FINAL SMASH', type: 'FS' };
  if (a.kind === 'dodge') return { title: 'Dodge', sub: 'Avoids Final Smashes', type: 'D' };
  if (a.kind === 'skill') return { title: E.skillName(p), sub: `${TYPE[a.type]} skill`, type: a.type };
  return { title: TYPE[a.type], sub: 'Basic', type: a.type };
}

module.exports = { view, actLabel };

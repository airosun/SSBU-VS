// What each player is allowed to see: sides, resources, and the turn reveal.
'use strict';
const E = require('./engine');
const { N } = require('./fighters');

const TYPE = { A: 'Attack', C: 'Counter', G: 'Grab', FS: 'Final Smash' };
const POKE = ['Squirtle', 'Ivysaur', 'Charizard'];

// Resource widgets. kind: 'bar' (value/max), 'pips' (value/max), 'text', 'flag' (on/off)
const bar = (label, value, max, extra = {}) => ({ kind: 'bar', label, value, max, ...extra });
const pips = (label, value, max, extra = {}) => ({ kind: 'pips', label, value, max, ...extra });
const text = (label, value, extra = {}) => ({ kind: 'text', label, value, ...extra });
const flag = (label, on, onText, offText) => ({ kind: 'flag', label, on: !!on, value: on ? onText : offText });
const nextMultiple = (T, n) => Math.ceil(T / n) * n;

function resources(p, o, g) {
  const m = p.mem, T = g.T, R = [];
  switch (p.f.id) {
    case 'samus': R.push(bar('Charge Shot', m.cs || 0, 5, { ready: (m.cs || 0) >= 5 })); break;
    case 'wario': R.push(bar('Waft', m.gas || 0, 5, { ready: (m.gas || 0) >= 5, readyText: 'FULL — next Attack win' })); break;
    case 'olimar': R.push(pips('Pikmin', m.pik || 0, 3)); break;
    case 'pt': R.push(text('Active Pokémon', POKE[m.poke || 0], { sub: `${['Counter', 'Grab', 'Attack'][m.poke || 0]} wins +${N.pt.p}` })); break;
    case 'mac': R.push(pips('KO Stars', m.ko || 0, 2, { sub: `KO Uppercut costs ${Math.max(1, 3 - (m.ko || 0))}` })); break;
    case 'rosa': R.push(m.luma > 0 ? bar('Luma', m.luma, N.rosa.luma) : text('Luma', `Back in ${Math.max(0, N.rosa.re - (T - 1 - m.down))} turns`, { dim: true })); break;
    case 'krool': R.push(bar('Belly Armor', m.belly, 20, { sub: m.belly ? '' : `Reforms in ${Math.max(0, 5 - (T - 1 - m.broke))} turns` })); break;
    case 'inkling': R.push(pips('Ink on opponent', m.ink || 0, 3)); break;
    case 'steve': R.push(pips('Tools', m.tier || 0, 3, { sub: ['Wood', 'Stone', 'Iron', 'Diamond'][m.tier || 0] + ` · next upgrade turn ${nextMultiple(T, 4)}` })); break;
    case 'banjo': R.push(pips('Golden Feathers', m.feathers ?? 5, 5)); break;
    case 'megaman': R.push(pips('Weapon Get', m.wg || 0, 3)); break;
    case 'cloud': R.push(m.limit ? bar('Limit', 20, 20, { ready: true, readyText: 'LIMIT BREAK READY' }) : bar('Limit', m.acc || 0, 20)); break;
    case 'joker': R.push((m.ars || 0) >= T ? bar('Arsene', m.ars - T + 1, 4, { ready: true, readyText: 'ARSENE IS OUT' }) : bar('Rebellion', m.acc || 0, 30)); break;
    case 'pyra': R.push(text('Active', (m.form || 'P') === 'P' ? 'Pyra' : 'Mythra', { sub: (m.form || 'P') === 'P' ? 'Skill: Attack' : 'Skill: Counter' })); break;
    case 'greninja': R.push(text('Protean', `Skill is ${TYPE[m.lb || 'A']}`)); break;
    case 'villager': R.push(text('Pocket', m.pocket ? `+${m.pocket} stored` : 'Empty')); R.push(pips('Timber growth', Math.min(3, m.tu || 0), 3)); break;
    case 'snake': R.push(flag('C4', m.c4, 'PLANTED', 'Not planted')); break;
    case 'ics': R.push(flag('Nana', !m.nanaLost, 'With you', 'Lost')); break;
    case 'falcon': R.push(pips('Attack streak', Math.min(3, m.st || 0), 3)); break;
    case 'kirby': R.push(text('Copy Ability', p.copy ? p.copy.name : 'None')); break;
    case 'sora': R.push(text('Next spell', ['Firaga', 'Blizzaga', 'Thundaga'][m.spn || 0])); R.push(flag('Second Chance', !m.sc, 'Ready', 'Used')); break;
    case 'pacman': R.push(bar('Bonus Fruit', Math.min(8, T - (m.lt || 0)), 8)); R.push(flag('Power Pellet', !m.ppu, 'Ready', 'Used')); break;
    case 'hero': R.push(pips('Level', Math.min(3, Math.floor((T - 1) / 5)), 3, { sub: `next level turn ${Math.min(16, 5 * (Math.floor((T - 1) / 5) + 1) + 1)}` })); break;
    case 'peach': R.push(text('Turnip Pull', T % 4 === 0 ? 'STITCHFACE THIS TURN' : `Stitchface on turn ${nextMultiple(T, 4)}`, { ready: T % 4 === 0 })); break;
    case 'tlink': R.push(text('Bomb Bag', T % 3 === 0 ? 'BOMB THIS TURN' : `Bomb on turn ${nextMultiple(T, 3)}`, { ready: T % 3 === 0 })); break;
    case 'isabelle': R.push(text('Lloid Trap', T % 4 === 0 ? 'ARMED THIS TURN' : `Armed on turn ${nextMultiple(T, 4)}`, { ready: T % 4 === 0 })); break;
    case 'wft': { const h = p.hist.slice(-3).map(x => x.type).filter(t => t !== 'FS'); R.push(m.br ? flag('Balanced Routine', true, 'READY', '') : pips('Routine', new Set(h).size, 3)); break; }
    case 'shulk': R.push(text('Monado Art', p.mem.artPick ? p.mem.artPick[0].toUpperCase() + p.mem.artPick.slice(1) : 'Auto')); break;
    case 'zelda': R.push(flag('Phantom Guard', !m.pg, 'Ready', 'Used')); break;
    case 'doc': R.push(flag('Megavitamin', !m.mv, 'Ready', 'Used')); break;
    case 'chrom': R.push(flag('Exalted Prince', !m.ep, 'Ready', 'Used')); break;
    case 'richter': R.push(flag("Hunter's Resolve", m.hr !== 2, m.hr === 1 ? 'ACTIVE' : 'Ready', 'Used')); break;
    case 'byleth': R.push(flag('Divine Pulse', !m.dp, 'Ready', 'Used')); break;
    case 'kazuya': R.push(flag('Rage', p.hp < 35, 'RAGE', 'Below 35 HP')); R.push(flag('Rage Drive', !m.rd, 'Ready', 'Used')); break;
    case 'seph': R.push(flag('One-Winged Angel', o.hp - p.hp >= 30, 'ACTIVE', 'Inactive')); break;
    case 'terry': R.push(flag('GO!', p.hp < 40, 'ACTIVE', 'Below 40 HP')); break;
    case 'dsamus': R.push(flag('Phazon Overload', p.meter >= 4, 'ACTIVE', 'Needs 4 meter')); break;
    case 'link': R.push(flag('Sword Beam', p.hp >= 80, 'ACTIVE', 'Needs 80 HP')); break;
    case 'daisy': R.push(flag('Sarasaland Spirit', p.hp < 50, 'ACTIVE', 'Below 50 HP')); break;
    case 'wolf': R.push(flag('Predator', o.hp < 50, 'ACTIVE', 'Opponent above 50')); break;
    case 'lucario': R.push(pips('Aura', Math.min(4, Math.floor((p.maxHp - p.hp) / 20)), 4)); break;
  }
  return R;
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
  let res = resources(p, o, g);
  if (hidden) res = res.filter(r => r.label !== 'C4');
  return {
    id: p.f.id, art: art(p), name: p.f.name, passive: p.f.passiveName, hp: Math.max(0, p.hp), maxHp: p.maxHp,
    meter: hidden ? null : p.meter, meterMax: E.RULES.METER_MAX,
    skill: { name: sk.name, type: E.skillType(p, g), cost: hidden ? null : E.skillCost(g, p, o) },
    statuses: statuses(p, g), resources: res,
  };
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
    };
  }
  return {
    turn: g.T, over: g.over, winner: g.winner, seat,
    me: side(g, seat, true), opp: side(g, 1 - seat, false),
    actions: g.over ? [] : E.legalActions(g, seat),
    waiting: !!pending[seat], oppReady: !!pending[1 - seat],
    shulk: g.p[seat].f.id === 'shulk', reveal: rv,
  };
}

function actLabel(p, a) {
  if (a.kind === 'fs') return { title: 'FINAL SMASH', sub: '', type: 'FS' };
  if (a.kind === 'skill') return { title: E.skillOf(p).name, sub: `${TYPE[a.type]} skill`, type: a.type };
  return { title: TYPE[a.type], sub: 'Basic', type: a.type };
}

module.exports = { view, actLabel };

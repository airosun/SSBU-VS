// What each player is allowed to see, plus plain-language turn logs.
'use strict';
const E = require('./engine');

const TYPE = { A: 'Attack', C: 'Counter', G: 'Grab', FS: 'Final Smash' };
const POKE = ['Squirtle', 'Ivysaur', 'Charizard'];

// Fighter-specific counters worth showing on screen
function trackers(p, g) {
  const m = p.mem, t = [];
  const add = (label, v) => t.push({ label, value: v });
  switch (p.f.id) {
    case 'samus': add('Charge Shot', `${m.cs || 0}/5`); break;
    case 'wario': add('Gas', `${m.gas || 0}/5`); break;
    case 'olimar': add('Pikmin', `${m.pik || 0}/3`); break;
    case 'pt': add('Active', POKE[m.poke || 0]); break;
    case 'mac': add('KO Stars', `${m.ko || 0}/2`); break;
    case 'rosa': add('Luma', m.luma > 0 ? `${m.luma} HP` : 'Knocked out'); break;
    case 'krool': add('Belly Armor', `${m.belly}/20`); break;
    case 'inkling': add('Ink on opponent', `${m.ink || 0}/3`); break;
    case 'steve': add('Tools', ['Wood', 'Stone', 'Iron', 'Diamond'][m.tier || 0]); break;
    case 'banjo': add('Golden Feathers', m.feathers ?? 5); break;
    case 'megaman': add('Weapon Get', `+${m.wg || 0}`); break;
    case 'cloud': add('Limit', m.limit ? 'READY' : `${m.acc || 0}/20`); break;
    case 'joker': add('Arsene', (m.ars || 0) >= g.T ? `Out until turn ${m.ars}` : `${m.acc || 0}/30`); break;
    case 'pyra': add('Form', (m.form || 'P') === 'P' ? 'Pyra' : 'Mythra'); break;
    case 'greninja': add('Skill type', TYPE[m.lb || 'A']); break;
    case 'villager': add('Pocket', `+${m.pocket || 0}`); add('Timber uses', m.tu || 0); break;
    case 'snake': add('C4', m.c4 ? 'Planted' : '—'); break;
    case 'ics': add('Nana', m.nanaLost ? 'Lost' : 'With you'); break;
    case 'falcon': add('Attack streak', m.st || 0); break;
    case 'kirby': add('Copied skill', p.copy ? p.copy.name : '—'); break;
    case 'sora': add('Next spell', ['Firaga', 'Blizzaga', 'Thundaga'][m.spn || 0]); break;
    case 'pacman': add('Bonus Fruit', `+${Math.min(8, g.T - (m.lt || 0))}`); break;
  }
  return t;
}

function statuses(p, g) {
  const T = g.T, s = [];
  if (E.active(p, 'stagger', T)) s.push('Staggered');
  if (E.active(p, 'paralyze', T)) s.push('Paralyzed');
  const l = E.active(p, 'lock', T); if (l) s.push(`Locked: ${TYPE[l.v]}`);
  const a = E.active(p, 'armor', T); if (a) s.push(`Armor ${a.v}`);
  if (p.charge) s.push(`Charge ${p.charge}`);
  if (p.weaken) s.push(`Weakened ${p.weaken}`);
  for (const b of p.burns) s.push(`Burn ${b.x} (${b.left})`);
  return s;
}

function side(g, i, self) {
  const p = g.p[i], o = g.p[1 - i];
  const sk = E.skillOf(p);
  const hidden = !self && p.f.hiddenMeter;
  return {
    id: p.f.id, name: p.f.name, hp: Math.max(0, p.hp), maxHp: p.maxHp,
    meter: hidden ? null : p.meter, meterMax: E.RULES.METER_MAX,
    skill: { name: sk.name, type: E.skillType(p, g), cost: hidden ? null : E.skillCost(g, p, o) },
    statuses: statuses(p, g), trackers: hidden ? trackers(p, g).filter(t => t.label !== 'C4') : trackers(p, g),
  };
}

function view(g, seat, pending) {
  return {
    turn: g.T, over: g.over, winner: g.winner, seat,
    me: side(g, seat, true), opp: side(g, 1 - seat, false),
    actions: g.over ? [] : E.legalActions(g, seat),
    waiting: !!pending[seat], oppReady: !!pending[1 - seat],
    shulk: g.p[seat].f.id === 'shulk',
  };
}

function actName(g, p, a) {
  if (a.kind === 'fs') return 'FINAL SMASH';
  if (a.kind === 'skill') return `${E.skillOf(p).name} (${TYPE[a.type]})`;
  return TYPE[a.type];
}

function describeTurn(before, after, acts, out, names) {
  const T = before.T, L = [];
  const n = i => `${names[i]}'s ${before.p[i].f.name}`;
  L.push(`Turn ${T}: ${n(0)} → ${actName(before, before.p[0], acts[0])}  |  ${n(1)} → ${actName(before, before.p[1], acts[1])}`);
  if (out.kind === 'win') L.push(`  ${n(out.winner)} wins the exchange!`);
  else if (out.kind === 'clash') L.push('  Clash! Both attacks connect.');
  else if (out.kind === 'whiff') L.push('  Whiff — nothing happens.');
  for (let i = 0; i < 2; i++) {
    const d = before.p[i].hp - after.p[i].hp;
    if (d > 0) L.push(`  ${n(i)} takes ${d} damage (${Math.max(0, after.p[i].hp)} HP left).`);
    if (d < 0) L.push(`  ${n(i)} recovers ${-d} HP.`);
  }
  if (after.over) L.push(after.winner === -1 ? 'Draw!' : `GAME! ${n(after.winner)} wins!`);
  return L;
}

module.exports = { view, describeTurn };

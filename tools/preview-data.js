// Builds public/preview-data.json: every resource widget in a few states, using the real view code.
'use strict';
const fs = require('fs');
const E = require('../src/engine'), { BY_ID } = require('../src/fighters'), { view } = require('../src/view');
const H = t => ({ kind: 'basic', type: t, res: 'tie' });
const S = {
  samus: [['Empty', {}], ['3 stacks', { mem: { cs: 3 } }], ['Full', { mem: { cs: 5 } }]],
  inkling: [['Empty', {}], ['2 Ink', { mem: { ink: 2 } }], ['Full', { mem: { ink: 3 } }]],
  cloud: [['Empty', {}], ['12 / 20', { mem: { acc: 12 } }], ['Limit ready', { mem: { limit: 1 } }]],
  joker: [['Empty', {}], ['Rebellion 18 / 30', { mem: { acc: 18 } }], ['Arsene out', { T: 6, mem: { ars: 8 } }]],
  rosa: [['Full Luma', {}], ['Luma 4 HP', { mem: { luma: 4 } }], ['Luma knocked out', { T: 7, mem: { luma: 0, down: 4 } }]],
  krool: [['Intact', {}], ['8 absorbed', { mem: { belly: 12 } }], ['18 absorbed', { mem: { belly: 2 } }], ['Broken', { T: 6, mem: { belly: 0, broke: 4 } }]],
  pacman: [['Cherry (+1)', { T: 1 }], ['Apple (+4)', { T: 4 }], ['Key (+8), pellet used', { T: 12, mem: { ppu: 1 } }]],
  banjo: [['5 feathers', {}], ['2 used', { mem: { feathers: 3 } }], ['All used', { mem: { feathers: 0 } }]],
  mac: [['Empty', {}], ['1 star', { mem: { ko: 1 } }], ['2 stars', { mem: { ko: 2 } }]],
  megaman: [['Empty', {}], ['2', { mem: { wg: 2 } }], ['Full', { mem: { wg: 3 } }]],
  lucario: [['Full HP', {}], ['55 HP', { hp: 55 }], ['15 HP', { hp: 15 }]],
  falcon: [['No streak', {}], ['2-win streak', { mem: { st: 2 } }], ['3+ streak', { mem: { st: 3 } }]],
  olimar: [['None', {}], ['2 Pikmin', { mem: { pik: 2, pc: ['red', 'yellow'] } }], ['3 Pikmin', { mem: { pik: 3, pc: ['blue', 'white', 'purple'] } }]],
  villager: [['Empty', {}], ['2 saplings', { mem: { tu: 2 } }], ['3 saplings + Pocket', { mem: { tu: 3, pocket: 7, pocketFrom: "Pikachu's Thunder" } }]],
  steve: [['Wood', {}], ['Iron', { T: 9, mem: { tier: 2 } }], ['Diamond', { T: 13, mem: { tier: 3 } }]],
  hero: [['Lv.0, turn 3', { T: 3 }], ['Level up! (turn 6)', { T: 6 }], ['Lv.3 max', { T: 18 }]],
  wft: [['Turn 1', {}], ['A, A, C', { hist: ['A', 'A', 'C'] }], ['Ready (G, C, A)', { hist: ['G', 'C', 'A'], mem: { br: 1 } }]],
  sora: [['Firaga next', {}], ['Blizzaga next', { mem: { spn: 1 } }], ['Thundaga, Second Chance used', { mem: { spn: 2, sc: 1 } }]],
  shulk: [['No Art yet', {}], ['Buster', { mem: { artPick: 'buster' } }], ['Shield', { mem: { artPick: 'shield' } }], ['Speed', { mem: { artPick: 'speed' } }]],
  ics: [['Nana with you', {}], ['Nana lost', { mem: { nanaLost: true } }]],
  peach: [['3 turns away', { T: 1 }], ['1 turn away', { T: 3 }], ['Stitchface turn', { T: 4 }]],
  tlink: [['2 turns away', { T: 1 }], ['Bomb turn', { T: 3 }]],
  isabelle: [['3 turns away', { T: 1 }], ['Lloid turn', { T: 4 }]],
  zelda: [['Ready', {}], ['Used', { mem: { pg: 1 } }]],
  doc: [['Ready', {}], ['Used', { mem: { mv: 1 } }]],
  chrom: [['Ready', {}], ['Used', { mem: { ep: 1 } }]],
  richter: [['Ready', {}], ['Active', { mem: { hr: 1 } }], ['Used', { mem: { hr: 2 } }]],
  byleth: [['Ready', {}], ['Used', { mem: { dp: 1 } }]],
  kazuya: [['Ready, no Rage', {}], ['Rage (HP pulses red)', { hp: 30 }], ['Rage Drive used', { hp: 30, mem: { rd: 1 } }]],
  seph: [['Inactive', {}], ['Active', { hp: 40, oppHp: 90 }]],
  terry: [['Inactive', {}], ['Active', { hp: 35 }]],
  dsamus: [['Inactive', { meter: 2 }], ['Active', { meter: 5 }]],
  link: [['Active', {}], ['Inactive', { hp: 60 }]],
  daisy: [['Inactive', {}], ['Active (HP glows)', { hp: 40 }]],
  // effects that show on the opponent's side
  wolf: [['Opponent above 50', { opp: true }], ['Crosshair on opponent', { opp: true, oppHp: 40 }]],
  snake: [['No C4', { opp: true }], ['C4 under opponent (Snake sees it)', { opp: true, mem: { c4: 1 } }]],
  mario: [['No effects', {}], ['Every debuff', { fx: 'debuffs' }], ['Buffs', { fx: 'buffs' }], ['Poison + Frozen', { fx: 'dots' }]],
  wario: [['Empty', {}], ['2 gas', { mem: { gas: 2 } }], ['Full', { mem: { gas: 5 } }], ['Wario-Man', { T: 3, mem: { wman: 4 } }]],
  kirby: [['Inhale', {}], ['Copied Thunder', { copy: 'pikachu' }]],
  greninja: [['Skill is Attack', {}], ['Skill is Grab', { mem: { lb: 'G' } }]],
};
const out = [];
for (const [id, states] of Object.entries(S)) {
  const f = BY_ID[id];
  out.push({ id, name: f.name, states: states.map(([label, o]) => {
    const g = E.newGame(f, BY_ID.mario, 1);
    const p = g.p[0], q = g.p[1];
    g.T = o.T || 1; if (o.hp) p.hp = o.hp; if (o.meter !== undefined) p.meter = o.meter; if (o.oppHp) q.hp = o.oppHp;
    Object.assign(p.mem, o.mem || {});
    if (o.hist) p.hist = o.hist.map(H);
    if (o.copy) p.copy = BY_ID[o.copy].skill;
    if (o.fx === 'debuffs') { p.burns = [{ x: 3, left: 2, start: 1 }]; p.weaken = 4; p.st.stagger = { from: 1, until: 1 }; p.st.paralyze = { from: 1, until: 1 }; p.st.lock = { from: 1, until: 1, v: 'C' }; }
    if (o.fx === 'dots') { p.burns = [{ x: 2, left: 2, start: 1, kind: 'poison' }, { x: 3, left: 3, start: 1, kind: 'freeze' }]; }
    if (o.fx === 'buffs') { p.charge = 5; p.st.armor = { from: 1, until: 2, v: 5 }; }
    const v = view(g, 0, [null, null], null);
    return { label, side: o.opp ? 'opp' : 'me', state: { ...v, names: ['You', 'Opponent'], log: [] } };
  }) });
}
fs.writeFileSync(__dirname + '/../public/preview-data.json', JSON.stringify(out));
console.log(out.length, 'fighters,', out.reduce((a, f) => a + f.states.length, 0), 'states');

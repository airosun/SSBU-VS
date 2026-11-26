// All 83 kits. Numbers live in N so the tuner can change them without touching logic.
'use strict';
const E = require('./engine');
const { setStatus, active, gain, drain, heal, selfDmg, burn, charge, weaken, last, wonLast, lostLast } = E;

// Tunable numbers. These match the balanced Roster sheet (Nov 2026 balance pass).
const N = {
  mario: {p: 2, s: 7},
  dk: {p: 4, s: 9},
  link: {p: 3, s: 2, burn: 6},
  samus: {per: 2, s: 5},
  dsamus: {p: 1, s: 2, burn: 2},
  yoshi: {s: 2},
  kirby: {p: 3, s: 7},
  fox: {p: 2, s: 9},
  pikachu: {p: 3, s: 6},
  luigi: {p: 10, s: 6},
  ness: {s: 3, burn: 2},
  falcon: {p: 2, s: 16},
  jiggly: {s: 21},
  peach: {p: 8, s: 4},
  daisy: {p: 2, s: 5, heal: 3},
  bowser: {p: 2, s: 4},
  ics: {p: 2, s: 5, f: 6},
  sheik: {p: 3, s: 4, w: 5},
  zelda: {s: 4, heal: 2, pg: 10},
  doc: {p: 10, s: 3},
  pichu: {p: 3, s: 6},
  falco: {s: 8},
  marth: {p: 3, s: 7, x: 5},
  lucina: {p: 1, s: 2},
  ylink: {s: 6},
  ganon: {p: 2, s: 3},
  mewtwo: {hp: 100, s: 6},
  roy: {p: 2, s: 11},
  chrom: {p: 2, s: 8},
  gnw: {s: 4},
  mk: {s: 5, ch: 5},
  pit: {p: 1, s: 5, ar: 5},
  dpit: {p: 3, s: 8},
  zss: {s: 6},
  wario: {p: 10, s: 3, heal: 4},
  snake: {s: 3, c4: 8},
  ike: {p: 3, s: 12},
  pt: {p: 3, s: 5},
  diddy: {p: 4, s: 7},
  lucas: {s: 6},
  sonic: {s: 7, x: 3},
  dedede: {hp: 110, s: 5},
  olimar: {s: 10, per: 2},
  lucario: {s: 6},
  rob: {s: 9},
  tlink: {p: 3, s: 6, heal: 2},
  wolf: {p: 3, s: 7},
  villager: {s: 2},
  megaman: {s: 4, ar: 4},
  wft: {p: 1, s: 2, heal: 5},
  rosa: {luma: 10, re: 10, s: 2},
  mac: {s: 15},
  greninja: {s: 11},
  palutena: {p: 2, s: 6, w: 4},
  pacman: {s: 5, rate: 1},
  robin: {p: 3, s: 3, heal: 5},
  shulk: {s: 5, ch: 4},
  bjr: {hp: 95, s: 4, burn: 5},
  duckhunt: {p: 2, s: 2, burn: 2},
  ryu: {p: 2, s: 6},
  ken: {p: 2, s: 7, ch: 3},
  cloud: {s: 7, lim: 5},
  corrin: {p: 3, s: 6},
  bayo: {p: 3, s: 4, ch: 6},
  inkling: {s: 5},
  ridley: {p: 4, s: 11},
  simon: {p: 2, s: 4, burn: 3},
  richter: {p: 8, s: 3, burn: 4},
  krool: {p: 4, s: 5},
  isabelle: {p: 5, s: 5},
  incin: {p: 3, s: 5},
  plant: {p: 2, s: 9},
  joker: {p: 4, s: 3, x: 6},
  hero: {s: -2},
  banjo: {s: 4, cost: 2},
  terry: {p: 3, s: 16},
  byleth: {s: 2, cap: 10, thr: 10},
  minmin: {p: 3, s: 6, w: 3},
  steve: {s: 7},
  seph: {p: 3, s: 11},
  pyra: {p: 2, sP: 7, sM: 4, s: -1},
  kazuya: {p: 3, rd: 8, s: 6},
  sora: {s: 4, th: 7, x: 3, req: 20},
};

const isA = a => a && a.type === 'A', isC = a => a && a.type === 'C', isG = a => a && a.type === 'G';
const basic = a => a && a.kind === 'basic';
const opSkill = c => c.oppAct && c.oppAct.kind === 'skill';
const turnsDiv = (T, n) => T % n === 0;
const K = (o) => o; // identity, readability

const F = [];
function def(id, name, kit) { F.push({ id, name, ...kit }); }

// 1 Mario
def('mario', 'Mario', {
  winBonus: c => { const h = last(c.me); return basic(c.act) && h && h.type !== c.act.type ? N.mario.p : 0; },
  skill: { name: 'Cape', type: 'C', cost: 2, listed: 5, bonus: () => N.mario.s, rider: c => gain(c.g, c.me, 1) },
});
// 2 DK
def('dk', 'Donkey Kong', {
  onWin: c => { if (isG(c.act)) charge(c.me, N.dk.p, c.g); },
  skill: { name: 'Giant Punch', type: 'A', cost: 3, listed: 12, bonus: () => N.dk.s },
});
// 3 Link
def('link', 'Link', {
  winBonus: c => isA(c.act) && c.me.hp >= 80 ? N.link.p : 0,
  skill: { name: 'Remote Bomb', type: 'A', cost: 2, listed: 9, bonus: () => N.link.s, rider: c => burn(c.g, c.opp, N.link.burn, 1) },
});
// 4 Samus
def('samus', 'Samus', {
  onTurnEnd: c => { if (c.res !== 'win') c.me.mem.cs = Math.min(5, (c.me.mem.cs || 0) + 1); },
  skill: { name: 'Charge Shot', type: 'A', cost: 2, listed: 6, bonus: c => N.samus.s + N.samus.per * (c.me.mem.cs || 0), rider: c => { c.me.mem.cs = 0; } },
  potential: p => 1.6 * (p.mem.cs || 0),
});
// 4e Dark Samus
def('dsamus', 'Dark Samus', {
  winBonus: c => c.me.meter >= 4 ? N.dsamus.p : 0,
  skill: { name: 'Grapple Beam', type: 'G', cost: 2, listed: 8, bonus: () => N.dsamus.s, rider: c => burn(c.g, c.opp, N.dsamus.burn, 2) },
});
// 5 Yoshi
def('yoshi', 'Yoshi', {
  clashTaken: () => -99,
  skill: { name: 'Egg Lay', type: 'G', cost: 2, listed: 3, bonus: () => N.yoshi.s, rider: c => setStatus(c.g, c.opp, 'lock', 1, 'A') },
});
// 6 Kirby
def('kirby', 'Kirby', {
  onWin: c => { if (isG(c.act)) heal(c.me, N.kirby.p, c.g); },
  skill: { name: 'Inhale', type: 'G', cost: 2, listed: 2, bonus: () => N.kirby.s,
    rider: c => { const os = c.opp.copy || c.opp.f.skill; if (os.name !== 'Inhale') { c.me.copy = os; E.emit(c.g, `Kirby copies ${os.name}!`); } } },
  onSkillLose: c => { if (c.me.copy) E.emit(c.g, 'Kirby loses the copied ability.'); c.me.copy = null; },
});
// 7 Fox
def('fox', 'Fox', {
  clashDealt: () => N.fox.p,
  skill: { name: 'Reflector', type: 'C', cost: 2, listed: 4,
    bonus: c => N.fox.s + (opSkill(c) ? Math.min(8, (c.opp.copy || c.opp.f.skill).listed || 0) : 0) },
});
// 8 Pikachu
def('pikachu', 'Pikachu', {
  onLose: c => { if (isG(c.oppAct)) { selfDmg(c.opp, N.pikachu.p, c.g); setStatus(c.g, c.opp, 'paralyze', 1); } },
  skill: { name: 'Thunder', type: 'A', cost: 2, listed: 7, bonus: () => N.pikachu.s },
});
// 9 Luigi
def('luigi', 'Luigi', {
  winBonus: c => isA(c.act) && c.g.rng() < 0.2 ? N.luigi.p : 0,
  skill: { name: 'Poltergust G-00.0', type: 'G', cost: 2, listed: 3, bonus: () => N.luigi.s,
    rider: c => { const t = Math.min(1, c.opp.meter); drain(c.opp, 1, c.g); gain(c.g, c.me, 1); } },
});
// 10 Ness
def('ness', 'Ness', {
  onOppSkill: c => gain(c.g, c.me, 1),
  skill: { name: 'PK Fire', type: 'A', cost: 2, listed: 8, bonus: () => N.ness.s, rider: c => burn(c.g, c.opp, N.ness.burn, 2) },
});
// 11 Captain Falcon
def('falcon', 'Captain Falcon', {
  winBonus: c => isA(c.act) ? Math.min(3 * N.falcon.p, N.falcon.p * ((c.me.mem.st || 0) + 1)) : 0,
  onWin: c => { c.me.mem.st = isA(c.act) ? (c.me.mem.st || 0) + 1 : 0; },
  onTurnEnd: c => { if (c.res !== 'win') c.me.mem.st = 0; },
  skill: { name: 'Falcon Punch', type: 'A', cost: 3, listed: 14, endlag: 5, bonus: () => N.falcon.s },
});
// 12 Jigglypuff
def('jiggly', 'Jigglypuff', {
  onLose: c => { if (isG(c.oppAct)) setStatus(c.g, c.opp, 'stagger', 1); },
  skill: { name: 'Rest', type: 'G', cost: 3, listed: 16, bonus: () => N.jiggly.s,
    rider: c => { setStatus(c.g, c.me, 'stagger', 1); setStatus(c.g, c.me, 'paralyze', 1); } },
});
// 13 Peach
def('peach', 'Peach', {
  winBonus: c => turnsDiv(c.T, 4) ? N.peach.p : 0,
  skill: { name: 'Toad', type: 'C', cost: 2, listed: 5, bonus: () => N.peach.s, rider: c => setStatus(c.g, c.opp, 'paralyze', 1) },
});
// 13e Daisy
def('daisy', 'Daisy', {
  winBonus: c => c.me.hp < 50 ? N.daisy.p : 0,
  skill: { name: 'Daisy Bomber', type: 'A', cost: 2, listed: 5, bonus: () => N.daisy.s, rider: c => heal(c.me, N.daisy.heal, c.g) },
});
// 14 Bowser
def('bowser', 'Bowser', {
  reduce: (c, d) => basic(c.oppAct) && !c.fs ? Math.max(Math.min(d, 1), d - N.bowser.p) : d,
  skill: { name: 'Flying Slam', type: 'G', cost: 2, listed: 6, bonus: c => N.bowser.s + (c.me.hp < c.opp.hp ? 3 : 0) },
});
// 15 Ice Climbers
def('ics', 'Ice Climbers', {
  winBonus: c => (c.me.mem.nanaLost ? 0 : N.ics.p) + (isG(c.act) && c.me.mem.chain === c.T ? N.ics.f : 0),
  onTurnEnd: c => { if (c.me.hp < 40 && !c.me.mem.nanaLost) { c.me.mem.nanaLost = true; E.emit(c.g, 'Nana is lost! The Ice Climbers lose their +2.'); } },
  skill: { name: 'Chain Grab', type: 'G', cost: 2, listed: 4, bonus: () => N.ics.s, rider: c => { c.me.mem.chain = c.T + 1; } },
});
// 16 Sheik
def('sheik', 'Sheik', {
  onTie: c => { if (c.kind === 'whiff') selfDmg(c.opp, N.sheik.p, c.g); },
  skill: { name: 'Vanish', type: 'C', cost: 2, listed: 3, bonus: () => N.sheik.s, rider: c => weaken(c.opp, N.sheik.w, c.g) },
});
// 17 Zelda
def('zelda', 'Zelda', {
  absorb: (c, d) => { if (d >= 15 && !c.me.mem.pg) { c.me.mem.pg = 1; E.emit(c.g, 'Zelda\'s Phantom Guard activates!'); return Math.min(d, N.zelda.pg); } return d; },
  skill: { name: "Nayru's Love", type: 'C', cost: 2, listed: 4, bonus: () => N.zelda.s, rider: c => heal(c.me, N.zelda.heal, c.g) },
});
// 18 Dr. Mario
def('doc', 'Dr. Mario', {
  initMem: () => { const c = ['blue', 'white', 'red', 'yellow'].sort(() => Math.random() - 0.5); return { pill: c.slice(0, 2) }; },
  onTurnEnd: c => { if (c.me.hp > 0 && c.me.hp <= 40 && !c.me.mem.mv) { c.me.mem.mv = 1; heal(c.me, N.doc.p, c.g); } },
  skill: { name: 'Super Sheet', type: 'C', cost: 2, listed: 4, bonus: () => N.doc.s, rider: c => setStatus(c.g, c.opp, 'stagger', 1) },
});
// 19 Pichu
def('pichu', 'Pichu', {
  winBonus: () => N.pichu.p, onWin: c => selfDmg(c.me, 1, c.g),
  skill: { name: 'Skull Bash', type: 'A', cost: 2, listed: 7, bonus: () => N.pichu.s, rider: c => selfDmg(c.me, 2, c.g) },
});
// 20 Falco
def('falco', 'Falco', {
  onWin: c => { if (isA(c.act)) gain(c.g, c.me, 1); },
  skill: { name: 'Reflector', type: 'C', cost: 2, listed: 4, bonus: () => N.falco.s, rider: c => setStatus(c.g, c.opp, 'stagger', 1) },
});
// 21 Marth
def('marth', 'Marth', {
  winBonus: c => wonLast(c.me) ? N.marth.p : 0,
  skill: { name: 'Counter', type: 'C', cost: 2, listed: 3, bonus: c => N.marth.s + (opSkill(c) ? N.marth.x : 0) },
});
// 21e Lucina
def('lucina', 'Lucina', {
  winBonus: () => N.lucina.p,
  skill: { name: 'Shield Breaker', type: 'A', cost: 2, listed: 3, bonus: () => N.lucina.s, rider: c => setStatus(c.g, c.opp, 'lock', 1, 'C') },
});
// 22 Young Link
def('ylink', 'Young Link', {
  onWin: c => { if (isA(c.act)) burn(c.g, c.opp, 1, 2); },
  skill: { name: 'Hookshot', type: 'G', cost: 2, listed: 3, bonus: () => N.ylink.s, rider: c => setStatus(c.g, c.opp, 'lock', 1, 'C') },
});
// 23 Ganondorf
def('ganon', 'Ganondorf', {
  winBonus: () => N.ganon.p, vuln: c => isG(c.oppAct) ? 2 : 0,
  skill: { name: 'Flame Choke', type: 'G', cost: 2, listed: 5, bonus: () => N.ganon.s, rider: c => setStatus(c.g, c.opp, 'stagger', 1) },
});
// 24 Mewtwo
def('mewtwo', 'Mewtwo', {
  maxHp: () => N.mewtwo.hp, taxOpp: 1,
  skill: { name: 'Disable', type: 'C', cost: 2, listed: 2, bonus: () => N.mewtwo.s, rider: c => setStatus(c.g, c.opp, 'stagger', 2) },
});
// 25 Roy
def('roy', 'Roy', {
  winBonus: c => { const h = last(c.me); return h && h.res === 'win' && h.type === 'G' ? N.roy.p : 0; },
  skill: { name: 'Flare Blade', type: 'A', cost: 3, listed: 12, bonus: c => N.roy.s + (c.me.hp < c.opp.hp ? 3 : 0) },
});
// 25e Chrom
def('chrom', 'Chrom', {
  onTurnEnd: c => { if (c.me.hp > 0 && c.me.hp < 50 && !c.me.mem.ep) { c.me.mem.ep = 1; gain(c.g, c.me, N.chrom.p); } },
  skill: { name: 'Soaring Slash', type: 'G', cost: 2, listed: 5, bonus: () => N.chrom.s, rider: c => setStatus(c.g, c.opp, 'paralyze', 1) },
});
// 26 Mr. Game & Watch
def('gnw', 'Mr. Game & Watch', {
  onTie: c => gain(c.g, c.me, 1),
  skill: { name: 'Judge', type: 'A', cost: 2, listed: 5,
    bonus: c => { const r = 1 + Math.floor(c.g.rng() * 9); if (r === 1) selfDmg(c.me, 3, c.g); return N.gnw.s + (r === 9 ? 15 : r); } },
});
// 27 Meta Knight
def('mk', 'Meta Knight', {
  onWin: c => { if (isC(c.act)) gain(c.g, c.me, 1); },
  skill: { name: 'Dimensional Cape', type: 'C', cost: 2, listed: 3, bonus: () => N.mk.s, rider: c => charge(c.me, N.mk.ch, c.g) },
});
// 28 Pit
def('pit', 'Pit', {
  onTurnEnd: c => { if (c.res === 'win') heal(c.me, N.pit.p, c.g); },
  skill: { name: 'Guardian Orbitars', type: 'C', cost: 2, listed: 3, bonus: () => N.pit.s, rider: c => setStatus(c.g, c.me, 'armor', 1, N.pit.ar) },
});
// 28e Dark Pit
def('dpit', 'Dark Pit', {
  winBonus: c => { const h = last(c.me); return h && h.oppSkill ? N.dpit.p : 0; },
  skill: { name: 'Electroshock Arm', type: 'A', cost: 2, listed: 6, ignoreArmor: true, bonus: () => N.dpit.s },
});
// 29 Zero Suit Samus
def('zss', 'Zero Suit Samus', {
  onWin: c => { if (isG(c.act)) gain(c.g, c.me, 1); },
  skill: { name: 'Paralyzer', type: 'A', cost: 2, listed: 3, bonus: () => N.zss.s,
    rider: c => { setStatus(c.g, c.opp, 'paralyze', 1); setStatus(c.g, c.opp, 'stagger', 1); } },
});
// 30 Wario
def('wario', 'Wario', {
  winBonus: c => isA(c.act) && (c.me.mem.gas || 0) >= 5 ? (c.me.mem.gas = 0, E.emit(c.g, 'WARIO WAFT! Full gas released.'), N.wario.p) : 0,
  onTurnEnd: c => { c.me.mem.gas = Math.min(5, (c.me.mem.gas || 0) + 1); },
  skill: { name: 'Chomp', type: 'G', cost: 2, listed: 4, bonus: () => N.wario.s, rider: c => heal(c.me, N.wario.heal, c.g) },
  potential: p => 1.5 * (p.mem.gas || 0),
});
// 31 Snake
def('snake', 'Snake', {
  hiddenMeter: true,
  onLose: c => { if (c.me.mem.c4) { c.me.mem.c4 = 0; selfDmg(c.opp, N.snake.c4, c.g, 'C4 detonates'); } },
  skill: { name: 'C4', type: 'A', cost: 2, listed: 2, bonus: () => N.snake.s, rider: c => { c.me.mem.c4 = 1; } },
  potential: p => (p.mem.c4 ? 6 : 0),
});
// 32 Ike
def('ike', 'Ike', {
  winBonus: c => isA(c.act) ? N.ike.p : 0, clashTaken: () => 2,
  skill: { name: 'Counter', type: 'C', cost: 3, listed: 9, bonus: () => N.ike.s },
});
// 33 Pokémon Trainer
const PT_SPEC = ['C', 'G', 'A'];
const PIKMIN = ['red', 'blue', 'yellow', 'white', 'purple'];
def('pt', 'Pokémon Trainer', {
  winBonus: c => c.act.type === PT_SPEC[c.me.mem.poke || 0] ? N.pt.p : 0,
  skill: { name: 'Pokémon Change', type: 'C', cost: 1, listed: 2, bonus: () => N.pt.s, rider: c => { c.me.mem.poke = ((c.me.mem.poke || 0) + 1) % 3; E.emit(c.g, `Pokémon Trainer switches to ${['Squirtle', 'Ivysaur', 'Charizard'][c.me.mem.poke]}!`); } },
});
// 36 Diddy Kong
def('diddy', 'Diddy Kong', {
  onLose: c => { const h = last(c.opp); if (basic(c.oppAct) && h && h.res === 'win' && h.kind === 'basic' && h.type === c.oppAct.type) selfDmg(c.opp, N.diddy.p, c.g); },
  skill: { name: 'Monkey Flip', type: 'G', cost: 2, listed: 5, bonus: () => N.diddy.s, rider: c => gain(c.g, c.me, 1) },
});
// 37 Lucas
def('lucas', 'Lucas', {
  costMod: p => lostLast(p) ? -1 : 0,
  skill: { name: 'PK Freeze', type: 'A', cost: 2, minCost: 1, listed: 3, bonus: () => N.lucas.s,
    rider: c => { if (c.oppAct.kind === 'basic') setStatus(c.g, c.opp, 'lock', 1, c.oppAct.type); } },
});
// 38 Sonic
def('sonic', 'Sonic', {
  turnMeter: c => wonLast(c.me) ? 1 : 0,
  skill: { name: 'Spin Dash', type: 'A', cost: 2, listed: 5, bonus: c => N.sonic.s + (wonLast(c.me) ? N.sonic.x : 0) },
});
// 39 King Dedede
def('dedede', 'King Dedede', {
  maxHp: () => N.dedede.hp,
  skill: { name: 'Inhale', type: 'G', cost: 2, listed: 6, bonus: () => N.dedede.s, rider: c => setStatus(c.g, c.opp, 'stagger', 1) },
});
// 40 Olimar
def('olimar', 'Olimar', {
  onTurnEnd: c => { const m = c.me.mem; m.pik = m.pik || 0; const pc = m.pc || [];
    if (c.res === 'win' && m.pik < 3) { m.pik++; m.pc = [...pc, PIKMIN[(Math.random() * 5) | 0]]; } else if (c.res === 'lose' && m.pik > 0) { m.pik--; m.pc = pc.slice(0, -1); } },
  skill: { name: 'Pikmin Throw', type: 'G', cost: 2, listed: 7, bonus: c => N.olimar.s + N.olimar.per * (c.me.mem.pik || 0), rider: c => { c.me.mem.pik = 0; c.me.mem.pc = []; } },
  potential: p => 1.5 * (p.mem.pik || 0),
});
// 41 Lucario
def('lucario', 'Lucario', {
  winBonus: c => Math.min(4, Math.floor((c.me.maxHp - c.me.hp) / 20)),
  skill: { name: 'Double Team', type: 'C', cost: 2, listed: 5, bonus: () => N.lucario.s },
});
// 42 R.O.B.
def('rob', 'R.O.B.', { immune: true, skill: { name: 'Robo Beam', type: 'A', cost: 2, listed: 6, bonus: () => N.rob.s } });
// 43 Toon Link
def('tlink', 'Toon Link', {
  onWin: c => { if (turnsDiv(c.T, 3)) burn(c.g, c.opp, N.tlink.p, 1); },
  skill: { name: 'Spin Attack', type: 'C', cost: 2, listed: 5, bonus: () => N.tlink.s, rider: c => heal(c.me, N.tlink.heal, c.g) },
});
// 44 Wolf
def('wolf', 'Wolf', {
  winBonus: c => c.opp.hp < 50 ? N.wolf.p : 0,
  skill: { name: 'Wolf Flash', type: 'A', cost: 2, listed: 4, ignoreArmor: true, bonus: () => N.wolf.s },
});
// 45 Villager
def('villager', 'Villager', {
  winBonus: c => { const v = c.me.mem.pocket || 0; c.me.mem.pocket = 0; return v; },
  onWin: c => { if (opSkill(c)) { const os = c.opp.copy || c.opp.f.skill; c.me.mem.pocket = Math.min(8, os.listed || 0); c.me.mem.pocketFrom = `${c.opp.f.name}'s ${os.name}`; } },
  skill: { name: 'Timber', type: 'A', cost: 2, listed: 6, bonus: c => Math.min(12, N.villager.s + 3 * (c.me.mem.tu || 0)),
    onUse: c => { c.me.mem.tuNext = (c.me.mem.tu || 0) + 1; }, rider: () => {} },
  onTurnEnd: c => { if (c.me.mem.tuNext) { c.me.mem.tu = c.me.mem.tuNext; c.me.mem.tuNext = 0; } },
  potential: p => (p.mem.pocket || 0) * 0.8 + 1.5 * Math.min(3, p.mem.tu || 0),
});
// 46 Mega Man
def('megaman', 'Mega Man', {
  winBonus: c => c.me.mem.wg || 0,
  onWin: c => { if (opSkill(c)) c.me.mem.wg = Math.min(3, (c.me.mem.wg || 0) + 1); },
  skill: { name: 'Leaf Shield', type: 'C', cost: 2, listed: 3, bonus: () => N.megaman.s, rider: c => setStatus(c.g, c.me, 'armor', 2, N.megaman.ar) },
  potential: p => 4 * (p.mem.wg || 0),
});
// 47 Wii Fit Trainer
def('wft', 'Wii Fit Trainer', {
  winBonus: c => c.me.mem.br ? (c.me.mem.br = 0, N.wft.p) : 0,
  onTurnEnd: c => { const h = c.me.hist.slice(-3).map(x => x.type); if (h.length === 3 && new Set(h).size === 3 && h.every(t => t !== 'FS')) c.me.mem.br = 1; },
  skill: { name: 'Deep Breathing', type: 'C', cost: 2, listed: 2, bonus: () => N.wft.s, rider: c => { heal(c.me, N.wft.heal, c.g); charge(c.me, 3, c.g); } },
});
// 48 Rosalina & Luma
def('rosa', 'Rosalina & Luma', {
  initMem: () => ({ luma: N.rosa.luma, down: 0 }),
  absorb: (c, d) => { const m = c.me.mem; if (m.luma > 0) { const t = Math.min(m.luma, d); m.luma -= t; d -= t; if (m.luma === 0) { m.down = c.T; E.emit(c.g, 'Luma is knocked out! It returns in ' + N.rosa.re + ' turns.'); } } return d; },
  onTurnEnd: c => { const m = c.me.mem; if (m.luma === 0 && c.T - m.down >= N.rosa.re) { m.luma = N.rosa.luma; E.emit(c.g, 'Luma returns!'); } },
  skill: { name: 'Gravitational Pull', type: 'C', cost: 2, listed: 4, bonus: () => N.rosa.s, rider: c => drain(c.opp, 1, c.g) },
  potential: p => p.mem.luma || 0,
});
// 49 Little Mac
def('mac', 'Little Mac', {
  onWin: c => { if (isC(c.act)) c.me.mem.ko = Math.min(2, (c.me.mem.ko || 0) + 1); },
  vuln: c => isG(c.oppAct) ? 2 : 0,
  skill: { name: 'KO Uppercut', type: 'A', cost: p => 3 - (p.mem.ko || 0), minCost: 1, listed: 13, bonus: () => N.mac.s,
    onUse: c => { c.me.mem.ko = 0; } },
  potential: p => 3 * (p.mem.ko || 0),
});
// 50 Greninja
def('greninja', 'Greninja', {
  onTurnEnd: c => { if (basic(c.act)) c.me.mem.lb = c.act.type; },
  skill: { name: 'Water Shuriken', type: p => p.mem.lb || 'A', cost: 2, listed: 5, bonus: () => N.greninja.s },
});
// 54 Palutena
def('palutena', 'Palutena', {
  onWin: c => { if (opSkill(c)) heal(c.me, N.palutena.p, c.g); },
  skill: { name: 'Reflect Barrier', type: 'C', cost: 2, listed: 4, bonus: () => N.palutena.s, rider: c => weaken(c.opp, N.palutena.w, c.g) },
});
// 55 Pac-Man
def('pacman', 'Pac-Man', {
  onTurnEnd: c => { if (c.me.hp > 0 && c.me.hp < 30 && !c.me.mem.ppu) { c.me.mem.ppu = 1; c.me.mem.double = 2; E.emit(c.g, 'Power Pellet! Pac-Man\'s next 2 wins deal double damage.'); } },
  skill: { name: 'Bonus Fruit', type: 'A', cost: 2, listed: 5, bonus: c => N.pacman.s + Math.min(8, N.pacman.rate * (c.T - (c.me.mem.lt || 0))), onUse: c => { c.me.mem.lt = c.T; } },
});
// 56 Robin
def('robin', 'Robin', {
  winBonus: c => basic(c.act) && c.me.mem.tome ? (c.me.mem.tome = 0, N.robin.p) : 0,
  onTurnEnd: c => { if (c.act.kind === 'skill') c.me.mem.tome = 1; },
  skill: { name: 'Nosferatu', type: 'G', cost: 2, listed: 5, bonus: () => N.robin.s, rider: c => heal(c.me, N.robin.heal, c.g) },
});
// 57 Shulk — Art picked by a fixed heuristic each turn
function shulkArt(p, o) { if (p.mem.artPick) return p.mem.artPick; if (p.hp < 35) return 'shield'; if (p.meter < 2) return 'speed'; return p.hp >= o.hp ? 'buster' : 'speed'; }
def('shulk', 'Shulk', {
  turnMeter: c => shulkArt(c.me, c.opp) === 'speed' ? 1 : 0,
  winBonus: c => ({ buster: 3, shield: -2, speed: -1 })[shulkArt(c.me, c.opp)],
  takeMod: c => ({ buster: 2, shield: -3, speed: 0 })[shulkArt(c.me, c.opp)],
  skill: { name: 'Vision', type: 'C', cost: 2, listed: 4, bonus: () => N.shulk.s, rider: c => charge(c.me, N.shulk.ch, c.g) },
});
// 58 Bowser Jr.
def('bjr', 'Bowser Jr.', {
  maxHp: () => N.bjr.hp, takeMod: () => -1,
  skill: { name: 'Mechakoopa', type: 'G', cost: 2, listed: 8, bonus: () => N.bjr.s, rider: c => burn(c.g, c.opp, N.bjr.burn, 1) },
});
// 59 Duck Hunt
def('duckhunt', 'Duck Hunt', {
  punishBonus: () => N.duckhunt.p,
  skill: { name: 'Trick Shot', type: 'A', cost: 2, listed: 8, bonus: () => N.duckhunt.s, rider: c => burn(c.g, c.opp, N.duckhunt.burn, 3) },
});
// 60 Ryu
def('ryu', 'Ryu', {
  reduce: (c, d) => c.win && isG(c.oppAct) ? d - N.ryu.p : d,
  skill: { name: 'Shoryuken', type: 'A', cost: 2, listed: 5, clashWin: true, bonus: () => N.ryu.s },
});
// 60e Ken
def('ken', 'Ken', {
  winBonus: c => isA(c.act) && wonLast(c.me) ? N.ken.p : 0,
  skill: { name: 'Tatsumaki Senpukyaku', type: 'A', cost: 2, listed: 4, bonus: () => N.ken.s, rider: c => charge(c.me, N.ken.ch, c.g) },
});
// 61 Cloud
def('cloud', 'Cloud', {
  onHit: (c, d) => { const m = c.me.mem; if (m.limit) return; m.acc = (m.acc || 0) + d; if (m.acc >= 20) { m.limit = 1; m.acc = 0; E.emit(c.g, 'Cloud\'s Limit is ready!'); } },
  costMod: p => p.mem.limit ? -99 : 0,
  skill: { name: 'Cross Slash', type: 'A', cost: 2, listed: 6, bonus: c => N.cloud.s + (c.me.mem.limitUsed ? N.cloud.lim : 0),
    onUse: c => { c.me.mem.limitUsed = c.me.mem.limit ? 1 : 0; c.me.mem.limit = 0; } },
  potential: p => p.mem.limit ? 10 : (p.mem.acc || 0) * 0.3,
});
// 62 Corrin
def('corrin', 'Corrin', {
  winBonus: c => basic(c.act) && isG(c.act) ? N.corrin.p : 0,
  skill: { name: 'Counter Surge', type: 'C', cost: 2, listed: 4, bonus: () => N.corrin.s, rider: c => setStatus(c.g, c.opp, 'lock', 1, 'A') },
});
// 63 Bayonetta
def('bayo', 'Bayonetta', {
  winBonus: c => { const h = last(c.me); return h && h.res === 'win' && h.type === 'C' ? N.bayo.p : 0; },
  skill: { name: 'Witch Time', type: 'C', cost: 2, listed: 3, bonus: () => N.bayo.s, rider: c => charge(c.me, N.bayo.ch, c.g) },
});
// 64 Inkling
def('inkling', 'Inkling', {
  hitBonus: c => c.me.mem.ink || 0,
  onWin: c => { c.me.mem.ink = Math.min(3, (c.me.mem.ink || 0) + 1 + (c.act.kind === 'skill' ? 2 : 0)); },
  onTurnEnd: c => { if (c.res !== 'win') c.me.mem.ink = Math.max(0, (c.me.mem.ink || 0) - 1); },
  skill: { name: 'Splat Roller', type: 'G', cost: 2, listed: 3, bonus: () => N.inkling.s },
  potential: p => 1.5 * (p.mem.ink || 0),
});
// 65 Ridley
def('ridley', 'Ridley', {
  winBonus: c => isG(c.act) ? N.ridley.p : 0, vuln: c => isC(c.oppAct) ? 2 : 0,
  skill: { name: 'Space Pirate Rush', type: 'G', cost: 2, listed: 7, bonus: () => N.ridley.s },
});
// 66 Simon
def('simon', 'Simon', {
  winBonus: c => basic(c.act) && isA(c.act) ? N.simon.p : 0,
  skill: { name: 'Holy Water', type: 'A', cost: 2, listed: 9, bonus: () => N.simon.s, rider: c => burn(c.g, c.opp, N.simon.burn, 2) },
});
// 66e Richter
def('richter', 'Richter', {
  winBonus: c => c.me.mem.hr === 1 ? (c.me.mem.hr = 2, N.richter.p) : 0,
  onTurnEnd: c => { if (c.me.hp > 0 && c.me.hp < 30 && !c.me.mem.hr) { c.me.mem.hr = 1; E.emit(c.g, 'Hunter\'s Resolve: Richter\'s next win deals +' + N.richter.p + '.'); } },
  skill: { name: 'Cross', type: 'A', cost: 2, listed: 8, bonus: () => N.richter.s, rider: c => burn(c.g, c.opp, N.richter.burn, 1) },
});
// 67 King K. Rool
def('krool', 'King K. Rool', {
  initMem: () => ({ belly: 20, broke: 0 }),
  reduce: (c, d) => { const m = c.me.mem; if (c.oppAct && c.oppAct.type === 'A' && m.belly > 0) { const r = Math.min(N.krool.p, d, m.belly); m.belly -= r; if (m.belly === 0) m.broke = c.T; return d - r; } return d; },
  onTurnEnd: c => { const m = c.me.mem; if (m.belly === 0 && c.T - m.broke >= 5) m.belly = 20; },
  skill: { name: 'Gut Check', type: 'C', cost: 2, listed: 5, bonus: () => N.krool.s, rider: c => { c.me.mem.belly = 20; } },
  potential: p => (p.mem.belly || 0) * 0.3,
});
// 68 Isabelle
def('isabelle', 'Isabelle', {
  onLose: c => { if (turnsDiv(c.T, 4)) selfDmg(c.opp, N.isabelle.p, c.g); },
  skill: { name: 'Fishing Rod', type: 'G', cost: 2, listed: 4, bonus: () => N.isabelle.s, rider: c => drain(c.opp, 1, c.g) },
});
// 69 Incineroar
def('incin', 'Incineroar', {
  onLose: c => charge(c.me, N.incin.p, c.g),
  skill: { name: 'Alolan Whip', type: 'G', cost: 2, listed: 7, bonus: () => N.incin.s },
});
// 70 Piranha Plant
def('plant', 'Piranha Plant', {
  onWin: c => { if (isC(c.act)) burn(c.g, c.opp, N.plant.p, 2); },
  skill: { name: 'Chewing', type: 'G', cost: 3, listed: 12, bonus: () => N.plant.s },
});
// 71 Joker
const arsene = (p, T) => (p.mem.ars || 0) >= T;
def('joker', 'Joker', {
  onHit: (c, d) => { const m = c.me.mem; if (arsene(c.me, c.T + 1)) return; m.acc = (m.acc || 0) + d; if (m.acc >= 30) { m.acc = 0; m.ars = c.T + 4; E.emit(c.g, 'Joker summons Arsene for 4 turns!'); } },
  winBonus: c => arsene(c.me, c.T) ? N.joker.p : 0,
  costMod: (p, o, g) => arsene(p, g.T) ? -1 : 0,
  skill: { name: "Rebel's Guard", type: 'C', cost: 2, listed: 3, bonus: c => N.joker.s + (arsene(c.me, c.T) ? N.joker.x : 0) },
  potential: (p, g) => arsene(p, g.T + 1) ? 8 : (p.mem.acc || 0) * 0.2,
});
// 72 Hero
def('hero', 'Hero', {
  winBonus: c => Math.min(3, Math.floor((c.T - 1) / 5)),
  skill: { name: 'Command Selection', type: 'A', cost: 2, listed: 7,
    bonus: c => { const r = Math.floor(c.g.rng() * 4); c.me.mem.spell = r;
      const b = [10, 5, 3, 3][r] + N.hero.s; return r === 3 && c.opp.hp < 25 ? 999 : b; },
    rider: c => { const r = c.me.mem.spell; if (r === 1) burn(c.g, c.opp, 2, 2); if (r === 2) charge(c.me, 8, c.g); } },
});
// 73 Banjo & Kazooie
def('banjo', 'Banjo & Kazooie', {
  initMem: () => ({ feathers: 5, wins: 0 }),
  onWin: c => { c.me.mem.wins++; if (c.me.mem.wins % 5 === 0) heal(c.me, 10, c.g); },
  skill: { name: 'Wonderwing', type: 'A', cost: () => N.banjo.cost, listed: 6, clashWin: true, bonus: () => N.banjo.s,
    can: p => (p.mem.feathers ?? 5) > 0, onUse: c => { c.me.mem.feathers = (c.me.mem.feathers ?? 5) - 1; } },
});
// 74 Terry
def('terry', 'Terry', {
  costMod: p => p.hp < 40 ? -1 : 0,
  skill: { name: 'Power Dunk', type: 'G', cost: 2, listed: 6, bonus: c => N.terry.s + (c.me.hp < 40 ? N.terry.p : 0) },
});
// 75 Byleth — Divine Pulse auto-used on a lethal or 15+ damage turn
def('byleth', 'Byleth', {
  // Players arm Divine Pulse before locking in (mem.dpArmed true/false). The CPU (dpArmed undefined) uses it automatically on a lethal or 10+ damage turn.
  onTurnEnd: c => {
    const m = c.me.mem; if (m.dp || c.res !== 'lose' || c.me.dmgTurn <= 0) return;
    const fire = m.dpArmed === undefined ? (c.me.dmgTurn >= N.byleth.thr || c.me.hp <= 0) : m.dpArmed;
    if (fire) { m.dp = 1; const u = Math.min(N.byleth.cap, c.me.dmgTurn); c.me.hp += u; E.emit(c.g, `Divine Pulse! Byleth undoes ${u} damage.`); }
  },
  skill: { name: 'Sword of the Creator', type: 'G', cost: 2, listed: 5, bonus: () => N.byleth.s, rider: c => setStatus(c.g, c.opp, 'lock', 1, 'C') },
});
// 76 Min Min
def('minmin', 'Min Min', {
  winBonus: c => { const h = last(c.me); return basic(c.act) && h && h.type === c.act.type ? N.minmin.p : 0; },
  skill: { name: 'Megawatt Punch', type: 'A', cost: 2, listed: 5, bonus: () => N.minmin.s, rider: c => weaken(c.opp, N.minmin.w, c.g) },
});
// 77 Steve
def('steve', 'Steve', {
  winBonus: c => c.me.mem.tier || 0,
  onTurnEnd: c => { if (turnsDiv(c.T, 4) && (c.me.mem.tier || 0) < 3) { c.me.mem.tier = (c.me.mem.tier || 0) + 1; E.emit(c.g, `Steve crafts ${['', 'Stone', 'Iron', 'Diamond'][c.me.mem.tier]} tools.`); } },
  onSkillLose: c => { c.me.mem.tier = Math.max(0, (c.me.mem.tier || 0) - 1); },
  skill: { name: 'Minecart', type: 'G', cost: 2, listed: 6, bonus: () => N.steve.s },
  potential: p => 4 * (p.mem.tier || 0),
});
// 78 Sephiroth
const wing = c => c.opp.hp - c.me.hp >= 30;
def('seph', 'Sephiroth', {
  winBonus: c => wing(c) ? N.seph.p : 0, turnMeter: c => wing(c) ? 1 : 0,
  skill: { name: 'Scintilla', type: 'C', cost: 2, listed: 6, bonus: () => N.seph.s, rider: c => { if (opSkill(c)) drain(c.opp, 2, c.g); } },
});
// 79 Pyra / Mythra
const isP = p => (p.mem.form || 'P') === 'P';
def('pyra', 'Pyra / Mythra', {
  winBonus: c => isP(c.me) ? N.pyra.p : 0,
  onWin: c => { if (!isP(c.me)) gain(c.g, c.me, 1); },
  onTurnEnd: c => { if (c.act.kind === 'skill') { c.me.mem.form = isP(c.me) ? 'M' : 'P'; E.emit(c.g, `Aegis Swap: ${isP(c.me) ? 'Pyra' : 'Mythra'} takes over.`); } },
  skill: { name: 'Prominence Revolt / Foresight', type: p => isP(p) ? 'A' : 'C', cost: 2, listed: 7,
    bonus: c => N.pyra.s + (isP(c.me) ? N.pyra.sP : N.pyra.sM), rider: c => { if (!isP(c.me)) charge(c.me, 4, c.g); } },
});
// 81 Kazuya
def('kazuya', 'Kazuya', {
  winBonus: c => c.me.hp < 35 ? N.kazuya.p + (c.me.mem.rd ? 0 : (c.me.mem.rd = 1, N.kazuya.rd)) : 0,
  skill: { name: "Heaven's Door", type: 'G', cost: 2, listed: 7, bonus: () => N.kazuya.s },
});
// 82 Sora
def('sora', 'Sora', {
  onLethal: c => { if (!c.me.mem.sc && c.me.hp + c.me.dmgTurn >= N.sora.req) { c.me.mem.sc = 1; c.me.hp = 1; E.emit(c.g, 'Second Chance! Sora hangs on with 1 HP.'); } },
  skill: { name: 'Magic Cycle', type: 'A', cost: 2, listed: 5,
    onUse: c => { c.me.mem.sp = c.me.mem.spn || 0; c.me.mem.spn = ((c.me.mem.spn || 0) + 1) % 3; },
    bonus: c => N.sora.x + (c.me.mem.sp === 2 ? N.sora.th : N.sora.s),
    rider: c => { const s = c.me.mem.sp; if (s === 0) burn(c.g, c.opp, 2, 2); if (s === 1 && c.oppAct.kind === 'basic') setStatus(c.g, c.opp, 'lock', 1, c.oppAct.type); } },
});

const KITS = require('../data/kits.json');
for (const f of F) { const k = KITS.find(x => x.id === f.id); f.passiveName = k ? k.passive.name : 'Passive'; f.fsName = k ? k.finalSmash : 'Final Smash'; }
const BY_ID = Object.fromEntries(F.map(f => [f.id, f]));
module.exports = { FIGHTERS: F, BY_ID, N };

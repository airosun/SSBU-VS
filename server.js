// SSBU-VS server: serves the client and runs every battle on the shared engine.
'use strict';
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const E = require('./src/engine');
const AI = require('./src/ai');
const { FIGHTERS, BY_ID } = require('./src/fighters');
const KITS = require('./data/kits.json');
const { view, actLabel } = require('./src/view');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/kits', (_, res) => res.json({ kits: KITS, rules: E.RULES }));

const rooms = new Map(); // code -> room
const newStats = () => ({ dealt: 0, hitTaken: 0, otherTaken: 0, healed: 0, biggest: 0, biggestWith: '', biggestTurn: 0, fsDamage: 0,
  wins: 0, losses: 0, clashes: 0, whiffs: 0, acts: { A: 0, C: 0, G: 0 }, skillUses: 0, skillWins: 0, fsUses: 0,
  meterGained: 0, meterSpent: 0, streak: 0, bestStreak: 0 });
const code = () => { let c; do c = Math.random().toString(36).slice(2, 6).toUpperCase(); while (rooms.has(c)); return c; };

function newRoom(cpu) {
  const r = { code: code(), cpu, seats: [null, null], picks: [null, null], game: null, pending: [null, null], log: [], rematch: [false, false], reveal: null };
  rooms.set(r.code, r);
  return r;
}
function seatOf(r, id) { return r.seats.findIndex(s => s && s.id === id); }

function lobby(r, i = 0) {
  return { code: r.code, cpu: r.cpu, players: r.seats.map((s, i) => s && { name: s.name, picked: !!r.picks[i], away: !!s.away }), myPick: r.picks[i] };
}
function push(r) {
  r.seats.forEach((s, i) => {
    if (!s || s.cpu) return;
    const sock = s.id && io.sockets.sockets.get(s.id);
    if (!sock) return;
    if (!r.game) sock.emit('lobby', lobby(r, i));
    else sock.emit('state', { ...view(r.game, i, r.pending, r.reveal), log: r.log.slice(-300), names: r.seats.map(x => x && x.name), code: r.code, cpu: r.cpu, away: r.seats.map(x => !!(x && x.away)), rematch: r.rematch, stats: r.game.over ? { players: r.game.stats, timeline: r.timeline, turns: r.game.T - 1 } : null });
  });
}
// fighters are called by name alone; only a mirror match adds the player's name to tell them apart
const who = (g, names, i) => g.p[0].f.id === g.p[1].f.id ? `${names[i]}'s ${E.nameOf(g.p[i])}` : E.nameOf(g.p[i]);
function start(r) {
  r.game = E.newGame(BY_ID[r.picks[0]], BY_ID[r.picks[1]], (Math.random() * 2 ** 31) | 0);
  r.pending = [null, null]; r.rematch = [false, false]; r.reveal = null;
  r.game.stats = [newStats(), newStats()];
  r.timeline = [{ turn: 0, hp: r.game.p.map(p => p.hp), meter: [0, 0] }];
  r.log = [{ turn: 0, lines: [`Battle start: ${who(r.game, r.seats.map(x => x.name), 0)} vs ${who(r.game, r.seats.map(x => x.name), 1)}`] }];
  push(r);
}
function tryResolve(r) {
  const g = r.game;
  if (r.cpu && !r.pending[1]) r.pending[1] = AI.chooseActions(g)[1];
  if (!r.pending[0] || !r.pending[1]) return push(r);
  const acts = r.pending.map(a => ({ kind: a.kind, type: a.type }));
  r.pending.forEach((a, i) => {
    g.p[i].mem.artPick = a.art || null;
    if (g.p[i].f.id === 'byleth' && !r.seats[i].cpu) g.p[i].mem.dpArmed = !!a.pulse;   // human Byleth chooses
  });
  const turn = g.T, names = r.seats.map(s => s.name);
  const before = { hp: g.p.map(p => Math.max(0, p.hp)), meter: g.p.map(p => p.meter) };
  const labels = acts.map((a, i) => actLabel(g.p[i], a));
  g.events = []; g.announce = [];
  labels.forEach((l, i) => g.events.push(`${who(g, names, i)} chose ${l.title}${l.sub && l.sub !== 'Basic' ? ` (${l.sub})` : ''}.`));
  const spent = acts.map((a, i) => a.kind === 'skill' ? E.skillCost(g, g.p[i], g.p[1 - i]) : a.kind === 'fs' ? g.p[i].meter : 0);
  const out = E.resolve(g, acts);
  acts.forEach((a, i) => {
    const st = g.stats[i];
    if (a.kind === 'basic') st.acts[a.type]++;
    if (a.kind === 'skill') { st.skillUses++; if (out.winner === i) st.skillWins++; }
    if (a.kind === 'fs') st.fsUses++;
    if (a.kind === 'dodge') st.dodges = (st.dodges || 0) + 1;
    if (out.kind === 'win') { if (out.winner === i) { st.wins++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else { st.losses++; st.streak = 0; } }
    else { st.streak = 0; if (out.kind === 'clash') st.clashes++; if (out.kind === 'whiff') st.whiffs++; }
    st.meterSpent += spent[i]; st.meterGained += g.p[i].meter - before.meter[i] + spent[i];
  });
  r.timeline.push({ turn, hp: g.p.map(p => Math.max(0, p.hp)), meter: g.p.map(p => p.meter) });
  for (let i = 0; i < 2; i++) {
    const p = g.p[i], dh = Math.max(0, p.hp) - before.hp[i], dm = p.meter - before.meter[i];
    g.events.push(`${E.nameOf(p)}: ${Math.max(0, p.hp)}/${p.maxHp} HP (${dh >= 0 ? '+' : ''}${dh}), meter ${p.meter}/${E.RULES.METER_MAX} (${dm >= 0 ? '+' : ''}${dm}).`);
  }
  if (g.over) g.events.push(g.winner === -1 ? 'DRAW!' : `GAME! ${who(g, names, g.winner)} wins!`);
  r.reveal = { turn, kind: out.kind, winner: out.winner, acts: labels, before, events: g.events, announce: g.announce };
  r.log.push({ turn, lines: g.events });
  g.events = null; g.announce = null;
  r.pending = [null, null];
  push(r);
}

// Players are identified by a per-browser id (pid), not by socket, so tabbing out, a phone
// sleeping, a network blip or even a page reload drops you straight back into your game.
const GRACE_CPU = 30 * 60e3, GRACE_PVP = 5 * 60e3;
function roomOfPid(pid) {
  if (!pid) return null;
  for (const r of rooms.values()) if (r.seats.some(s => s && s.pid === pid)) return r;
  return null;
}
function dropSeat(r, i) {
  const s = r.seats[i]; if (s && s.timer) clearTimeout(s.timer);
  r.seats[i] = null;
  if (r.seats.every(x => !x || x.cpu)) { r.seats.forEach(x => x && x.timer && clearTimeout(x.timer)); rooms.delete(r.code); }
  else { r.game = null; r.picks = [null, null]; r.log = []; r.reveal = null; push(r); }
}

io.on('connection', sock => {
  const pid = String((sock.handshake.auth && sock.handshake.auth.pid) || '').slice(0, 64) || null;
  let room = roomOfPid(pid);
  if (room) {                                   // reconnect: take the seat back
    const s = room.seats.find(x => x && x.pid === pid);
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    s.id = sock.id; s.away = false;
    push(room);
  } else sock.emit('noRoom');
  const leave = () => {                         // deliberate leave: give the seat up now
    if (!room) return;
    const i = seatOf(room, sock.id);
    if (i >= 0) dropSeat(room, i);
    room = null;
  };
  const away = () => {                          // lost connection: hold the seat for a while
    if (!room) return;
    const r = room, i = seatOf(r, sock.id);
    if (i < 0) return;                          // another tab already took this seat over
    const s = r.seats[i]; s.away = true; s.id = null;
    s.timer = setTimeout(() => { if (r.seats[i] === s && s.away) dropSeat(r, i); }, r.cpu ? GRACE_CPU : GRACE_PVP);
    push(r);
  };
  sock.on('cpu', ({ name }) => {
    leave(); room = newRoom(true);
    room.seats = [{ id: sock.id, pid, name: name || 'Player' }, { cpu: true, name: 'CPU' }];
    sock.emit('lobby', lobby(room));
  });
  sock.on('create', ({ name }) => {
    leave(); room = newRoom(false);
    room.seats[0] = { id: sock.id, pid, name: name || 'Player 1' };
    sock.emit('lobby', lobby(room));
  });
  sock.on('join', ({ name, code: c }) => {
    const r = rooms.get(String(c || '').toUpperCase());
    if (!r || r.cpu) return sock.emit('err', 'Room not found.');
    if (r === room) return push(r);
    const free = r.seats.findIndex(s => !s);
    if (free < 0) return sock.emit('err', 'That room is full.');
    leave(); room = r;
    r.seats[free] = { id: sock.id, pid, name: name || `Player ${free + 1}` };
    push(r);
  });
  sock.on('pick', ({ id }) => {
    if (!room || room.game || !BY_ID[id]) return;
    const i = seatOf(room, sock.id); if (i < 0) return;
    room.picks[i] = id;
    if (room.cpu) room.picks[1] = FIGHTERS[(Math.random() * FIGHTERS.length) | 0].id;
    if (room.picks.every(Boolean) && room.seats.every(Boolean)) start(room); else push(room);
  });
  sock.on('act', a => {
    if (!room || !room.game || room.game.over) return;
    const i = seatOf(room, sock.id); if (i < 0 || room.pending[i]) return;
    if (a.turn !== room.game.T) return; // stale click from a previous turn
    const legal = E.legalActions(room.game, i);
    if (!legal.some(l => l.kind === a.kind && l.type === a.type)) return sock.emit('err', 'You can’t do that this turn.');
    room.pending[i] = { kind: a.kind, type: a.type, art: ['buster', 'shield', 'speed'].includes(a.art) ? a.art : null, pulse: !!a.pulse };
    tryResolve(room);
  });
  sock.on('rematch', () => {
    if (!room || !room.game || !room.game.over) return;
    const i = seatOf(room, sock.id); if (i < 0) return;
    room.rematch[i] = true;
    if (room.cpu) room.rematch[1] = true;
    if (room.rematch.every(Boolean)) start(room); else push(room);
  });
  sock.on('newFighters', () => {
    if (!room) return;
    room.game = null; room.picks = [null, null]; room.log = []; room.reveal = null;
    push(room);
  });
  sock.on('leave', leave);
  sock.on('disconnect', away);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SSBU-VS listening on ${PORT}`));

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
const { view, describeTurn } = require('./src/view');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/kits', (_, res) => res.json({ kits: KITS, rules: E.RULES }));

const rooms = new Map(); // code -> room
const code = () => { let c; do c = Math.random().toString(36).slice(2, 6).toUpperCase(); while (rooms.has(c)); return c; };

function newRoom(cpu) {
  const r = { code: code(), cpu, seats: [null, null], picks: [null, null], game: null, pending: [null, null], log: [], rematch: [false, false] };
  rooms.set(r.code, r);
  return r;
}
function seatOf(r, id) { return r.seats.findIndex(s => s && s.id === id); }

function lobby(r) {
  return { code: r.code, cpu: r.cpu, players: r.seats.map((s, i) => s && { name: s.name, picked: !!r.picks[i] }) };
}
function push(r) {
  r.seats.forEach((s, i) => {
    if (!s || s.cpu) return;
    const sock = io.sockets.sockets.get(s.id);
    if (!sock) return;
    if (!r.game) sock.emit('lobby', lobby(r));
    else sock.emit('state', { ...view(r.game, i, r.pending), log: r.log.slice(-40), names: r.seats.map(x => x && x.name), code: r.code, cpu: r.cpu, rematch: r.rematch });
  });
}
function start(r) {
  r.game = E.newGame(BY_ID[r.picks[0]], BY_ID[r.picks[1]], (Math.random() * 2 ** 31) | 0);
  r.pending = [null, null]; r.rematch = [false, false];
  r.log = [`Battle start: ${r.game.p[0].f.name} vs ${r.game.p[1].f.name}`];
  push(r);
}
function tryResolve(r) {
  const g = r.game;
  if (r.cpu && !r.pending[1]) r.pending[1] = AI.chooseActions(g)[1];
  if (!r.pending[0] || !r.pending[1]) return push(r);
  const before = E.cloneGame(g);
  const acts = r.pending.map(a => ({ kind: a.kind, type: a.type }));
  r.pending.forEach((a, i) => { g.p[i].mem.artPick = a.art || null; });
  const out = E.resolve(g, acts);
  r.log.push(...describeTurn(before, g, acts, out, r.seats.map(s => s.name)));
  r.pending = [null, null];
  push(r);
}

io.on('connection', sock => {
  let room = null;
  const leave = () => {
    if (!room) return;
    const i = seatOf(room, sock.id);
    if (i >= 0) room.seats[i] = null;
    if (room.seats.every(s => !s || s.cpu)) rooms.delete(room.code);
    else { room.game = null; room.picks = [null, null]; room.log = []; push(room); }
    room = null;
  };
  sock.on('cpu', ({ name }) => {
    leave(); room = newRoom(true);
    room.seats = [{ id: sock.id, name: name || 'Player' }, { cpu: true, name: 'CPU' }];
    sock.emit('lobby', lobby(room));
  });
  sock.on('create', ({ name }) => {
    leave(); room = newRoom(false);
    room.seats[0] = { id: sock.id, name: name || 'Player 1' };
    sock.emit('lobby', lobby(room));
  });
  sock.on('join', ({ name, code: c }) => {
    const r = rooms.get(String(c || '').toUpperCase());
    if (!r || r.cpu) return sock.emit('err', 'Room not found.');
    const free = r.seats.findIndex(s => !s);
    if (free < 0) return sock.emit('err', 'That room is full.');
    leave(); room = r;
    r.seats[free] = { id: sock.id, name: name || `Player ${free + 1}` };
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
    room.pending[i] = { kind: a.kind, type: a.type, art: ['buster', 'shield', 'speed'].includes(a.art) ? a.art : null };
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
    room.game = null; room.picks = [null, null]; room.log = [];
    push(room);
  });
  sock.on('leave', leave);
  sock.on('disconnect', leave);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SSBU-VS listening on ${PORT}`));

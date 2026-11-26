// SSBU-VS client
const socket = io();
const $ = s => document.querySelector(s);
const TYPE = { A: 'Attack', C: 'Counter', G: 'Grab', FS: 'Final Smash' };
let KITS = [], BY = {}, myPick = null, lastState = null;

const screens = ['home', 'select', 'battle'];
const show = id => screens.forEach(s => $('#' + s).classList.toggle('hidden', s !== id));
const nameVal = () => $('#name').value.trim() || 'Player';
const initials = n => n.split(/[\s/&.-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
// Optional art: drop your own images in public/art/<fighter id>.png
const portrait = k => `<div class="portrait"><img src="art/${k.id}.png" alt="" onerror="this.remove()"><span>${initials(k.name)}</span></div>`;
const typeTag = t => ['Attack', 'Counter', 'Grab'].includes(t) ? `<span class="tag ${t}">${t}</span>` : `<span class="tag flex">${t}</span>`;

fetch('/api/kits').then(r => r.json()).then(d => {
  KITS = d.kits.slice().sort((a, b) => a.name.localeCompare(b.name));
  BY = Object.fromEntries(KITS.map(k => [k.id, k]));
  renderGrid();
});
$('#name').value = localStorage.getItem('ssbuvs-name') || '';
$('#name').addEventListener('change', () => localStorage.setItem('ssbuvs-name', $('#name').value));

$('#cpuBtn').onclick = () => socket.emit('cpu', { name: nameVal() });
$('#createBtn').onclick = () => socket.emit('create', { name: nameVal() });
$('#joinBtn').onclick = () => socket.emit('join', { name: nameVal(), code: $('#code').value });
$('#howBtn').onclick = () => $('#how').showModal();
$('#search').oninput = renderGrid; $('#typeFilter').onchange = renderGrid;
$('#rematchBtn').onclick = () => socket.emit('rematch');
$('#newBtn').onclick = () => { myPick = null; socket.emit('newFighters'); };
$('#homeBtn').onclick = () => { socket.emit('leave'); myPick = null; show('home'); };

function renderGrid() {
  const q = $('#search').value.toLowerCase(), t = $('#typeFilter').value;
  $('#grid').innerHTML = KITS.filter(k =>
    (!q || (k.name + ' ' + k.series).toLowerCase().includes(q)) &&
    (!t || (t === 'flex' ? !['Attack', 'Counter', 'Grab'].includes(k.skill.type) : k.skill.type === t))
  ).map(k => `
    <div class="card ${myPick === k.id ? 'picked' : ''}" data-id="${k.id}">
      ${portrait(k)}
      <div><h3>${k.name}</h3><div class="series">${k.series}</div></div>
      <div class="kit"><b>${k.passive.name}</b> — ${k.passive.text}<br>
        <b>${k.skill.name}</b> ${typeTag(k.skill.type)} · ${k.skill.cost} meter — ${k.skill.text}</div>
    </div>`).join('');
  document.querySelectorAll('.card').forEach(c => c.onclick = () => { myPick = c.dataset.id; socket.emit('pick', { id: myPick }); renderGrid(); });
}

socket.on('err', m => alert(m));
socket.on('lobby', l => {
  show('select');
  const others = l.players.map((p, i) => p ? `${p.name}${p.picked ? ' ✓' : ''}` : '<i>waiting…</i>').join(' vs ');
  $('#lobbyInfo').innerHTML = l.cpu ? `Pick your fighter — the CPU picks at random.` : `Room <b>${l.code}</b> · ${others} · share the code with a friend`;
});

function sideHTML(s, name, mine) {
  const k = BY[s.id] || { name: s.name, id: s.id };
  const pct = Math.max(0, s.hp) / s.maxHp * 100;
  const pips = s.meter === null ? '<span class="small">Meter hidden (Cardboard Box)</span>'
    : Array.from({ length: s.meterMax }, (_, i) => `<div class="pip ${i < s.meter ? 'on' : ''}"></div>`).join('');
  return `<h2>${portrait(k)} <span>${s.name}<div class="small">${name}${mine ? ' (you)' : ''}</div></span></h2>
    <div class="hpbar"><div class="${pct <= 30 ? 'low' : ''}" style="width:${pct}%"></div></div>
    <div class="small">${Math.max(0, s.hp)} / ${s.maxHp} HP</div>
    <div class="meter">${pips}</div>
    <div class="small"><b>${k.passive ? k.passive.name : ''}</b> · <b>${s.skill.name}</b> (${TYPE[s.skill.type] || s.skill.type}${s.skill.cost !== null ? `, ${s.skill.cost} meter` : ''})</div>
    <div class="chips">${s.statuses.map(x => `<span class="chip">${x}</span>`).join('')}${s.trackers.map(t => `<span class="chip">${t.label}: ${t.value}</span>`).join('')}</div>`;
}

socket.on('state', st => {
  lastState = st; show('battle');
  const me = st.seat, names = st.names;
  $('#meSide').innerHTML = sideHTML(st.me, names[me], true);
  $('#oppSide').innerHTML = sideHTML(st.opp, names[1 - me], false);
  $('#turn').textContent = st.over ? 'Game over' : `Turn ${st.turn}`;
  $('#artPick').classList.toggle('hidden', !st.shulk || st.over);
  $('#actions').innerHTML = st.actions.map((a, i) => {
    const label = a.kind === 'fs' ? 'FINAL SMASH' : a.kind === 'skill' ? `${st.me.skill.name}<br><small>${TYPE[a.type]} skill · ${st.me.skill.cost}</small>` : TYPE[a.type];
    return `<button class="${a.kind === 'fs' ? 'FS' : a.type} ${a.kind}" data-i="${i}" ${st.waiting ? 'disabled' : ''}>${label}</button>`;
  }).join('');
  document.querySelectorAll('#actions button').forEach(b => b.onclick = () => {
    const a = st.actions[+b.dataset.i];
    const art = st.shulk ? (document.querySelector('input[name=art]:checked') || {}).value : undefined;
    socket.emit('act', { ...a, art, turn: st.turn });
  });
  $('#status').textContent = st.over
    ? (st.winner === -1 ? 'Draw!' : st.winner === me ? 'You win!' : 'You lose!')
    : st.waiting ? 'Locked in — waiting for your opponent…' : st.oppReady ? 'Your opponent has locked in.' : 'Choose your action.';
  $('#after').classList.toggle('hidden', !st.over);
  $('#rematchBtn').textContent = st.rematch && st.rematch[me] ? 'Waiting for rematch…' : 'Rematch';
  $('#log').innerHTML = st.log.slice().reverse().map(l => `<li>${l.replace(/</g, '&lt;')}</li>`).join('');
});

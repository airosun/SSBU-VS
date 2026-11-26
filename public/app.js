// SSBU-VS client
const socket = io();
const $ = s => document.querySelector(s);
const TYPE = { A: 'Attack', C: 'Counter', G: 'Grab', FS: 'Final Smash' };
const wait = ms => new Promise(r => setTimeout(r, ms));
let KITS = [], BY = {}, myPick = null;
let shown = null;          // the state currently drawn on screen
let animating = false, queued = null, lastAnimTurn = 0, logTurnsShown = 0;

const screens = ['home', 'select', 'battle'];
const show = id => screens.forEach(s => $('#' + s).classList.toggle('hidden', s !== id));
const nameVal = () => $('#name').value.trim() || 'Player';
const initials = n => n.split(/[\s/&.-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const img = (artId, name, cls = 'portrait') => `<div class="${cls}"><img src="images/${artId}.png" alt="" onerror="this.remove()"><span>${initials(name)}</span></div>`;
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
$('#logToggle').onclick = () => { const c = $('#logBox').classList.toggle('collapsed'); $('#logToggle').textContent = c ? 'Show full log ▾' : 'Hide full log ▴'; };
$('#homeBtn').onclick = () => { socket.emit('leave'); myPick = null; resetBattle(); show('home'); };

function resetBattle() { shown = null; queued = null; animating = false; lastAnimTurn = 0; logTurnsShown = 0; $('#log').innerHTML = ''; }

// ---------- fighter select ----------
function renderGrid() {
  const q = $('#search').value.toLowerCase(), t = $('#typeFilter').value;
  $('#grid').innerHTML = KITS.filter(k =>
    (!q || (k.name + ' ' + k.series).toLowerCase().includes(q)) &&
    (!t || (t === 'flex' ? !['Attack', 'Counter', 'Grab'].includes(k.skill.type) : k.skill.type === t))
  ).map(k => `
    <div class="card ${myPick === k.id ? 'picked' : ''}" data-id="${k.id}">
      ${img(k.id, k.name)}
      <div><h3>${k.name}</h3><div class="series">${k.series}</div></div>
      <div class="kit"><b>${k.passive.name}</b> — ${k.passive.text}<br>
        <b>${k.skill.name}</b> ${typeTag(k.skill.type)} · ${k.skill.cost} meter — ${k.skill.text}</div>
    </div>`).join('');
  document.querySelectorAll('#grid .card').forEach(c => c.onclick = () => { myPick = c.dataset.id; socket.emit('pick', { id: myPick }); renderGrid(); });
}

socket.on('err', m => alert(m));
socket.on('lobby', l => {
  resetBattle(); show('select');
  const others = l.players.map(p => p ? `${esc(p.name)}${p.picked ? ' ✓' : ''}` : '<i>waiting…</i>').join(' vs ');
  $('#lobbyInfo').innerHTML = l.cpu ? 'Pick your fighter — the CPU picks at random.' : `Room <b>${l.code}</b> · ${others} · share the code with a friend`;
});

// ---------- side panels ----------
function sideHTML(s, player, mine) {
  const pct = 100 * s.hp / s.maxHp;
  const meter = s.meter === null ? '<div class="hiddenMeter">Meter hidden (Cardboard Box)</div>'
    : `<div class="smeter ${s.meter >= s.meterMax ? 'full' : ''}">${Array.from({ length: s.meterMax }, (_, i) => `<div class="seg ${i < s.meter ? 'on' : ''}"></div>`).join('')}</div>`;
  return `
    <div class="pname">${esc(player)}${mine ? ' (you)' : ''}</div>
    <div class="who"><div class="pwrap">${img(s.art, s.name)}${s.fx.marks.map(W.mark).join('')}</div><div><div class="cname">${s.name}</div>
      <div class="small">${s.passive} · <span class="skl ${s.skill.copied ? 'copied' : ''} ${s.skill.protean ? 'protean' : ''}">${s.skill.copied ? 'Copied: ' : ''}${s.skill.name} <span class="tag ${TYPE[s.skill.type] || 'flex'}">${TYPE[s.skill.type] || s.skill.type}</span>${s.skill.cost !== null ? ` ${s.skill.cost}` : ''}</span></div></div></div>
    <div class="lbl"><span>HP</span><span class="hpnum">${s.hp} / ${s.maxHp}</span></div>
    <div class="hp ${s.fx.hp ? 'fx-' + s.fx.hp : ''}"><div class="ghost" style="width:${pct}%"></div><div class="fill ${pct <= 30 ? 'low' : pct <= 60 ? 'mid' : ''}" style="width:${pct}%"></div></div>
    <div class="lbl"><span>Smash Meter</span><span class="mnum">${s.meter === null ? '?' : `${s.meter} / ${s.meterMax}`}</span></div>
    ${meter}
    ${s.resources.length ? `<div class="res">${s.resources.map(W.render).join('')}</div>` : ''}
    ${s.statuses.length ? `<div class="chips">${s.statuses.map(x => `<span class="chip">${x}</span>`).join('')}</div>` : ''}`;
}
function drawSides(st) {
  $('#meSide').innerHTML = sideHTML(st.me, st.names[st.seat], true);
  $('#oppSide').innerHTML = sideHTML(st.opp, st.names[1 - st.seat], false);
}
// Move HP bars and meters from what is on screen to the new values, with animation
function animateBars(el, from, to) {
  const pct = 100 * to.hp / to.maxHp;
  const fill = el.querySelector('.hp .fill'), ghost = el.querySelector('.hp .ghost');
  fill.className = `fill ${pct <= 30 ? 'low' : pct <= 60 ? 'mid' : ''}`;
  if (to.hp >= from.hp) { ghost.style.width = pct + '%'; fill.style.width = pct + '%'; if (to.hp > from.hp) el.querySelector('.hp').classList.add('heal'); }
  else { fill.style.width = pct + '%'; ghost.style.width = pct + '%'; }
  el.querySelector('.hpnum').textContent = `${to.hp} / ${to.maxHp}`;
  const segs = el.querySelectorAll('.seg');
  if (segs.length && to.meter !== null && from.meter !== null) {
    segs.forEach((sg, i) => {
      const was = i < from.meter, now = i < to.meter;
      sg.classList.toggle('on', now);
      if (now && !was) { sg.classList.remove('gain'); void sg.offsetWidth; sg.classList.add('gain'); }
      if (!now && was) { sg.classList.remove('spent'); void sg.offsetWidth; sg.classList.add('spent'); }
    });
    el.querySelector('.smeter').classList.toggle('full', to.meter >= to.meterMax);
    el.querySelector('.mnum').textContent = `${to.meter} / ${to.meterMax}`;
  }
}

// ---------- center stage ----------
function cardBack(el, locked) { const b = el.querySelector('.back'); b.innerHTML = locked ? 'LOCKED IN' : '?'; b.classList.toggle('locked', locked); }
function cardFront(el, act, side) {
  const f = el.querySelector('.front');
  f.className = `face front ${act.type}`;
  f.innerHTML = `<img src="images/${side.art}.png" alt="" onerror="this.remove()"><div class="t">${esc(act.title)}</div><div class="s">${esc(act.sub)}</div>`;
}
function resetStage(st) {
  for (const k of ['me', 'opp']) { $(`#${k}Slot`).className = 'slot'; $(`#${k}Card`).classList.remove('flipped'); }
  cardBack($('#meCard'), !!st.waiting); cardBack($('#oppCard'), !!st.oppReady);
  $('#burst').className = ''; $('#burst').textContent = '';
}
function burst(txt) { const b = $('#burst'); b.textContent = txt; b.className = ''; void b.offsetWidth; b.className = 'go'; }

// ---------- controls & log ----------
function drawControls(st) {
  $('#turn').textContent = st.over ? 'GAME OVER' : `TURN ${st.turn}`;
  $('#artPick').classList.toggle('hidden', !st.shulk || st.over);
  $('#actions').innerHTML = st.over ? '' : st.actions.map((a, i) => {
    const label = a.kind === 'fs' ? 'FINAL SMASH' : a.kind === 'skill' ? `${esc(st.me.skill.name)}<br><small>${TYPE[a.type]} skill · ${st.me.skill.cost} meter</small>` : TYPE[a.type];
    return `<button class="${a.kind === 'fs' ? 'FS' : a.type} ${a.kind}" data-i="${i}" ${st.waiting ? 'disabled' : ''}>${label}</button>`;
  }).join('');
  document.querySelectorAll('#actions button').forEach(b => b.onclick = () => {
    const a = st.actions[+b.dataset.i];
    const art = st.shulk ? (document.querySelector('input[name=art]:checked') || {}).value : undefined;
    socket.emit('act', { ...a, art, turn: st.turn });
    document.querySelectorAll('#actions button').forEach(x => (x.disabled = true));
    cardBack($('#meCard'), true);
  });
  $('#status').textContent = st.over
    ? (st.winner === -1 ? 'Draw!' : st.winner === st.seat ? 'You win!' : 'You lose!')
    : st.waiting ? 'Locked in — waiting for your opponent…' : st.oppReady ? 'Your opponent has locked in.' : 'Choose your action.';
  $('#after').classList.toggle('hidden', !st.over);
  $('#rematchBtn').textContent = st.rematch && st.rematch[st.seat] ? 'Waiting for rematch…' : 'Rematch';
}
const HL = /wins the exchange|CLASH|FINAL SMASH|GAME!|DRAW|Priority|outright|was read/;
function drawLog(st, upToTurn) {
  const entries = st.log.filter(e => e.turn <= upToTurn);
  if (entries.length === logTurnsShown) return;
  const fresh = entries.length > logTurnsShown;
  $('#log').innerHTML = entries.slice().reverse().map((e, idx) => `
    <div class="lturn ${idx === 0 && fresh ? 'new' : ''}">
      <h4>${e.turn ? `TURN ${e.turn}` : 'START'}</h4>
      ${e.lines.map(l => `<div class="${HL.test(l) ? 'hl' : ''}">${esc(l)}</div>`).join('')}
    </div>`).join('');
  logTurnsShown = entries.length;
}

// ---------- turn reveal ----------
async function playReveal(st) {
  animating = true;
  const rv = st.reveal, prev = shown || st;
  const meB = { ...prev.me, hp: rv.before.hp[0], meter: rv.before.meter[0] };
  const oppB = { ...prev.opp, hp: rv.before.hp[1], meter: rv.before.meter[1] };
  drawSides({ ...st, me: meB, opp: oppB });
  $('#turn').textContent = `TURN ${rv.turn}`;
  $('#actions').innerHTML = ''; $('#artPick').classList.add('hidden'); $('#after').classList.add('hidden');
  $('#status').textContent = 'Reveal!';
  resetStage({ waiting: true, oppReady: true });
  cardFront($('#meCard'), rv.acts[0], prev.me); cardFront($('#oppCard'), rv.acts[1], prev.opp);
  await wait(350);
  $('#meCard').classList.add('flipped'); $('#oppCard').classList.add('flipped');            // flip
  await wait(750);
  if (rv.kind === 'win') {                                                                   // embiggen / ensmallen
    const w = rv.winner === 'me' ? '#meSlot' : '#oppSlot', l = rv.winner === 'me' ? '#oppSlot' : '#meSlot';
    $(w).classList.add('win'); $(l).classList.add('lose');
    burst(rv.winner === 'me' ? 'YOU WIN THE READ!' : 'READ!');
  } else if (rv.kind === 'clash') { $('#meSlot').classList.add('clash'); $('#oppSlot').classList.add('clash'); burst('CLASH!'); }
  else if (rv.kind === 'whiff') burst('WHIFF');
  else if (rv.kind === 'fs') burst('FINAL SMASH!');
  await wait(1100);
  animateBars($('#meSide'), meB, st.me); animateBars($('#oppSide'), oppB, st.opp);         // bars drop / charge
  await wait(1400);
  drawLog(st, rv.turn);                                                                       // turn log
  await wait(300);
  shown = st; animating = false;
  const next = queued; queued = null;
  if (next && next !== st) render(next); else settle(st);
}
function settle(st) {
  drawSides(st);
  if (!st.over) resetStage(st);
  drawControls(st);
  drawLog(st, Infinity);
}
function render(st) {
  show('battle');
  if (animating) { queued = st; return; }
  if (st.reveal && st.reveal.turn > lastAnimTurn) { lastAnimTurn = st.reveal.turn; playReveal(st); return; }
  shown = st;
  settle(st);
}
socket.on('state', st => {
  if (!st.reveal && lastAnimTurn) resetBattle(); // a new battle (rematch) started
  render(st);
});

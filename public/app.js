// SSBU-VS client
// a stable per-browser id lets the server hand your seat back after tabbing out, sleeping or reloading
const PID = (() => { let v = null; try { v = localStorage.getItem('ssbuvs-pid'); } catch {}
  if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)); try { localStorage.setItem('ssbuvs-pid', v); } catch {} }
  return v; })();
const socket = io({ auth: { pid: PID }, reconnectionDelayMax: 3000 });
const $ = s => document.querySelector(s);
const TYPE = { A: 'Attack', C: 'Counter', G: 'Grab', FS: 'Final Smash' };
const wait = ms => new Promise(r => setTimeout(r, ms));
let KITS = [], BY = {}, SKINS = {}, myPick = null, mySkin = null, myStart = null;
let shown = null, lastStats = null;          // the state currently drawn on screen
let animating = false, queued = null, lastAnimTurn = 0, logTurnsShown = 0;

const screens = ['home', 'select', 'battle'];
const show = id => { const was = $('#' + id).classList.contains('hidden'); screens.forEach(s => $('#' + s).classList.toggle('hidden', s !== id)); if (was) window.scrollTo(0, 0); };
const nameVal = () => $('#name').value.trim() || 'Player';
const initials = n => n.split(/[\s/&.-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const img = (artId, name, cls = 'portrait') => `<div class="${cls}"><img src="images/${artId}.png" alt="" onerror="this.remove()"><span>${initials(name)}</span></div>`;
const typeTag = t => ['Attack', 'Counter', 'Grab'].includes(t) ? `<span class="tag ${t}">${t}</span>` : `<span class="tag flex">${t}</span>`;

fetch('/api/kits').then(r => r.json()).then(d => {
  KITS = d.kits.slice().sort((a, b) => a.name.localeCompare(b.name));
  BY = Object.fromEntries(KITS.map(k => [k.id, k]));
  SKINS = d.skins || {};
  renderGrid();
});
$('#name').value = localStorage.getItem('ssbuvs-name') || '';
$('#name').addEventListener('change', () => localStorage.setItem('ssbuvs-name', $('#name').value));

$('#cpuBtn').onclick = () => socket.emit('cpu', { name: nameVal() });
$('#createBtn').onclick = () => socket.emit('create', { name: nameVal() });
$('#joinBtn').onclick = () => socket.emit('join', { name: nameVal(), code: $('#code').value });
$('#howBtn').onclick = () => $('#how').showModal();
// Random stays a secret: just confirm, and the server rolls the fighter and costume when the battle starts
$('#randomBtn').onclick = () => {
  let m = $('#costumes'); if (!m) { m = document.createElement('div'); m.id = 'costumes'; document.body.appendChild(m); }
  m.innerHTML = `<div class="cpanel rpanel"><div class="chead"><div><h2>Random</h2><span>A surprise fighter and costume, revealed when the battle starts</span></div><button class="ghost" id="cClose">✕</button></div>
    <div class="rmark">?</div>
    <div class="cfoot"><button class="ghost" id="cCancel">Cancel</button><button id="cOk">Confirm Random</button></div></div>`;
  const close = () => { m.classList.add('hidden'); document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); if (e.key === 'Enter') $('#cOk').click(); };
  $('#cClose').onclick = $('#cCancel').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  $('#cOk').onclick = () => { close(); myPick = 'random'; mySkin = null; socket.emit('pick', { random: true }); renderGrid(); };
  document.addEventListener('keydown', key); m.classList.remove('hidden'); $('#cOk').focus();
};
$('#search').oninput = renderGrid; $('#typeFilter').onchange = renderGrid;
$('#statsBtn').onclick = () => { if (lastStats) { renderStats(lastStats); $('#statsDlg').showModal(); } };
$('#rematchBtn').onclick = () => socket.emit('rematch');
$('#newBtn').onclick = () => { myPick = null; socket.emit('newFighters'); };
$('#logToggle').onclick = () => { const c = $('#logBox').classList.toggle('collapsed'); $('#logToggle').textContent = c ? 'Show full log ▾' : 'Hide full log ▴'; };
// pop the log out into a large panel, and back
let logWasCollapsed = true;
function setLogPopped(on) {
  const box = $('#logBox');
  if (on) { logWasCollapsed = box.classList.contains('collapsed'); box.classList.remove('collapsed'); }
  else box.classList.toggle('collapsed', logWasCollapsed);
  box.classList.toggle('popped', on); $('#logShade').classList.toggle('on', on);
  $('#logPop').textContent = on ? '⤡ Collapse' : '⤢ Pop out';
  $('#logToggle').classList.toggle('hidden', on);
  $('#logToggle').textContent = box.classList.contains('collapsed') ? 'Show full log ▾' : 'Hide full log ▴';
}
$('#logPop').onclick = () => setLogPopped(!$('#logBox').classList.contains('popped'));
$('#logShade').onclick = () => setLogPopped(false);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#logBox').classList.contains('popped')) setLogPopped(false); });
$('#homeBtn').onclick = () => { socket.emit('leave'); myPick = null; resetBattle(); show('home'); };

function resetBattle() { shown = null; queued = null; animating = false; lastAnimTurn = 0; logTurnsShown = 0; $('#log').innerHTML = ''; }

// ---------- fighter select ----------
function renderGrid() {
  $('#randomBtn').classList.toggle('picked', myPick === 'random');
  const q = $('#search').value.toLowerCase(), t = $('#typeFilter').value;
  $('#grid').innerHTML = KITS.filter(k =>
    (!q || (k.name + ' ' + k.series).toLowerCase().includes(q)) &&
    (!t || (t === 'flex' ? !['Attack', 'Counter', 'Grab'].includes(k.skill.type) : k.skill.type === t))
  ).map(k => `
    <div class="card ${myPick === k.id ? 'picked' : ''}" data-id="${k.id}">
      ${img(myPick === k.id && skinById(k.id, mySkin) ? skinById(k.id, mySkin).art : k.id, k.name)}
      <div><h3>${myPick === k.id && skinById(k.id, mySkin) ? esc(skinById(k.id, mySkin).display || k.name) : k.name}</h3><div class="series">${k.series}${SKINS[k.id] ? ` · <span class="costumes">${SKINS[k.id].length + 1} costumes</span>` : ''}</div></div>
      <div class="kit"><b>${k.passive.name}</b> — ${k.passive.text}<br>
        <b>${k.skill.name}</b> ${typeTag(k.skill.type)} · ${k.skill.cost} meter — ${k.skill.text}</div>
    </div>`).join('');
  document.querySelectorAll('#grid .card').forEach(c => c.onclick = () => costumePicker(c.dataset.id));
}
const skinById = (id, sid) => sid ? (SKINS[id] || []).find(x => x.id === sid) || null : null;
// fighters that let you choose who begins the battle
const STARTS = {
  pt: { label: 'Starting Pokémon', opts: [{ v: 0, name: 'Squirtle', art: 'pt-squirtle' }, { v: 1, name: 'Ivysaur', art: 'pt-ivysaur' }, { v: 2, name: 'Charizard', art: 'pt-charizard' }] },
  pyra: { label: 'Starts as', opts: [{ v: 'P', name: 'Pyra', art: 'pyra-pyra' }, { v: 'M', name: 'Mythra', art: 'pyra-mythra' }] },
};
function choose(id, skin, start = null) {
  myPick = id; mySkin = skin; myStart = start; socket.emit('pick', { id, skin, start }); renderGrid();
  const el = document.querySelector(`.card[data-id="${id}"]`); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
// fighter confirm: preview the fighter, pick a costume if they have any, then Confirm
const costumesOf = id => [{ id: null, name: (SKINS._defaults || {})[id] || 'Default', display: null, art: id }, ...(SKINS[id] || [])];
function costumePicker(id, pre = myPick === id ? mySkin : null) {
  const k = BY[id], opts = costumesOf(id);
  let sel = opts.some(o => o.id === pre) ? pre : null;
  const SO = STARTS[id];
  let start = SO ? (myPick === id && SO.opts.some(x => x.v === myStart) ? myStart : SO.opts[0].v) : null;
  let m = $('#costumes'); if (!m) { m = document.createElement('div'); m.id = 'costumes'; document.body.appendChild(m); }
  const draw = () => {
    const o = opts.find(x => x.id === sel), shown = o.display || k.name;
    const so = SO && SO.opts.find(x => x.v === start);
    const prevArt = id === 'pyra' ? so.art : o.art, prevName = id === 'pyra' ? `${so.name} starts` : o.name;
    m.innerHTML = `<div class="cpanel">
      <div class="chead"><div><h2>${esc(shown)}</h2><span>${shown !== k.name ? esc(k.name) + ' · ' : ''}${esc(k.series)}</span></div><button class="ghost" id="cClose">✕</button></div>
      <div class="cbody">
        <div class="cprev">${img(prevArt, shown)}<div class="cname2">${esc(prevName)}</div></div>
        <div class="cside">
          <div class="ckit"><b>${esc(k.passive.name)}</b> — ${esc(k.passive.text)}<br><b>${esc(k.skill.name)}</b> ${typeTag(k.skill.type)} · ${k.skill.cost} meter — ${esc(k.skill.text)}</div>
          ${opts.length > 1 ? `<div class="clabel">Costume</div><div class="cgrid">${opts.map(x => `<button class="ctile ${x.id === sel ? 'on' : ''}" data-skin="${x.id || ''}" title="${esc(x.name)}">
            ${img(x.art, x.display || k.name)}<small>${esc(x.name)}</small></button>`).join('')}</div>` : ''}
          ${SO ? `<div class="clabel">${SO.label}</div><div class="cgrid">${SO.opts.map(x => `<button class="ctile stile ${x.v === start ? 'on' : ''}" data-start="${x.v}">
            ${img(x.art, x.name)}<small>${esc(x.name)}</small></button>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="cfoot"><button class="ghost" id="cCancel">Cancel</button><button id="cOk">Confirm ${esc(shown)}</button></div></div>`;
    $('#cClose').onclick = $('#cCancel').onclick = close;
    $('#cOk').onclick = () => { close(); choose(id, sel, start); };
    m.querySelectorAll('.ctile:not(.stile)').forEach(b => b.onclick = () => { sel = b.dataset.skin || null; draw(); });
    m.querySelectorAll('.stile').forEach(b => b.onclick = () => { start = id === 'pt' ? +b.dataset.start : b.dataset.start; draw(); });
  };
  const close = () => { m.classList.add('hidden'); document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); if (e.key === 'Enter') $('#cOk').click(); };
  m.onclick = e => { if (e.target === m) close(); };
  document.addEventListener('keydown', key);
  draw(); m.classList.remove('hidden'); $('#cOk').focus();
}

socket.on('err', m => alert(m));
// ---------- connection health ----------
const conn = document.createElement('div'); conn.id = 'connBar'; conn.className = 'hidden'; document.body.appendChild(conn);
const setConn = (txt) => { conn.textContent = txt || ''; conn.classList.toggle('hidden', !txt); };
const inMatch = () => !$('#battle').classList.contains('hidden') || !$('#select').classList.contains('hidden');
socket.on('disconnect', () => { if (inMatch()) setConn('Connection lost — reconnecting…'); });
socket.on('connect', () => setConn(''));
// phones freeze background tabs: when you come back, reconnect at once instead of waiting on a backoff timer
const wake = () => { if (document.visibilityState === 'visible' && !socket.connected) { if (inMatch()) setConn('Reconnecting…'); socket.connect(); } };
document.addEventListener('visibilitychange', wake); window.addEventListener('focus', wake); window.addEventListener('online', wake);
window.addEventListener('pageshow', e => { if (e.persisted) wake(); });
socket.on('noRoom', () => {
  if (!inMatch()) return;
  setConn(''); myPick = null; resetBattle(); show('home');
  alert('That match is no longer available (the server may have restarted). Start a new one from here.');
});
socket.on('lobby', l => {
  resetBattle(); show('select');
  if (l.myPick && (myPick !== l.myPick || mySkin !== (l.mySkin || null))) { myPick = l.myPick; mySkin = l.mySkin || null; myStart = l.myStart ?? null; renderGrid(); }
  const others = l.players.map(p => p ? `${esc(p.name)}${p.picked ? ' ✓' : ''}` : '<i>waiting…</i>').join(' vs ');
  $('#lobbyInfo').innerHTML = l.cpu ? 'Pick your fighter — the CPU picks at random.' : `Room <b>${l.code}</b> · ${others} · share the code with a friend`;
});

// ---------- side panels ----------
// Kit text is open by default on wide screens, folded on phones; remembers your choice per side
const kitOpen = { me: null, opp: null };
const wide = () => window.matchMedia('(min-width: 701px) and (min-height: 601px)').matches;   // kit text folded on phones, portrait or landscape
function kitToggle(el) { kitOpen[el.dataset.side] = el.open; }
function kitHTML(s, sideKey) {
  const k = BY[s.id]; if (!k) return '';
  const src = s.skill.copiedFrom && BY[s.skill.copiedFrom] ? BY[s.skill.copiedFrom].skill : k.skill;
  const type = TYPE[s.skill.type] || s.skill.type;
  const open = kitOpen[sideKey] ?? wide();
  return `<details class="kitBox" data-side="${sideKey}" ${open ? 'open' : ''} ontoggle="kitToggle(this)"><summary>Kit · ${esc(k.passive.name)} · ${esc(s.skill.name)}</summary>
    <div><b>${esc(k.passive.name)}</b> <span class="kt">Passive</span><div>${esc(k.passive.text)}</div></div>
    <div class="${s.skill.copied ? 'copiedKit' : ''}"><b>${esc(s.skill.copied ? 'Copied: ' + src.name : s.skill.name)}</b> <span class="tag ${type}">${type}</span>${s.skill.cost !== null ? ` <span class="kt">${s.skill.cost} meter</span>` : ''}<div>${esc(src.text)}</div></div>
    <div><b>${esc(s.fs)}</b> <span class="tag FS">Final Smash</span> <span class="kt">8 meter</span><div>${esc((k.finalSmashText || '').replace(/^Pyra – .*?Mythra – /, m => m))}</div></div>
  </details>`;
}
function sideHTML(s, player, mine) {
  const pct = 100 * s.hp / s.maxHp;
  const meter = s.meter === null ? '<div class="hiddenMeter">Meter hidden (Cardboard Box)</div>'
    : `<div class="smeter ${s.meter >= s.meterMax ? 'full' : ''}">${Array.from({ length: s.meterMax }, (_, i) => `<div class="seg ${i < s.meter ? 'on' : ''}" style="--n:${s.meterMax};--i:${i}"></div>`).join('')}</div>`;
  return `
    <div class="pname">${esc(player)}${mine ? ' (you)' : ''}</div>
    <div class="cname">${s.name}</div>
    <div class="who"><div class="pwrap ${W.fxClass(s.effects)}">${img(s.art, s.name)}${s.fx.marks.map(W.mark).join('')}${W.fxBadges(s.effects)}</div>${s.fx.summon ? `<img class="summon ${s.fx.summonCls || ''}" src="images/${s.fx.summon}" alt="">` : ''}<div>
      <div class="small hideSmall">${s.passive} · <span class="skl ${s.skill.copied ? 'copied' : ''} ${s.skill.protean ? 'protean' : ''}">${s.skill.copied ? 'Copied: ' : ''}${s.skill.name} <span class="tag ${TYPE[s.skill.type] || 'flex'}">${TYPE[s.skill.type] || s.skill.type}</span>${s.skill.cost !== null ? ` ${s.skill.cost}` : ''}</span></div></div></div>
    ${kitHTML(s, mine ? 'me' : 'opp')}
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
function floatNum(el, diff) {
  if (!diff) return;
  const hp = el.querySelector('.hp'); if (!hp) return;
  const f = document.createElement('div');
  f.className = 'floatNum ' + (diff < 0 ? 'loss' : 'gain'); f.textContent = (diff > 0 ? '+' : '−') + Math.abs(diff);
  hp.parentNode.insertBefore(f, hp); setTimeout(() => f.remove(), 1900);
}
function animateBars(el, from, to) {
  floatNum(el, to.hp - from.hp);
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
  $('#resultBanner').classList.add('hidden'); document.querySelector('.cards').classList.remove('ended');
  for (const k of ['me', 'opp']) { $(`#${k}Slot`).className = 'slot'; $(`#${k}Card`).classList.remove('flipped'); }
  cardBack($('#meCard'), !!st.waiting); cardBack($('#oppCard'), !!st.oppReady);
  $('#burst').className = ''; $('#burst').textContent = '';
}
function callout(a) {
  const side = a.side === 'me' ? '#meSide' : '#oppSide';
  const c = document.createElement('div'); c.className = 'callout ' + a.side; c.textContent = a.text;
  $(side).appendChild(c); setTimeout(() => c.remove(), 2600);
}
function burst(txt) { const b = $('#burst'); b.textContent = txt; b.className = ''; void b.offsetWidth; b.className = 'go'; }

// ---------- controls & log ----------
function drawControls(st) {
  $('#turn').textContent = st.over ? 'GAME OVER' : `TURN ${st.turn}`;
  $('#artPick').classList.toggle('hidden', !st.shulk || st.over);
  $('#pulsePick').classList.toggle('hidden', !st.pulse || st.over);
  // the skill button is always shown; greyed out with the reason when it can't be used
  const acts = st.over ? [] : st.actions.slice();
  // locked basic actions stay visible too, greyed out
  if (!st.over) ['A', 'C', 'G'].forEach((t, i) => {
    if (!acts.some(a => a.kind === 'basic' && a.type === t)) acts.splice(i, 0, { kind: 'basic', type: t, blocked: 'Locked' });
  });
  if (!st.over && !acts.some(a => a.kind === 'skill')) {
    const fsAt = acts.findIndex(a => a.kind === 'fs');
    acts.splice(fsAt < 0 ? acts.length : fsAt, 0, { kind: 'skill', type: st.me.skill.type, blocked: st.skillBlocked || 'Unavailable' });
  }
  $('#actions').innerHTML = acts.map((a, i) => {
    const label = a.kind === 'dodge' ? 'DODGE<br><small>Avoids Final Smashes</small>'
      : a.kind === 'fs' ? `FINAL SMASH<br><small>${esc(st.me.fs)}</small>`
      : a.kind === 'skill' ? `${esc(st.me.skill.name)}<br><small>${a.blocked ? esc(a.blocked) : `${TYPE[a.type]} skill · ${st.me.skill.cost} meter`}</small>`
      : a.blocked ? `${TYPE[a.type]}<br><small>🔒 ${esc(a.blocked)}</small>` : TYPE[a.type];
    return `<button class="${a.kind === 'fs' ? 'FS' : a.kind === 'dodge' ? 'D' : a.type} ${a.kind} ${a.blocked ? 'blocked' : ''}" data-i="${i}" ${st.waiting || a.blocked ? 'disabled' : ''}>${label}</button>`;
  }).join('');
  document.querySelectorAll('#actions button').forEach(b => b.onclick = () => {
    const a = acts[+b.dataset.i];
    if (a.blocked) return;
    const art = st.shulk ? (document.querySelector('input[name=art]:checked') || {}).value : undefined;
    const pulse = st.pulse && $('#pulseBox').checked;
    socket.emit('act', { ...a, art, pulse, turn: st.turn });
    $('#pulseBox').checked = false;
    document.querySelectorAll('#actions button').forEach(x => (x.disabled = true));
    cardBack($('#meCard'), true);
  });
  $('#status').textContent = st.over
    ? (st.winner === -1 ? 'Draw!' : st.winner === st.seat ? 'You win!' : 'You lose!')
    : st.away && st.away[1 - st.seat] ? `${st.names[1 - st.seat]} disconnected — holding their spot for a few minutes…`
    : st.waiting ? 'Locked in — waiting for your opponent…' : st.oppReady ? 'Your opponent has locked in.' : 'Choose your action.';
  $('#after').classList.toggle('hidden', !st.over);
  // end-of-game banner sits above the (enlarged) cards so it is always readable
  const rb = $('#resultBanner'); rb.classList.toggle('hidden', !st.over);
  document.querySelector('.cards').classList.toggle('ended', !!st.over);
  if (st.over) {
    const n = i => { const f = i === st.seat ? st.me : st.opp; return st.me.name === st.opp.name ? `${st.names[i]}'s ${f.name}` : f.name; };
    rb.className = st.winner === -1 ? 'draw' : st.winner === st.seat ? 'mine' : 'theirs';
    rb.querySelector('.rbWho').textContent = st.winner === -1 ? 'Draw!' : `${n(st.winner)} wins!`;
  }
  $('#rematchBtn').textContent = st.rematch && st.rematch[st.seat] ? 'Waiting for rematch…' : 'Rematch';
}
const SKILL_LINE = /spends \d+ meter on |chose .+ skill\)|FINAL SMASH/;
const HL = /wins the exchange|CLASH|FINAL SMASH|GAME!|DRAW|Priority|outright|was read/;
function drawLog(st, upToTurn) {
  const entries = st.log.filter(e => e.turn <= upToTurn);
  if (entries.length === logTurnsShown) return;
  const fresh = entries.length > logTurnsShown;
  $('#log').innerHTML = entries.slice().reverse().map((e, idx) => `
    <div class="lturn ${idx === 0 && fresh ? 'new' : ''}">
      <h4>${e.turn ? `TURN ${e.turn}` : 'START'}</h4>
      ${e.lines.map(l => `<div class="${l.startsWith('★ ') ? 'ann' : SKILL_LINE.test(l) ? 'skl-line' : HL.test(l) ? 'hl' : ''}">${esc(l)}</div>`).join('')}
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
  $('#actions').innerHTML = ''; $('#artPick').classList.add('hidden'); $('#pulsePick').classList.add('hidden'); $('#after').classList.add('hidden');
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
  else if (rv.kind === 'fs') burst(rv.acts.some(a => a.type === 'D') ? 'DODGED!' : rv.acts.find(a => a.type === 'FS').title.toUpperCase() + '!');
  await wait(1100);
  for (const a of rv.announce || []) { callout(a); await wait(1300); }                       // unique effects
  animateBars($('#meSide'), meB, st.me); animateBars($('#oppSide'), oppB, st.opp);         // bars drop / charge
  await wait(1400);
  drawLog(st, rv.turn);                                                                       // turn log
  await wait(300);
  shown = st; animating = false;
  const next = queued; queued = null;
  if (next && next !== st) render(next); else settle(st);
}
function settle(st) {
  lastStats = st.over && st.stats ? st : null;
  $('#statsBtn').classList.toggle('hidden', !lastStats);
  drawSides(st);
  if (!st.over) resetStage(st);
  drawControls(st);
  drawLog(st, Infinity);
}
function render(st) {
  show('battle');
  if (animating) { queued = st; return; }
  if (!shown && !lastAnimTurn && st.reveal) lastAnimTurn = st.reveal.turn; // resuming after a reload: don't replay the last reveal
  if (st.reveal && st.reveal.turn > lastAnimTurn) { lastAnimTurn = st.reveal.turn; playReveal(st); return; }
  shown = st;
  settle(st);
}
socket.on('state', st => {
  if (!st.reveal && lastAnimTurn) resetBattle(); // a new battle (rematch) started
  render(st);
});


// ---------- post-battle stats ----------
function mechList(p, side, player) {
  const u = Object.entries(p.unique || {}).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
  return `<div class="mech"><div class="mechHead">${img(side.art, side.name)}<div><div class="pname">${esc(player)}</div><b>${esc(side.name)}</b></div></div>
    ${u.length ? u.map(([k, v]) => `<div class="mrow"><span>${esc(k)}</span><b>${v}</b></div>`).join('') : '<div class="small">No special mechanics came into play this match.</div>'}</div>`;
}
function renderStats(st) {
  const S = st.stats, me = st.seat, op = 1 - me, P = S.players;
  const sides = [st.me, st.opp], idx = [me, op];
  const names = [st.names[me], st.names[op]];
  const pct = (a, b) => (b ? Math.round(100 * a / b) : 0) + '%';
  const exch = p => p.wins + p.losses + p.clashes + p.whiffs;
  const rows = [
    ['Hit damage dealt', p => p.dealt],
    ['Damage taken', p => p.hitTaken + p.otherTaken, null, true],
    ['HP healed', p => p.healed],
    ['Biggest hit', p => p.biggest, p => p.biggest ? `${p.biggestWith}, turn ${p.biggestTurn}` : ''],
    ['Exchanges won', p => p.wins, p => `${pct(p.wins, exch(p))} of turns`],
    ['Longest win streak', p => p.bestStreak],
    ['Skill uses', p => p.skillUses, p => p.skillUses ? `${p.skillWins} landed (${pct(p.skillWins, p.skillUses)})` : ''],
    ['Final Smashes', p => p.fsUses, p => p.fsDamage ? `${p.fsDamage} damage` : ''],
    ['Meter gained', p => p.meterGained],
    ['Meter spent', p => p.meterSpent],
  ];
  const statRows = rows.map(([label, f, sub, low]) => {
    const a = f(P[me]), b = f(P[op]), m = Math.max(a, b, 1);
    const leads = (v, o) => low ? v < o : v >= o && v > 0;
    const cell = (v, p, side) => `<div class="sv ${side}"><div class="sbar ${leads(v, side === 'l' ? b : a) ? 'lead' : ''}" style="width:${100 * v / m}%"></div><b>${v}</b>${sub && sub(p) ? `<small>${esc(sub(p))}</small>` : ''}</div>`;
    return `<div class="srow">${cell(a, P[me], 'l')}<div class="slabel">${label}</div>${cell(b, P[op], 'r')}</div>`;
  }).join('');
  // action mix
  const mix = p => { const t = p.acts.A + p.acts.C + p.acts.G + p.skillUses + p.fsUses || 1;
    const seg = (n, c, l) => n ? `<div class="mseg ${c}" style="flex:${n}" title="${l}: ${n}">${Math.round(100 * n / t) >= 12 ? l[0] : ''}</div>` : '';
    return `<div class="mix">${seg(p.acts.A, 'A', 'Attack')}${seg(p.acts.C, 'C', 'Counter')}${seg(p.acts.G, 'G', 'Grab')}${seg(p.skillUses, 'SK', 'Skill')}${seg(p.fsUses, 'FS', 'Final Smash')}</div>
      <div class="mixLegend">A ${p.acts.A} · C ${p.acts.C} · G ${p.acts.G} · Skill ${p.skillUses} · FS ${p.fsUses}</div>`; };
  // HP timeline chart
  const T = S.timeline, W = 640, H = 200, pad = 30, maxHp = Math.max(sides[0].maxHp, sides[1].maxHp);
  const x = i => pad + (W - pad - 10) * i / Math.max(1, T.length - 1), y = v => 10 + (H - 40) * (1 - v / maxHp);
  const line = (k, cls) => `<polyline class="${cls}" points="${T.map((t, i) => `${x(i)},${y(t.hp[k])}`).join(' ')}"/>`;
  const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${pad}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="4" y="${y(v) + 4}" class="gt">${v}</text>`).join('');
  const ticks = T.filter((_, i) => i % Math.ceil(T.length / 10) === 0).map(t => `<text x="${x(t.turn)}" y="${H - 8}" class="gt" text-anchor="middle">${t.turn}</text>`).join('');
  const result = st.winner === -1 ? 'Draw' : st.winner === me ? 'Victory!' : 'Defeat';
  $('#statsBody').innerHTML = `
    <div class="shead ${st.winner === me ? 'win' : st.winner === -1 ? '' : 'lose'}"><h2>${result}</h2><span>${S.turns} turns</span></div>
    <div class="sfighters">
      ${[0, 1].map(i => `<div class="sf ${i ? 'r' : ''} ${st.winner === idx[i] ? 'won' : ''}">${img(sides[i].art, sides[i].name)}<div><div class="pname">${esc(names[i])}</div><b>${sides[i].name}</b><div class="small">${sides[i].hp} / ${sides[i].maxHp} HP left</div></div></div>`).join('<div class="svs">VS</div>')}
    </div>
    <div class="stable">${statRows}</div>
    <h3 class="sh">HP over time</h3>
    <svg class="hpchart" viewBox="0 0 ${W} ${H}">${grid}${ticks}${line(me, 'l1')}${line(op, 'l2')}</svg>
    <div class="legend"><span class="k1"></span>${esc(names[0])} (${sides[0].name}) <span class="k2"></span>${esc(names[1])} (${sides[1].name})</div>
    <h3 class="sh">Fighter mechanics</h3>
    <div class="mechs">${[0, 1].map(i => mechList(P[idx[i]], sides[i], names[i])).join('')}</div>
    <h3 class="sh">Action mix</h3>
    <div class="mixes"><div><div class="small">${esc(names[0])}</div>${mix(P[me])}</div><div><div class="small">${esc(names[1])}</div>${mix(P[op])}</div></div>`;
}

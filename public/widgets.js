// Resource widgets. Shared by the battle screen and preview.html.
// Generic shapes are drawn here as SVG; character/item art comes from public/images (uploaded by you).
(function () {
  const S = 26; // standard icon size (px) — matches the resource bar row height
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const svg = (inner, size = S, vb = '0 0 24 24', extra = '') => `<svg class="ico" width="${size}" height="${size}" viewBox="${vb}" ${extra}>${inner}</svg>`;
  const EMPTY = '#343a4d';

  // ---- generic icon shapes ----
  const SHAPES = {
    star: c => svg(`<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2 6.1 20.5l1.3-6.6L2.5 9.4l6.6-.8z" fill="${c}"/>`),
    dot: c => svg(`<circle cx="12" cy="12" r="8" fill="${c}"/>`),
    flame: c => svg(`<path d="M12 2c1 4 6 6.5 6 12a6 6 0 0 1-12 0c0-3 1.6-5 3-6.3.2 2 1 3.3 2.3 3.8C10.6 8 11 5 12 2z" fill="${c}"/>`),
    tally: (c, on) => svg(on
      ? `<defs><linearGradient id="fireg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d00"/><stop offset=".6" stop-color="#ff9a1a"/><stop offset="1" stop-color="#ffe066"/></linearGradient></defs><rect x="10" y="4" width="4.2" height="17" rx="2" fill="url(#fireg)"/><path d="M12 1c1 2 2.6 3 2.6 5a2.6 2.6 0 0 1-5.2 0c0-1.4.8-2.2 1.4-2.8.1.9.5 1.4 1 1.6C11.6 3.6 11.7 2.3 12 1z" fill="#ffb02e"/>`
      : `<rect x="10" y="4" width="4.2" height="17" rx="2" fill="${c}"/>`, S, '0 0 24 24', on ? 'class="ico fire"' : ''),
    shield: c => svg(`<path d="M12 2l8 3v6c0 5.2-3.4 9.3-8 11-4.6-1.7-8-5.8-8-11V5z" fill="${c}"/><path d="M12 5.5l5 1.9v3.8c0 3.4-2.1 6.1-5 7.4z" fill="#fff" opacity=".18"/>`),
    crown: c => svg(`<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="${c}"/><rect x="5" y="19.5" width="14" height="2" rx="1" fill="${c}"/>`),
    cross: c => svg(`<path d="M10 2h4v6h6v4h-6v10h-4V12H4V8h6z" fill="${c}"/>`),
    eye: c => svg(`<path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="${c}"/><circle cx="12" cy="12" r="3.6" fill="#0c0e13"/><circle cx="13.2" cy="10.8" r="1.1" fill="#fff" opacity=".8"/>`),
    pellet: c => svg(`<circle cx="12" cy="12" r="7" fill="${c}"/>`),
    wing: c => svg(`<path d="M3 20C5 11 11 4 21 3c-2 3-2.5 5-2 7-3 0-5 1-6.5 3 2 0 3.5.5 4.5 1.7-3 .2-5 1.3-6.5 3 1.5.3 2.6.8 3.2 1.6C9.6 20.5 6 20.6 3 20z" fill="${c}"/>`),
    sword: c => svg(`<path d="M17.5 2.5L21 3l.5 3.5-10 10-3.5-3.5z" fill="${c}"/><path d="M5.5 13.5l5 5-1.4 1.4-1.8-1.8-2.6 2.6-1.4-1.4 2.6-2.6-1.8-1.8z" fill="${c}"/>`),
    plasma: c => svg(`<circle cx="12" cy="12" r="6" fill="${c}"/><circle cx="12" cy="12" r="10" fill="none" stroke="${c}" stroke-width="1.5" opacity=".5"/>`),
    snowflake: c => svg(`<g stroke="${c}" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/></g>`),
    bolt: c => svg(`<path d="M13.5 2L4 13.5h6.5L9 22l11-12.5h-6.7z" fill="${c}"/>`),
    rocket: c => svg(`<path d="M12 2c3 2.5 4.5 6 4.5 10l-1.8 4H9.3l-1.8-4C7.5 8 9 4.5 12 2z" fill="${c}"/><circle cx="12" cy="9.5" r="1.8" fill="#0c0e13"/><path d="M7.5 12L4 16l3.3.5M16.5 12L20 16l-3.3.5M10 17h4l-2 4.5z" fill="${c}"/>`),
    crosshair: c => svg(`<g fill="none" stroke="${c}" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/></g><circle cx="12" cy="12" r="1.6" fill="${c}"/>`),
  };
  const PILL_C = { blue: '#3d8bfd', white: '#f2f2f2', red: '#e5413a', yellow: '#ffd23f' };
  const pill = (colors, on) => svg(`<g transform="rotate(-40 12 12)"><rect x="3" y="8" width="9" height="8" rx="4" fill="${on ? PILL_C[colors[0]] : EMPTY}"/><rect x="11" y="8" width="10" height="8" rx="4" fill="${on ? PILL_C[colors[1]] : EMPTY}"/><rect x="11" y="8" width="3" height="8" fill="${on ? PILL_C[colors[1]] : EMPTY}"/></g>`);
  const imgIcon = (name, on = true, size = S, cls = '') =>
    `<img class="ico img ${on ? '' : 'sil'} ${cls}" src="images/${name}.png" width="${size}" height="${size}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{innerHTML:W.fallback('${name}', ${on}, ${size})}))">`;
  // icon by id: "img:<file>" uses an uploaded image, otherwise a generic shape
  function icon(id, color, on = true, size = S) {
    if (id.startsWith('img:')) return imgIcon(id.slice(4), on, size);
    const f = SHAPES[id]; return f ? f(on ? color : EMPTY, on).replace(`width="${S}" height="${S}"`, `width="${size}" height="${size}"`) : '';
  }
  const fallback = (name, on, size) => name === 'lloid' ? icon('rocket', '#e8c35a', on, size) : `<span class="ico" style="width:${size}px;height:${size}px"></span>`;

  const COLORS = { shield: '#5aa9ff', crown: '#f2c230', cross: '#f2e6c4', eye: '#3fd07a', pellet: '#ffffff', wing: '#e9ecf5', sword: '#bfe8ff', plasma: '#3da2ff', rocket: '#e8c35a' };
  const lbl = (l, r = '') => `<div class="lbl"><span>${l}</span><span>${r}</span></div>`;

  // ---- widgets ----
  const R = {};
  R.segbar = r => {
    if (r.style === 'waft') {
      // cloud-shaped bar split into 5 sections
      const w = 200, h = 40, id = 'cl' + Math.random().toString(36).slice(2, 7);
      const cloud = 'M18 34 C4 34 2 20 14 18 C12 6 30 2 36 12 C42 2 60 2 64 13 C70 4 90 4 94 14 C100 4 122 4 126 14 C132 4 152 4 156 14 C162 6 184 8 184 20 C198 20 198 34 184 34 Z';
      // sections span the whole cloud (x 0–200) so a full Waft fills it edge to edge; dividers drawn on top
      const segW = w / r.max;
      let parts = '';
      for (let i = 0; i < r.max; i++) parts += `<rect x="${i * segW}" y="0" width="${segW + 0.5}" height="${h}" fill="${i < r.value ? `url(#${id}g)` : EMPTY}"/>`;
      for (let i = 1; i < r.max; i++) parts += `<line x1="${i * segW}" y1="0" x2="${i * segW}" y2="${h}" stroke="#5c6680" stroke-width="2"/>`;
      return `<div class="w-seg waft ${r.value >= r.max ? 'full' : ''}">${lbl(r.label, r.value >= r.max ? 'FULL' : `${r.value} / ${r.max}`)}
        <svg viewBox="0 0 ${w} ${h}" class="cloud"><defs><clipPath id="${id}"><path d="${cloud}"/></clipPath>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9f5b0"/><stop offset="1" stop-color="#8fd16a"/></linearGradient></defs>
        <g clip-path="url(#${id})">${parts}</g><path d="${cloud}" fill="none" stroke="#5c6680" stroke-width="2"/></svg></div>`;
    }
    const cells = Array.from({ length: r.max }, (_, i) => `<div class="cell ${i < r.value ? 'on' : ''}"></div>`).join('');
    return `<div class="w-seg ${r.style} ${r.value >= r.max ? 'full' : ''}">${lbl(r.label, `${r.value} / ${r.max}`)}<div class="cells">${cells}</div></div>`;
  };
  R.bar = r => `<div class="w-bar ${r.style} ${r.text ? 'ready' : ''}">${lbl(r.label, r.text || `${r.value} / ${r.max}`)}
      <div class="track"><div style="width:${Math.min(100, 100 * r.value / r.max)}%"></div></div></div>`;
  R.luma = r => `<div class="w-luma ${r.hp > 0 ? '' : 'down'}">${imgIcon('luma', r.hp > 0, 52)}
      <div class="lumaInfo">${lbl('Luma', r.hp > 0 ? `${r.hp} / ${r.max}` : `Back in ${r.back} turn${r.back === 1 ? '' : 's'}`)}
      <div class="track"><div style="width:${100 * Math.max(0, r.hp) / r.max}%"></div></div></div></div>`;
  R.belly = r => {
    const broken = r.value <= 0, dmg = r.max - Math.max(0, r.value), n = broken ? 0 : Math.ceil(dmg / r.max * 8);
    const cracks = ['M32 10 l-3 7 4 4 -3 6', 'M50 20 l-6 3 1 5 -5 3', 'M14 22 l6 4 -1 5 5 3', 'M52 40 l-7-1 -2 5 -6 0', 'M12 42 l7-2 2 5 5 1', 'M24 52 l3-6 5 1 2-5', 'M42 54 l-2-6 -5 0 -1-5', 'M32 58 l1-6 -4-3']
      .slice(0, n).map(d => `<path d="${d}" fill="none" stroke="#5a3d06" stroke-width="1.6" stroke-linecap="round"/>`).join('');
    return `<div class="w-belly ${broken ? 'broken' : ''}"><svg viewBox="0 0 64 64" width="64" height="64">
        <defs><radialGradient id="bg1" cx=".4" cy=".35"><stop offset="0" stop-color="#ffe58a"/><stop offset=".7" stop-color="#e3a51c"/><stop offset="1" stop-color="#a8720c"/></radialGradient></defs>
        <circle cx="32" cy="32" r="29" fill="${broken ? '#2f6b35' : 'url(#bg1)'}" stroke="${broken ? '#1d4421' : '#8a5c08'}" stroke-width="2"/>
        <path d="M29 33 q3 4 6 0" fill="none" stroke="${broken ? '#173a1b' : '#6b4506'}" stroke-width="2.4" stroke-linecap="round"/>${cracks}</svg>
        <div class="bellyNum">${Math.max(0, r.value)}/20</div>${broken ? `<div class="rsub">Reforms in ${r.back}</div>` : ''}</div>`;
  };
  const FRUIT_ICONS = ['🍒', '🍓', '🍊', '🍎', '🍈', '🚀', '🔔', '🔑'];
  R.fruit = r => `<div class="w-fruit"><div class="fruitIco" title="${r.name}">${FRUIT_ICONS[r.idx]}</div><div class="fruitNum">+${r.bonus}</div><div class="rsub">Bonus Fruit</div></div>`;
  R.icons = r => {
    const n = r.mode === 'remove' ? r.value : r.max;
    const items = Array.from({ length: n }, (_, i) => icon(r.icon, r.color, i < r.value)).join('');
    return `<div class="w-icons">${lbl(r.label, `${r.value} / ${r.max}`)}<div class="row-ico ${r.icon === 'tally' ? 'tallies' : ''}">${items || '<span class="rsub">All used</span>'}</div></div>`;
  };
  R.pikmin = r => `<div class="w-icons">${lbl(r.label, `${r.colors.length} / ${r.max}`)}<div class="row-ico">${
    Array.from({ length: r.max }, (_, i) => r.colors[i] ? imgIcon('pikmin-' + r.colors[i], true, S + 4) : `<span class="slot-empty"></span>`).join('')}</div></div>`;
  R.villager = r => `<div class="w-icons">${lbl('Timber growth', `${r.saplings} / ${r.max}`)}<div class="row-ico">${
    Array.from({ length: r.max }, (_, i) => imgIcon('sapling', i < r.saplings)).join('')}
      <span class="pocket ${r.pocket ? 'on' : ''}" title="${r.pocket ? esc(`Pocket: +${r.pocket} damage${r.from ? ` (from ${r.from})` : ''}`) : 'Pocket: empty'}">${icon('dot', '#e5413a', !!r.pocket, 20)}<small>Pocket</small></span></div></div>`;
  R.tier = r => `<div class="w-tier">${imgIcon(['wood', 'stone', 'iron', 'diamond'][r.tier], true, 34)}<div><b>${r.names[r.tier]}</b> tools<div class="rsub">${r.tier ? `Wins +${r.tier}` : 'No bonus yet'}${r.next ? ` · upgrade on turn ${r.next}` : ' · max tier'}</div></div></div>`;
  R.hero = r => `<div class="w-hero"><div class="lvNum">${r.level}</div><div class="xp"><small>(Lv.${r.level})</small> XP
      <div class="xpbar">${Array.from({ length: r.xpMax }, (_, i) => `<i class="${i < r.xp ? 'on' : ''}"></i>`).join('')}</div>
      ${r.level >= 3 ? '<span class="rsub">MAX</span>' : ''}</div>${r.levelUp ? '<div class="lvup">▲ LEVEL UP</div>' : ''}</div>`;
  R.routine = r => {
    const tiles = [0, 1, 2].map(i => { const t = r.acts[i]; return `<span class="rt ${t || 'none'}">${t || '·'}</span>`; }).join('');
    return `<div class="w-routine ${r.ready ? 'ready' : ''}">${lbl('Balanced Routine', r.ready ? 'READY' : '')}<div class="row-ico">${tiles}</div></div>`;
  };
  const SPELL = { firaga: ['flame', '#ff8a1f', 'Firaga'], blizzaga: ['snowflake', '#8fdcff', 'Blizzaga'], thundaga: ['bolt', '#ffd23f', 'Thundaga'] };
  R.spell = r => { const [i, c, n] = SPELL[r.spell]; return `<div class="w-state">${icon(i, c, true, 30)}<div><div class="rsub">Next spell</div><b>${n}</b></div></div>`; };
  const ART = { buster: ['斬', '#b06bff', 'Buster'], shield: ['盾', '#ffd23f', 'Shield'], speed: ['疾', '#3da2ff', 'Speed'] };
  R.art = r => { const a = ART[r.art]; return a ? `<div class="w-art"><div class="kanji" style="color:${a[1]};text-shadow:0 0 10px ${a[1]}">${a[0]}</div><div class="rsub">${a[2]}</div></div>`
      : `<div class="w-art"><div class="kanji off">—</div><div class="rsub">No Art yet</div></div>`; };
  R.countdown = r => r.now
    ? `<div class="w-count now">${icon(r.icon, COLORS.rocket, true, 40)}<div><b>${r.what}!</b><div class="rsub">${r.label} · this turn</div></div></div>`
    : `<div class="w-count"><div class="countNum">${r.turns}</div><div><b>turn${r.turns === 1 ? '' : 's'}</b><div class="rsub">until ${r.what}</div></div></div>`;
  R.once = r => {
    const on = r.state !== 'used';
    const ico = r.icon === 'pill' ? pill(r.colors, on) : icon(r.icon, COLORS[r.icon], on, 30);
    const txt = r.state === 'used' ? (r.usedText || 'Used') : r.state === 'active' ? 'ACTIVE' : (r.readyText || 'Ready');
    return `<div class="w-once ${r.state} ${r.icon}">${ico}<div><div class="rsub">${r.label}</div><b>${txt}</b></div></div>`;
  };
  R.cond = r => {
    const ico = r.icon === 'go' ? `<span class="goTxt ${r.on ? 'on' : ''}">GO!</span>` : icon(r.icon, COLORS[r.icon], r.on, 30);
    return `<div class="w-cond ${r.on ? 'on' : ''}">${ico}<div><div class="rsub">${r.icon === 'go' ? 'Power Gauge' : r.label}</div><b>${r.on ? 'ACTIVE' : r.hint}</b></div></div>`;
  };

  const render = r => (R[r.kind] ? R[r.kind](r) : '');
  const mark = (m) => m === 'crosshair' ? `<div class="mark crosshair">${icon('crosshair', '#ff4d4d', true, 56)}</div>`
    : m === 'c4' ? `<div class="mark c4" title="C4 planted">${imgIcon('c4', true, 30)}</div>` : '';
  window.W = { render, icon, fallback, mark, S };
})();

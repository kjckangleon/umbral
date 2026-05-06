// === UI: HUD, Abyss popups, menu panels, floaters, cinematic =========
import { bus, clamp } from './util.js';
import { LORE, SYS_VOICE } from './lore.js';
import { SKILLS, GATES, RARITY } from './data.js';
import { sfx } from './audio.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

// === Abyss Interface popups ===
const abyss = $('#abyss');
const MAX_ABYSS = 4;
export function showAbyss(head, body, foot, kind = '') {
  abyss.classList.remove('hidden');
  // cap stack: drop oldest beyond limit
  while (abyss.children.length >= MAX_ABYSS) {
    abyss.children[0].remove();
  }
  const card = document.createElement('div');
  card.className = `abyss-card ${kind}`;
  card.innerHTML = `<div class="head">${head}</div><div class="body">${body}</div>${foot ? `<div class="foot">${foot}</div>` : ''}`;
  abyss.appendChild(card);
  sfx.systemPing();
  setTimeout(() => {
    card.classList.add('out');
    setTimeout(() => card.remove(), 350);
  }, 2600);
}

export function showAbyssLines(lines, kind = '') {
  lines.forEach((ln, i) => setTimeout(() => showAbyss('ABYSS INTERFACE', ln, '', kind), i * 600));
}

// === Floating combat numbers ===
const floaters = $('#floaters');
export function floatNumber(worldX, worldY, text, kind = '', cam) {
  const el = document.createElement('div');
  el.className = `floater ${kind}`;
  el.textContent = text;
  // map world->screen
  const r = $('#game').getBoundingClientRect();
  const sx = ((worldX - cam.x) / 1280) * r.width + r.left;
  const sy = ((worldY - cam.y) / 720) * r.height + r.top;
  el.style.left = sx + 'px';
  el.style.top = sy + 'px';
  floaters.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// === HUD ===
const hud = {
  hp: $('#bar-hp'), hpT: $('#bar-hp-text'),
  mp: $('#bar-mp'), mpT: $('#bar-mp-text'),
  xp: $('#bar-xp'), xpT: $('#bar-xp-text'),
  rank: $('#hud-rank'),
  zone: $('#hud-zone'),
  shadowList: $('#shadow-list'),
  skillEls: $$('.hud-skills .skill')
};

export function updateHUD(p) {
  hud.hp.style.width = (p.hp / p.hpMax * 100) + '%';
  hud.hpT.textContent = `${Math.ceil(p.hp)}/${p.hpMax}`;
  hud.mp.style.width = (p.mp / p.mpMax * 100) + '%';
  hud.mpT.textContent = `${Math.ceil(p.mp)}/${p.mpMax}`;
  hud.xp.style.width = (p.xp / p.xpNext * 100) + '%';
  hud.xpT.textContent = `LV ${p.level} — ${Math.floor(p.xp)}/${p.xpNext}`;
  hud.rank.textContent = `RANK · ${p.rank}`;
  hud.rank.className = `rank-${p.rank.toLowerCase()}`;

  // status icons
  let statusBox = document.getElementById('hud-status');
  if (!statusBox) {
    statusBox = document.createElement('div');
    statusBox.id = 'hud-status';
    statusBox.style.cssText = 'display:flex;gap:6px;margin-top:6px;font-size:11px;letter-spacing:.2em';
    hud.hp.parentElement.parentElement.appendChild(statusBox);
  }
  statusBox.innerHTML = Object.entries(p.statuses ?? {}).map(([k, st]) => {
    const c = k === 'burn' ? '#ff8a3a' : k === 'frost' || k === 'slow' ? '#7af5ff' : k === 'bleed' ? '#ff3b6b' : '#a06bff';
    return `<span style="color:${c};border:1px solid ${c};padding:2px 6px;background:rgba(0,0,0,.4)">${k.toUpperCase()} ${Math.ceil(st.dur)}s</span>`;
  }).join('');

  // skills
  const slots = ['1','2','3','4','r'];
  for (let i = 0; i < hud.skillEls.length; i++) {
    const slot = slots[i];
    const id = p.skillBar[slot];
    const el = hud.skillEls[i];
    const ico = el.querySelector('.ico');
    const cd = el.querySelector('.cd');
    if (!id) { el.classList.add('disabled'); ico.textContent = '—'; cd.style.transform = 'scaleY(0)'; continue; }
    const sk = SKILLS[id];
    el.classList.remove('disabled');
    ico.textContent = sk.icon;
    const cdLeft = p.cooldowns[id] ?? 0;
    cd.style.transform = `scaleY(${cdLeft > 0 ? cdLeft / sk.cd : 0})`;
  }

  // shadows
  hud.shadowList.innerHTML = '';
  for (const s of p.shadowPool.slice(0, 8)) {
    const row = document.createElement('div');
    row.className = 'shadow-row' + (s.commander ? ' cmd' : '');
    row.innerHTML = `<span class="lv">L${s.level}</span><span class="nm">${s.name}</span><span class="gly">${s.glyph}</span>`;
    hud.shadowList.appendChild(row);
  }
  if (p.shadowPool.length > 8) {
    const row = document.createElement('div');
    row.className = 'shadow-row';
    row.innerHTML = `<span class="nm">+ ${p.shadowPool.length - 8} more</span>`;
    hud.shadowList.appendChild(row);
  }
}

export function setZoneText(t) {
  hud.zone.textContent = `— ${t} —`;
  // re-trigger animation
  hud.zone.style.animation = 'none'; void hud.zone.offsetWidth;
  hud.zone.style.animation = '';
}

// damage flash on player hurt
export function flashDamage() {
  const f = document.createElement('div');
  f.className = 'dmg-flash';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 400);
}
export function flashLevel() {
  const f = document.createElement('div');
  f.className = 'lvl-flash';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1300);
}

// === Cinematic letterbox ===
const cine = $('#cinematic');
export function cinematic(text, dur = 2400) {
  cine.classList.remove('hidden');
  cine.querySelector('.cine-text').textContent = text;
  requestAnimationFrame(() => {
    cine.querySelector('.bar-top').style.height = '18%';
    cine.querySelector('.bar-bot').style.height = '18%';
    cine.classList.add('show');
  });
  setTimeout(() => {
    cine.classList.remove('show');
    cine.querySelector('.bar-top').style.height = '0';
    cine.querySelector('.bar-bot').style.height = '0';
    setTimeout(() => cine.classList.add('hidden'), 800);
  }, dur);
}

// === MENU ===
const menu = $('#menu');
let menuOpen = false;
let menuCallbacks = {};

export function bindMenu(callbacks) { menuCallbacks = callbacks; }

export function openMenu(p, world) {
  menuOpen = true;
  menu.classList.remove('hidden');
  sfx.uiOpen();
  renderMenu(p, world);
}
export function closeMenu() {
  menuOpen = false;
  menu.classList.add('hidden');
  sfx.ui();
}
export function isMenuOpen() { return menuOpen; }

$$('.menu-tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    $$('.menu-tabs button').forEach(b => b.classList.toggle('active', b === btn));
    $$('.menu-body section').forEach(s => s.classList.toggle('active', s.dataset.tab === tab));
    sfx.ui();
  });
});

function renderMenu(p, world) {
  // STATUS
  const statSec = $('section[data-tab="status"]');
  const statKeys = [['str','STRENGTH'],['agi','AGILITY'],['int','INTELLECT'],['vit','VITALITY'],['per','PERCEPTION'],['shadow','SHADOW POWER'],['mana','MANA'],['luck','LUCK']];
  statSec.innerHTML = `
    <div class="section-h">VESSEL STATUS — ${p.name} · ${p.rank}-RANK</div>
    <div class="points">UNSPENT POINTS: ${p.statPoints}</div>
    <div class="stat-grid">
      ${statKeys.map(([k, label]) => `
        <div class="stat-row">
          <span class="nm">${label}</span>
          <span class="vl">${p.stats[k]}</span>
          <button data-stat="${k}" ${p.statPoints <= 0 ? 'disabled' : ''}>+</button>
        </div>`).join('')}
    </div>
    <div class="section-h">DERIVED</div>
    <div class="stat-grid">
      <div class="stat-row"><span class="nm">HP MAX</span><span class="vl">${p.hpMax}</span></div>
      <div class="stat-row"><span class="nm">MP MAX</span><span class="vl">${p.mpMax}</span></div>
      <div class="stat-row"><span class="nm">ATTACK</span><span class="vl">${Math.round(p.atk)}</span></div>
      <div class="stat-row"><span class="nm">SPELL POWER</span><span class="vl">${Math.round(p.spellPower)}</span></div>
      <div class="stat-row"><span class="nm">CRIT %</span><span class="vl">${Math.round(p.crit*100)}</span></div>
      <div class="stat-row"><span class="nm">SHADOW AFFINITY</span><span class="vl">${Math.round(p.shadowAffinity*100)}%</span></div>
      <div class="stat-row"><span class="nm">MOVE SPD</span><span class="vl">${Math.round(p.spd)}</span></div>
      <div class="stat-row"><span class="nm">MAX ACTIVE SHADOWS</span><span class="vl">${p.maxActive}</span></div>
    </div>`;
  statSec.querySelectorAll('button[data-stat]').forEach(b => {
    b.addEventListener('click', () => { if (p.spendStat(b.dataset.stat)) { sfx.ui(); renderMenu(p, world); } });
  });

  // SKILLS
  const skSec = $('section[data-tab="skills"]');
  const allSkills = Object.values(SKILLS).filter(s => s.equippable);
  skSec.innerHTML = `
    <div class="section-h">SKILL POINTS: ${p.skillPoints}</div>
    <div class="section-h" style="margin-top:8px">EQUIPPED — drag to slot via [E]</div>
    ${allSkills.map(sk => {
      const owned = p.unlocked.has(sk.id);
      const lockedByLv = sk.unlockLv && p.level < sk.unlockLv;
      const equipped = Object.values(p.skillBar).includes(sk.id);
      return `<div class="skill-card ${owned ? '' : 'locked'} ${equipped ? 'equipped' : ''}">
        <div class="ic">${sk.icon}</div>
        <div>
          <div class="nm">${sk.name}</div>
          <div class="ds">${sk.desc} · COST ${sk.cost} · CD ${sk.cd}s${sk.unlockLv?` · UNLOCK LV ${sk.unlockLv}`:''}</div>
        </div>
        <div>
          ${!owned && !lockedByLv && p.skillPoints > 0 ?
            `<button data-unlock="${sk.id}">UNLOCK</button>` :
            owned ? `<button data-equip="${sk.id}">${equipped ? 'EQUIPPED' : 'EQUIP'}</button>` :
            `<button disabled>LOCKED</button>`}
        </div>
      </div>`;
    }).join('')}`;
  skSec.querySelectorAll('button[data-unlock]').forEach(b => b.addEventListener('click', () => {
    if (p.skillPoints > 0) { p.unlocked.add(b.dataset.unlock); p.skillPoints--; sfx.levelup(); renderMenu(p, world); }
  }));
  skSec.querySelectorAll('button[data-equip]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.equip;
    const sk = SKILLS[id];
    const slot = sk.slot ?? 1;
    p.skillBar[slot] = id;
    sfx.ui(); renderMenu(p, world);
  }));

  // SHADOWS
  const shSec = $('section[data-tab="shadows"]');
  shSec.innerHTML = `
    <div class="section-h">SHADOW LEGION — ${p.shadowPool.length} SOULS · ${p.maxActive} MAX ACTIVE</div>
    ${p.shadowPool.length === 0 ? `<div style="color:var(--dim);padding:24px;text-align:center">No shadows extracted yet. Defeat enemies and use [4] ARISE on their corpse.</div>` : ''}
    ${p.shadowPool.map((s, i) => `
      <div class="shadow-card ${s.commander ? 'cmd' : ''}">
        <div class="gl">${s.glyph}</div>
        <div>
          <div class="nm">${s.name} ${s.commander ? '· COMMANDER' : ''}</div>
          <div class="ds">${s.sourceType.toUpperCase()} · ${s.tierSrc.toUpperCase()} · originally LV ${s.level}</div>
        </div>
        <div class="lv">L${s.level}</div>
        <div>
          <button data-promote="${i}" ${p.shadowsExtracted < (i+1)*2 ? '' : ''}>RANK UP</button>
        </div>
      </div>`).join('')}`;
  shSec.querySelectorAll('button[data-promote]').forEach(b => b.addEventListener('click', () => {
    const idx = +b.dataset.promote;
    const s = p.shadowPool[idx];
    const cost = 50 * s.level;
    if (p.gold >= cost) {
      p.gold -= cost; s.level++;
      s.hpMax = Math.round(s.hpMax * 1.18); s.atk = Math.round(s.atk * 1.15);
      sfx.levelup(); renderMenu(p, world);
    } else { sfx.warn(); showAbyss('INSUFFICIENT TRIBUTE', `Costs ${cost} ☖`); }
  }));

  // INVENTORY
  const inv = $('section[data-tab="inventory"]');
  inv.innerHTML = `
    <div class="section-h">CURRENCY: ${p.gold} ☖ · INVENTORY (${p.inventory.length})</div>
    <div class="section-h">EQUIPPED</div>
    ${['weapon','armor','trinket'].map(slot => {
      const it = p.equipped[slot];
      return `<div class="skill-card equipped">
        <div class="ic" style="color:${it ? RARITY[it.rarity].c : '#444'}">${slot === 'weapon' ? '⚔' : slot === 'armor' ? '◈' : '◉'}</div>
        <div><div class="nm">${it ? it.name : `— no ${slot} —`}</div>
          <div class="ds">${it ? itemDesc(it) : 'Empty slot'}</div></div>
        <div>${it ? `<button data-unequip="${slot}">UNEQUIP</button>` : ''}</div>
      </div>`;
    }).join('')}
    <div class="section-h">CARRIED</div>
    ${p.inventory.length === 0 ? `<div style="color:var(--dim);padding:12px">Nothing yet.</div>` : ''}
    ${p.inventory.map((it, i) => `
      <div class="skill-card">
        <div class="ic" style="color:${RARITY[it.rarity].c}">${it.slot === 'weapon' ? '⚔' : it.slot === 'armor' ? '◈' : '◉'}</div>
        <div>
          <div class="nm" style="color:${RARITY[it.rarity].c}">${it.name} <span style="color:var(--dim);font-size:10px">[${RARITY[it.rarity].name}]</span></div>
          <div class="ds">${itemDesc(it)}</div>
        </div>
        <div><button data-equip-item="${i}">EQUIP</button></div>
      </div>`).join('')}`;
  inv.querySelectorAll('button[data-equip-item]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset['equipItem'];
    const it = p.inventory[i];
    const old = p.equipped[it.slot];
    p.equipped[it.slot] = it;
    p.inventory.splice(i, 1);
    if (old) p.inventory.push(old);
    p.recompute(); sfx.pickup(); renderMenu(p, world);
  }));
  inv.querySelectorAll('button[data-unequip]').forEach(b => b.addEventListener('click', () => {
    const slot = b.dataset.unequip;
    if (p.equipped[slot]) { p.inventory.push(p.equipped[slot]); p.equipped[slot] = null; p.recompute(); sfx.ui(); renderMenu(p, world); }
  }));

  // QUESTS
  const qs = $('section[data-tab="quests"]');
  const quests = world.quests ?? [];
  qs.innerHTML = `
    <div class="section-h">ABYSS DIRECTIVES</div>
    ${quests.length === 0 ? `<div style="color:var(--dim);padding:12px">No directives. The Abyss is silent.</div>` : ''}
    ${quests.map(q => `
      <div class="quest">
        <div class="ti">${q.title}</div>
        <div class="ds">${q.desc}</div>
        <div class="pg">${q.done ? '◉ COMPLETE — REWARD CLAIMED' : `▶ ${q.progress}/${q.target}`}</div>
      </div>`).join('')}`;

  // CODEX
  const lo = $('section[data-tab="lore"]');
  lo.innerHTML = `
    <div class="section-h">CODEX — ${LORE.worldName} · ${LORE.era}</div>
    <div class="lore-entry"><div class="ti">PROLOGUE</div><div class="tx">${LORE.intro.join('<br/>')}</div></div>
    <div class="section-h">SYSTEMS OF THE WORLD</div>
    ${LORE.systems.map(e => `<div class="lore-entry"><div class="ti">${e.ti}</div><div class="tx">${e.tx}</div></div>`).join('')}
    <div class="section-h">FACTIONS</div>
    ${LORE.factions.map(e => `<div class="lore-entry"><div class="ti">${e.name}</div><div class="tx">${e.desc}</div></div>`).join('')}
    <div class="section-h">THE NINE MONARCHS</div>
    ${LORE.monarchs.map(e => `<div class="lore-entry"><div class="ti">${e.name} — ${e.domain}</div><div class="tx">${e.note}</div></div>`).join('')}
    <div class="section-h">RANKS</div>
    ${LORE.ranks.map(r => `<div class="lore-entry"><div class="ti">${r.code}-RANK · ${r.name}</div><div class="tx">${r.note}</div></div>`).join('')}
    <div class="section-h">STORY ARC</div>
    ${LORE.storyBeats.map(b => `<div class="lore-entry"><div class="tx">${b}</div></div>`).join('')}`;

  // GATES
  const ga = $('section[data-tab="map"]');
  ga.innerHTML = `
    <div class="section-h">VEILS — DIMENSIONAL GATES</div>
    <div style="color:var(--dim);font-size:11px;margin-bottom:14px">Higher-rank Veils reward more, but the Hollow inside grows hungrier each floor. Defeat the floor's heart to seal it — or descend deeper.</div>
    <div class="gate-grid">
      ${GATES.map(g => {
        const locked = p.level < g.minLv;
        return `<div class="gate ${locked ? 'locked' : ''}" data-gate="${g.id}">
          <div class="rk rank-${(g.rankClass ?? g.rank).toLowerCase()}">${g.rank}</div>
          <div class="nm">${g.name}</div>
          <div class="ds">${g.desc}</div>
          <div class="tag">${g.floors === 99 ? 'INFINITE TOWER' : g.floors + ' FLOORS'} · BOSS: ${g.boss}${locked ? ` · LV ${g.minLv} REQUIRED` : ''}</div>
        </div>`;
      }).join('')}
    </div>`;
  ga.querySelectorAll('.gate').forEach(g => {
    g.addEventListener('click', () => {
      if (g.classList.contains('locked')) { sfx.warn(); return; }
      menuCallbacks.enterGate?.(g.dataset.gate);
    });
  });
}

function itemDesc(it) {
  const parts = [];
  for (const [k, v] of Object.entries(it.base ?? {})) parts.push(`+${v} ${k.toUpperCase()}`);
  for (const [k, v] of Object.entries(it.bonus ?? {})) parts.push(`+${v} ${k.toUpperCase()}`);
  return parts.join(' · ') || '—';
}

// === GFX :: procedural textures, lighting, post-fx, characters =========
// All textures generated once into offscreen canvases for speed.
import { TAU, rand, hsl } from './util.js';

// ---------- noise helpers ----------
function vnoise(x, y, seed = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}
function fbm(x, y, oct = 4, seed = 0) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += vnoise(x * f, y * f, seed + i) * a;
    a *= 0.5; f *= 2;
  }
  return v;
}

// ---------- texture cache ----------
const TEX = {};
function makeOff(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c;
}

// stone floor texture per biome
function makeFloorTex(palette, seed) {
  const SZ = 128;
  const c = makeOff(SZ, SZ);
  const x = c.getContext('2d');
  const img = x.createImageData(SZ, SZ);
  for (let j = 0; j < SZ; j++) {
    for (let i = 0; i < SZ; i++) {
      // tileable noise
      const u = i / SZ, v = j / SZ;
      const n = fbm(u * 4, v * 4, 5, seed)
              + 0.4 * fbm(u * 12, v * 12, 3, seed + 1);
      const cracks = Math.pow(Math.abs(fbm(u * 6, v * 6, 4, seed + 7) - 0.5), 2) * 6;
      const t = Math.max(0, Math.min(1, n * 0.6 + 0.3 - cracks * 0.4));
      // mix from dark to mid floor
      const r1 = palette.fr[0], g1 = palette.fr[1], b1 = palette.fr[2];
      const r2 = palette.fr2[0], g2 = palette.fr2[1], b2 = palette.fr2[2];
      const idx = (j * SZ + i) * 4;
      img.data[idx]     = r1 + (r2 - r1) * t;
      img.data[idx + 1] = g1 + (g2 - g1) * t;
      img.data[idx + 2] = b1 + (b2 - b1) * t;
      img.data[idx + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  // overlay subtle scratches
  x.globalAlpha = 0.08;
  x.strokeStyle = '#fff';
  for (let k = 0; k < 14; k++) {
    x.beginPath();
    x.moveTo(rand(0, SZ), rand(0, SZ));
    x.lineTo(rand(0, SZ), rand(0, SZ));
    x.stroke();
  }
  x.globalAlpha = 1;
  return c;
}

function makeWallTex(palette, seed) {
  const SZ = 128;
  const c = makeOff(SZ, SZ);
  const x = c.getContext('2d');
  const img = x.createImageData(SZ, SZ);
  for (let j = 0; j < SZ; j++) {
    for (let i = 0; i < SZ; i++) {
      const u = i / SZ, v = j / SZ;
      const n = fbm(u * 5, v * 5, 5, seed + 13);
      const block = ((Math.floor(j / 16) * 31 + Math.floor(i / 24) * 17) % 7) * 0.04;
      const t = Math.max(0, Math.min(1, n * 0.7 + block));
      const r1 = palette.wr[0], g1 = palette.wr[1], b1 = palette.wr[2];
      const r2 = palette.wr2[0], g2 = palette.wr2[1], b2 = palette.wr2[2];
      const idx = (j * SZ + i) * 4;
      img.data[idx]     = r1 + (r2 - r1) * t;
      img.data[idx + 1] = g1 + (g2 - g1) * t;
      img.data[idx + 2] = b1 + (b2 - b1) * t;
      img.data[idx + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  // mortar lines (faux brick)
  x.strokeStyle = 'rgba(0,0,0,.5)';
  x.lineWidth = 1;
  for (let yy = 0; yy < SZ; yy += 16) {
    x.beginPath(); x.moveTo(0, yy + 0.5); x.lineTo(SZ, yy + 0.5); x.stroke();
  }
  for (let yy = 0; yy < SZ; yy += 16) {
    const off = (yy / 16 % 2) * 12;
    for (let xx = off; xx < SZ; xx += 24) {
      x.beginPath(); x.moveTo(xx + 0.5, yy); x.lineTo(xx + 0.5, yy + 16); x.stroke();
    }
  }
  return c;
}

// blood splat decal
function makeBloodDecal(seed = 0) {
  const SZ = 96;
  const c = makeOff(SZ, SZ);
  const x = c.getContext('2d');
  const cx = SZ/2, cy = SZ/2;
  const grad = x.createRadialGradient(cx, cy, 0, cx, cy, SZ/2);
  grad.addColorStop(0, 'rgba(120,0,15,0.85)');
  grad.addColorStop(0.5, 'rgba(60,0,8,0.55)');
  grad.addColorStop(1, 'rgba(20,0,5,0)');
  x.fillStyle = grad;
  x.beginPath();
  for (let a = 0; a < TAU; a += 0.2) {
    const r = SZ * 0.32 + (vnoise(Math.cos(a)*3, Math.sin(a)*3, seed) - 0.5) * SZ * 0.28;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
  }
  x.closePath(); x.fill();
  // splatter dots
  for (let k = 0; k < 14; k++) {
    const a = rand(0, TAU);
    const r = rand(SZ*0.3, SZ*0.48);
    x.fillStyle = `rgba(${100 + rand(-20,40)},${rand(0,10)},${rand(0,15)},${rand(0.3,0.7)})`;
    x.beginPath(); x.arc(cx + Math.cos(a)*r, cy + Math.sin(a)*r, rand(1,3), 0, TAU); x.fill();
  }
  return c;
}

// biome palettes — RGB triplets
const PALETTES = {
  urban:     { fr:[12,11,18], fr2:[40,34,52], wr:[26,22,36], wr2:[60,48,80], light:'#a06bff' },
  mirror:    { fr:[ 6, 8,14], fr2:[28,38,60], wr:[18,28,50], wr2:[44,72,110], light:'#7af5ff' },
  frost:     { fr:[10,18,28], fr2:[60,90,120], wr:[30,55,80], wr2:[80,130,170], light:'#9bdcff' },
  ruin:      { fr:[14,10, 6], fr2:[58,42,26], wr:[44,32,20], wr2:[100,76,48], light:'#f5c97b' },
  cathedral: { fr: [8, 0,14], fr2:[60,10,80], wr:[28, 0,40], wr2:[110,40,140], light:'#ff8aff' },
  crypt:     { fr:[14, 6,10], fr2:[60,20,30], wr:[40,16,22], wr2:[100,40,52], light:'#ff3b6b' },
  tower:     { fr: [8, 8,16], fr2:[40,40,72], wr:[20,20,42], wr2:[60,60,110], light:'#a06bff' },
  void:      { fr: [2, 0, 8], fr2:[30, 0,50], wr:[ 8, 0,18], wr2:[80, 0,120], light:'#ff3b6b' }
};

export function getBiomeAssets(biome) {
  if (TEX[biome]) return TEX[biome];
  const pal = PALETTES[biome] ?? PALETTES.urban;
  const seed = biome.charCodeAt(0) * 7;
  TEX[biome] = {
    floor: makeFloorTex(pal, seed),
    wall:  makeWallTex(pal, seed + 5),
    floorPat: null, wallPat: null,
    light: pal.light,
    pal
  };
  return TEX[biome];
}

// blood decals shared
export const BLOOD = [makeBloodDecal(1), makeBloodDecal(7), makeBloodDecal(13), makeBloodDecal(31)];

// ============================================================
// LIGHTING — radial light pools composited with multiply
// ============================================================
// We render the world to main, then composite a "light" layer over it.
let LIGHT_BUF = null;
export function getLightBuffer(w, h) {
  if (!LIGHT_BUF || LIGHT_BUF.width !== w || LIGHT_BUF.height !== h) {
    LIGHT_BUF = makeOff(w, h);
  }
  return LIGHT_BUF;
}

export function drawRadialLight(ctx, x, y, r, color = '#ffae5b', intensity = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, 0.95 * intensity));
  g.addColorStop(0.4, hexA(color, 0.45 * intensity));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

function hexA(hex, a) {
  if (typeof hex !== 'string') return `rgba(160,107,255,${a})`;
  if (hex.startsWith('hsla(') || hex.startsWith('rgba(')) {
    // already has alpha — replace it
    return hex.replace(/,\s*[\d.]+\)\s*$/, `,${a})`);
  }
  if (hex.startsWith('hsl(')) {
    return hex.replace(/^hsl\(/, 'hsla(').replace(/\)$/, `,${a})`);
  }
  if (hex.startsWith('rgb(')) {
    return hex.replace(/^rgb\(/, 'rgba(').replace(/\)$/, `,${a})`);
  }
  if (!hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ============================================================
// AMBIENT PARTICLES — dust motes drifting upward
// ============================================================
const ambient = [];
export function updateAmbient(dt, cam, viewW, viewH) {
  // ensure pool
  while (ambient.length < 80) {
    ambient.push({
      x: cam.x + rand(-100, viewW + 100),
      y: cam.y + rand(-100, viewH + 100),
      vx: rand(-4, 4), vy: rand(-12, -3),
      life: rand(2, 6), max: 6, sz: rand(1, 2.5)
    });
  }
  for (const p of ambient) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    // recycle when off camera or expired
    if (p.life <= 0 || p.x < cam.x - 200 || p.x > cam.x + viewW + 200 || p.y < cam.y - 200 || p.y > cam.y + viewH + 200) {
      p.x = cam.x + rand(-50, viewW + 50);
      p.y = cam.y + viewH + rand(0, 80);
      p.vx = rand(-4, 4); p.vy = rand(-12, -3);
      p.life = p.max = rand(3, 7);
    }
  }
}
export function drawAmbient(ctx, cam, color = '#a06bff') {
  ctx.save();
  for (const p of ambient) {
    const a = (p.life / p.max) * 0.5;
    ctx.fillStyle = hexA(color, a);
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, p.sz, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ============================================================
// CHARACTER RENDERING — hooded sovereign with animated cloak
// ============================================================
export function drawSovereign(ctx, x, y, facing, t, opts = {}) {
  const moving = opts.moving || false;
  const dom = opts.domain || 0;
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.beginPath();
  ctx.ellipse(x, y + 16, 18, 7, 0, 0, TAU);
  ctx.fill();

  // cloak (back) — drifts behind based on facing
  const sway = Math.sin(t * 6) * (moving ? 4 : 1.5);
  const back = facing + Math.PI;
  const bx = x + Math.cos(back) * 6;
  const by = y + Math.sin(back) * 6 + 6;
  // cloak silhouette
  const grad = ctx.createLinearGradient(bx - 18, by - 8, bx + 18, by + 30);
  grad.addColorStop(0, '#1a0f28');
  grad.addColorStop(1, '#070410');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - 14, y - 4);
  ctx.quadraticCurveTo(bx - 18 + sway, by + 14, bx - 6 + sway * 0.6, by + 28);
  ctx.lineTo(bx + 6 - sway * 0.6, by + 28);
  ctx.quadraticCurveTo(bx + 18 - sway, by + 14, x + 14, y - 4);
  ctx.closePath();
  ctx.fill();
  // cloak rim
  ctx.strokeStyle = 'rgba(160,107,255,.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // body — armored torso
  const bodyGrad = ctx.createLinearGradient(x, y - 8, x, y + 14);
  bodyGrad.addColorStop(0, '#2a1f3c');
  bodyGrad.addColorStop(1, '#0c0818');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 6);
  ctx.lineTo(x + 9, y - 6);
  ctx.lineTo(x + 11, y + 12);
  ctx.lineTo(x - 11, y + 12);
  ctx.closePath();
  ctx.fill();
  // pauldrons
  ctx.fillStyle = '#1a1228';
  ctx.beginPath(); ctx.arc(x - 10, y - 4, 5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 10, y - 4, 5, 0, TAU); ctx.fill();
  // chest sigil
  ctx.fillStyle = dom > 0 ? '#ff3b6b' : '#a06bff';
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(x, y + 2, 2, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;

  // hood
  ctx.fillStyle = '#0a0612';
  ctx.beginPath();
  ctx.arc(x, y - 14, 10, 0, TAU);
  ctx.fill();
  // hood inner shadow (face)
  ctx.fillStyle = 'rgba(0,0,0,.85)';
  ctx.beginPath();
  ctx.ellipse(x, y - 13, 6, 7, 0, 0, TAU);
  ctx.fill();
  // glowing eyes
  const eyeC = dom > 0 ? '#ff3b6b' : '#a06bff';
  ctx.fillStyle = eyeC;
  ctx.shadowColor = eyeC; ctx.shadowBlur = 12;
  ctx.fillRect(x - 4, y - 14, 2.6, 1.8);
  ctx.fillRect(x + 1.4, y - 14, 2.6, 1.8);
  ctx.shadowBlur = 0;

  // weapon — abstract shadow blade pointing toward facing
  const wx = x + Math.cos(facing) * 14;
  const wy = y + Math.sin(facing) * 14;
  ctx.save();
  ctx.translate(wx, wy);
  ctx.rotate(facing);
  // blade
  const bg = ctx.createLinearGradient(0, 0, 22, 0);
  bg.addColorStop(0, 'rgba(160,107,255,.0)');
  bg.addColorStop(0.4, 'rgba(160,107,255,.5)');
  bg.addColorStop(1, '#fff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, -1.2, 22, 2.4);
  ctx.shadowColor = '#a06bff'; ctx.shadowBlur = 8;
  ctx.fillRect(0, -0.6, 22, 1.2);
  ctx.shadowBlur = 0;
  ctx.restore();

  // domain aura
  if (dom > 0) {
    const aP = 0.4 + 0.25 * Math.sin(t * 12);
    ctx.strokeStyle = `rgba(255,59,107,${aP})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 56 + Math.sin(t * 6) * 4, 0, TAU); ctx.stroke();
    // ring of glyphs
    for (let i = 0; i < 6; i++) {
      const a = t * 1.2 + i * TAU / 6;
      const rx = x + Math.cos(a) * 70;
      const ry = y + Math.sin(a) * 70;
      ctx.fillStyle = '#ff3b6b';
      ctx.shadowColor = '#ff3b6b'; ctx.shadowBlur = 10;
      ctx.font = '14px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('◈', rx, ry);
      ctx.shadowBlur = 0;
    }
  }
}

// ============================================================
// CREATURE RENDERING — multi-part procedural body
// ============================================================
export function drawCreature(ctx, x, y, t, cfg) {
  const r = cfg.r;
  const wob = Math.sin(t * 6 + cfg.seed * 5) * 1.5;

  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.7, r * 1.0, r * 0.4, 0, 0, TAU);
  ctx.fill();

  // tendrils / aura under body
  if (cfg.kind === 'phantom' || cfg.kind === 'caster' || cfg.kind === 'summoner') {
    for (let i = 0; i < 5; i++) {
      const a = t * 2 + cfg.seed + i * TAU / 5;
      const len = r * (0.6 + Math.sin(t * 3 + i) * 0.2);
      ctx.strokeStyle = hexA(cfg.elemColor || '#a06bff', 0.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.4);
      ctx.quadraticCurveTo(
        x + Math.cos(a) * r * 0.6, y + r * 0.6,
        x + Math.cos(a) * len, y + r * 0.4 + Math.sin(a) * len * 0.5
      );
      ctx.stroke();
    }
  }

  // body (procedural shape per archetype)
  const body = cfg.bodyColor;
  const flash = cfg.flash;
  ctx.fillStyle = flash ? '#fff' : body;

  if (cfg.kind === 'brute' || cfg.kind === 'tank') {
    // hulking torso with armor plates
    const grad = ctx.createLinearGradient(x, y - r, x, y + r);
    grad.addColorStop(0, lighten(body, 0.3));
    grad.addColorStop(1, darken(body, 0.4));
    ctx.fillStyle = flash ? '#fff' : grad;
    // body
    roundRect(ctx, x - r, y - r * 0.9, r * 2, r * 1.8, r * 0.3);
    ctx.fill();
    // rim
    ctx.strokeStyle = darken(body, 0.6);
    ctx.lineWidth = 2; ctx.stroke();
    // plate detail
    ctx.fillStyle = darken(body, 0.5);
    ctx.fillRect(x - r * 0.7, y - r * 0.2, r * 1.4, r * 0.15);
    // helm / head
    ctx.fillStyle = darken(body, 0.7);
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.85, r * 0.6, r * 0.45, 0, 0, TAU); ctx.fill();
    // glowing eye-slit
    ctx.fillStyle = cfg.elemColor || '#ff3b6b';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
    ctx.fillRect(x - r * 0.4, y - r * 0.9, r * 0.8, r * 0.08);
    ctx.shadowBlur = 0;
  } else if (cfg.kind === 'assassin') {
    // crouched bladed silhouette
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(cfg.facing);
    const grad = ctx.createLinearGradient(-r, 0, r, 0);
    grad.addColorStop(0, darken(body, 0.5));
    grad.addColorStop(1, lighten(body, 0.2));
    ctx.fillStyle = flash ? '#fff' : grad;
    ctx.beginPath();
    ctx.moveTo(r * 1.1, 0);
    ctx.lineTo(-r * 0.6, -r * 0.7);
    ctx.lineTo(-r * 0.9, 0);
    ctx.lineTo(-r * 0.6, r * 0.7);
    ctx.closePath();
    ctx.fill();
    // blade extending
    ctx.fillStyle = '#fff';
    ctx.shadowColor = cfg.elemColor || '#a06bff'; ctx.shadowBlur = 10;
    ctx.fillRect(r * 0.6, -1, r * 1.4, 2);
    ctx.shadowBlur = 0;
    // eye
    ctx.fillStyle = cfg.elemColor || '#ff3b6b';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.fillRect(r * 0.2, -1, 3, 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  } else if (cfg.kind === 'caster' || cfg.kind === 'summoner') {
    // robed mage with floating runes
    const grad = ctx.createLinearGradient(x, y - r, x, y + r);
    grad.addColorStop(0, '#1a0f2c');
    grad.addColorStop(1, darken(body, 0.5));
    ctx.fillStyle = flash ? '#fff' : grad;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.1);
    ctx.lineTo(x - r * 0.95, y + r);
    ctx.lineTo(x + r * 0.95, y + r);
    ctx.closePath();
    ctx.fill();
    // hood top
    ctx.fillStyle = '#0a0414';
    ctx.beginPath(); ctx.arc(x, y - r * 0.6, r * 0.5, 0, TAU); ctx.fill();
    // glowing eyes
    ctx.fillStyle = cfg.elemColor || '#a06bff';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
    ctx.fillRect(x - r * 0.25, y - r * 0.55, 2, 1.5);
    ctx.fillRect(x + r * 0.1, y - r * 0.55, 2, 1.5);
    ctx.shadowBlur = 0;
    // floating sigil
    const sa = t * 2 + cfg.seed;
    ctx.fillStyle = cfg.elemColor || '#a06bff';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
    ctx.font = `${r * 0.7}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('卐', x + Math.cos(sa) * r * 1.2, y + Math.sin(sa) * 4 - r * 0.2);
    ctx.shadowBlur = 0;
  } else if (cfg.kind === 'phantom') {
    // wispy ghost — translucent body
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
    grad.addColorStop(0, hexA(cfg.elemColor || '#7af5ff', 0.85));
    grad.addColorStop(0.5, hexA(body, 0.5));
    grad.addColorStop(1, hexA(body, 0));
    ctx.fillStyle = flash ? '#fff' : grad;
    ctx.beginPath();
    // wavy bottom
    ctx.moveTo(x - r, y + wob);
    ctx.quadraticCurveTo(x, y - r * 1.3, x + r, y + wob);
    for (let i = 0; i <= 6; i++) {
      const px = x + r - (r * 2) * (i / 6);
      const py = y + r + Math.sin(t * 4 + i) * 4;
      ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    // eyes
    ctx.fillStyle = '#fff';
    ctx.shadowColor = cfg.elemColor || '#7af5ff'; ctx.shadowBlur = 14;
    ctx.fillRect(x - r * 0.35, y - r * 0.3, 2, 3);
    ctx.fillRect(x + r * 0.2, y - r * 0.3, 2, 3);
    ctx.shadowBlur = 0;
  } else if (cfg.kind === 'ranged') {
    // archer — slim with bow
    const grad = ctx.createLinearGradient(x, y - r, x, y + r);
    grad.addColorStop(0, lighten(body, 0.3));
    grad.addColorStop(1, darken(body, 0.4));
    ctx.fillStyle = flash ? '#fff' : grad;
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.7, r, 0, 0, TAU); ctx.fill();
    // head
    ctx.fillStyle = darken(body, 0.5);
    ctx.beginPath(); ctx.arc(x, y - r * 0.8, r * 0.4, 0, TAU); ctx.fill();
    // bow held forward
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(cfg.facing);
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r * 0.8, 0, r * 0.6, -Math.PI/2.5, Math.PI/2.5);
    ctx.stroke();
    ctx.strokeStyle = hexA(cfg.elemColor || '#7af5ff', 0.6);
    ctx.beginPath();
    ctx.moveTo(r * 0.8, -r * 0.5);
    ctx.lineTo(r * 0.8, r * 0.5);
    ctx.stroke();
    ctx.restore();
    // glowing eye
    ctx.fillStyle = cfg.elemColor || '#7af5ff';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.fillRect(x - 1, y - r * 0.85, 2, 1.5);
    ctx.shadowBlur = 0;
  } else if (cfg.kind === 'swarm') {
    // small skittering bug
    ctx.fillStyle = flash ? '#fff' : darken(body, 0.2);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, cfg.facing, 0, TAU);
    ctx.fill();
    // legs
    ctx.strokeStyle = darken(body, 0.5);
    ctx.lineWidth = 1.4;
    for (let i = -1; i <= 1; i += 2) {
      for (let j = -1; j <= 1; j += 2) {
        const lx = x + Math.cos(cfg.facing + j) * r * 0.5;
        const ly = y + Math.sin(cfg.facing + j) * r * 0.5;
        const tip = i * (Math.sin(t * 18 + cfg.seed + j) + 1) * r * 0.5;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + Math.cos(cfg.facing + j * 1.2) * r * 0.9, ly + Math.sin(cfg.facing + j * 1.2) * r * 0.9 + tip);
        ctx.stroke();
      }
    }
    // single red eye
    ctx.fillStyle = '#ff3b6b';
    ctx.shadowColor = '#ff3b6b'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(x + Math.cos(cfg.facing) * r * 0.5, y + Math.sin(cfg.facing) * r * 0.5, 1.8, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // grunt — humanoid stalker
    const grad = ctx.createLinearGradient(x, y - r, x, y + r);
    grad.addColorStop(0, lighten(body, 0.25));
    grad.addColorStop(1, darken(body, 0.4));
    ctx.fillStyle = flash ? '#fff' : grad;
    // torso
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y - r * 0.4);
    ctx.lineTo(x + r * 0.7, y - r * 0.4);
    ctx.lineTo(x + r * 0.5, y + r);
    ctx.lineTo(x - r * 0.5, y + r);
    ctx.closePath(); ctx.fill();
    // head
    ctx.fillStyle = darken(body, 0.5);
    ctx.beginPath(); ctx.arc(x, y - r * 0.8, r * 0.45, 0, TAU); ctx.fill();
    // arms swing
    const sw = Math.sin(t * 8 + cfg.seed) * r * 0.3;
    ctx.strokeStyle = darken(body, 0.3); ctx.lineWidth = r * 0.32;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y - r * 0.2);
    ctx.lineTo(x - r * 0.9, y + sw);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.6, y - r * 0.2);
    ctx.lineTo(x + r * 0.9, y - sw);
    ctx.stroke();
    // glowing eyes
    ctx.fillStyle = cfg.elemColor || '#ff3b6b';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.fillRect(x - r * 0.2, y - r * 0.85, 2, 1.5);
    ctx.fillRect(x + r * 0.05, y - r * 0.85, 2, 1.5);
    ctx.shadowBlur = 0;
  }

  // boss crown
  if (cfg.boss) {
    ctx.fillStyle = '#ff3b6b';
    ctx.shadowColor = '#ff3b6b'; ctx.shadowBlur = 16;
    ctx.font = `${r * 0.8}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('♛', x, y - r * 1.0);
    ctx.shadowBlur = 0;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lighten(hex, t) { return shiftHex(hex, t); }
function darken(hex, t)  { return shiftHex(hex, -t); }
function shiftHex(input, t) {
  // input may be 'hsl...' or '#rrggbb'
  if (input.startsWith('hsl')) {
    return input.replace(/(\d+)%\)$/, (_, l) => `${Math.max(0, Math.min(100, +l + t * 40))}%)`);
  }
  if (input.startsWith('#')) {
    let r = parseInt(input.slice(1, 3), 16);
    let g = parseInt(input.slice(3, 5), 16);
    let b = parseInt(input.slice(5, 7), 16);
    r = Math.max(0, Math.min(255, r + t * 100));
    g = Math.max(0, Math.min(255, g + t * 100));
    b = Math.max(0, Math.min(255, b + t * 100));
    return `rgb(${r|0},${g|0},${b|0})`;
  }
  return input;
}

// ============================================================
// POST-FX — vignette + chromatic aberration on hit
// ============================================================
export function postFX(ctx, w, h, hitFlash) {
  // vignette
  const grad = ctx.createRadialGradient(w/2, h/2, h * 0.3, w/2, h/2, h * 0.85);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // film grain
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 60; i++) {
    ctx.fillRect(rand(0, w), rand(0, h), 1, 1);
  }
  ctx.globalAlpha = 1;

  // chromatic aberration on hit
  if (hitFlash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = hitFlash * 0.18;
    ctx.fillStyle = '#ff003c';
    ctx.fillRect(2, 0, w, h);
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(-2, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ============================================================
// BLOOD DECALS — drawn on dungeon ground when enemies die
// ============================================================
export const decals = [];
export function addBloodDecal(x, y, scale = 1) {
  decals.push({ x, y, scale, rot: rand(0, TAU), tex: BLOOD[Math.floor(rand(0, BLOOD.length))], life: 60, max: 60 });
  if (decals.length > 80) decals.shift();
}
export function drawDecals(ctx, cam, w, h) {
  for (const d of decals) {
    const sx = d.x - cam.x, sy = d.y - cam.y;
    if (sx < -64 || sy < -64 || sx > w + 64 || sy > h + 64) continue;
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(d.rot);
    ctx.globalAlpha = Math.min(1, d.life / 30);
    ctx.drawImage(d.tex, -48 * d.scale, -48 * d.scale, 96 * d.scale, 96 * d.scale);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
export function tickDecals(dt) {
  for (const d of decals) d.life -= dt * 0.2;
  for (let i = decals.length - 1; i >= 0; i--) if (decals[i].life <= 0) decals.splice(i, 1);
}

// === Dungeon generation ===============================================
import { rand, randi, choice, dist, TAU, hsl, chance } from './util.js';
import { Enemy } from './entities.js';
import { ENEMY_NAMES } from './lore.js';
import { getBiomeAssets, drawRadialLight, getLightBuffer, drawDecals } from './gfx.js';

export function generateDungeon(gate, floor = 1) {
  const tileSize = 64;
  const w = 60 + Math.min(40, floor * 4);
  const h = 60 + Math.min(40, floor * 4);
  // grid: 0=wall, 1=floor
  const grid = Array.from({ length: h }, () => Array(w).fill(0));

  // BSP-like room placement
  const rooms = [];
  const desired = 6 + Math.floor(floor / 2) + randi(0, 4);
  let tries = 0;
  while (rooms.length < desired && tries < 400) {
    tries++;
    const rw = randi(6, 13), rh = randi(6, 11);
    const rx = randi(2, w - rw - 2), ry = randi(2, h - rh - 2);
    const r = { x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) };
    if (rooms.some(o => Math.abs(o.cx - r.cx) < (o.w + r.w) / 2 + 2 && Math.abs(o.cy - r.cy) < (o.h + r.h) / 2 + 2)) continue;
    rooms.push(r);
  }
  // carve rooms
  for (const r of rooms) {
    for (let yy = r.y; yy < r.y + r.h; yy++)
      for (let xx = r.x; xx < r.x + r.w; xx++) grid[yy][xx] = 1;
  }
  // connect with corridors
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    let cx = a.cx, cy = a.cy;
    while (cx !== b.cx) { grid[cy][cx] = 1; grid[cy + 1] && (grid[cy + 1][cx] = 1); cx += cx < b.cx ? 1 : -1; }
    while (cy !== b.cy) { grid[cy][cx] = 1; grid[cy][cx + 1] = 1; cy += cy < b.cy ? 1 : -1; }
  }

  // boss room: last for boss floor
  const isBossFloor = floor >= gate.floors;
  const start = rooms[0];
  const exit = rooms[rooms.length - 1];

  // entities
  const enemies = [];
  const props = [];
  const minLv = gate.enemyLv[0], maxLv = gate.enemyLv[1];

  for (let i = 1; i < rooms.length - (isBossFloor ? 1 : 0); i++) {
    const r = rooms[i];
    const count = randi(2, 5);
    // pick a room "theme" for cohesive packs
    const themes = ['mixed','swarm','sentry','ambush','choir','garrison'];
    const theme = themes[(i + floor) % themes.length];
    for (let k = 0; k < count; k++) {
      const ex = (r.x + randi(1, r.w - 1)) * tileSize;
      const ey = (r.y + randi(1, r.h - 1)) * tileSize;
      const lv = randi(minLv, maxLv + 1);
      const t = pickArchetype(theme, floor);
      const eliteChance = 0.06 + floor * 0.012 + (theme === 'garrison' ? 0.05 : 0);
      const tier = chance(eliteChance) ? 'elite' : 'normal';
      enemies.push(new Enemy(ex, ey, lv, t, tier));
    }
    // props (atmospheric)
    for (let k = 0; k < randi(2, 5); k++) {
      props.push({
        x: (r.x + rand(0, r.w)) * tileSize,
        y: (r.y + rand(0, r.h)) * tileSize,
        type: choice(['rune','bone','torch','rubble','sigil'])
      });
    }
  }

  // boss
  let boss = null;
  if (isBossFloor) {
    const cx = exit.cx * tileSize, cy = exit.cy * tileSize;
    boss = new Enemy(cx, cy, maxLv + 2, 'boss', 'boss');
    boss.name = gate.boss;
    enemies.push(boss);
  }

  // exit portal at last room (for non-boss floors) or after boss (handled at runtime)
  const exitX = exit.cx * tileSize;
  const exitY = exit.cy * tileSize;
  const startX = start.cx * tileSize;
  const startY = start.cy * tileSize;

  return {
    grid, w, h, tileSize, rooms,
    startX, startY, exitX, exitY,
    enemies, props, boss,
    biome: gate.biome,
    floor,
    isBossFloor
  };
}

// drawing the dungeon
export function drawDungeon(ctx, d, cam, w, h, t, player) {
  const ts = d.tileSize;
  const x0 = Math.max(0, Math.floor(cam.x / ts) - 1);
  const y0 = Math.max(0, Math.floor(cam.y / ts) - 1);
  const x1 = Math.min(d.w, Math.ceil((cam.x + w) / ts) + 1);
  const y1 = Math.min(d.h, Math.ceil((cam.y + h) / ts) + 1);

  const assets = getBiomeAssets(d.biome);
  // create patterns lazily
  if (!assets.floorPat) {
    assets.floorPat = ctx.createPattern(assets.floor, 'repeat');
    assets.wallPat  = ctx.createPattern(assets.wall, 'repeat');
  }

  // === FLOOR (textured pattern) ===
  ctx.save();
  ctx.fillStyle = '#02020a';
  ctx.fillRect(0, 0, w, h);
  // Draw floors in world-space so the texture stays anchored
  ctx.translate(-cam.x, -cam.y);
  ctx.fillStyle = assets.floorPat;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (d.grid[y][x] === 1) {
        ctx.fillRect(x * ts, y * ts, ts, ts);
      }
    }
  }
  ctx.restore();

  // === WALLS — textured + extruded shading ===
  const WALL_H = 22;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (d.grid[y][x] !== 0) continue;
      const px = x * ts, py = y * ts;
      // wall fill
      ctx.fillStyle = assets.wallPat;
      ctx.fillRect(px, py, ts, ts);
      // top-down shading
      const shade = ctx.createLinearGradient(0, py, 0, py + ts);
      shade.addColorStop(0, 'rgba(0,0,0,0.4)');
      shade.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = shade;
      ctx.fillRect(px, py, ts, ts);
      // extruded edge: highlight cap + shadow drop if floor below
      const floorBelow = d.grid[y + 1] && d.grid[y + 1][x] === 1;
      if (floorBelow) {
        ctx.fillStyle = `rgb(${assets.pal.wr2[0]},${assets.pal.wr2[1]},${assets.pal.wr2[2]})`;
        ctx.fillRect(px, py + ts - 4, ts, 4);
        ctx.fillStyle = 'rgba(0,0,0,.85)';
        ctx.fillRect(px, py + ts - 1, ts, 2);
        // shadow drop onto floor
        const sh = ctx.createLinearGradient(0, py + ts, 0, py + ts + WALL_H);
        sh.addColorStop(0, 'rgba(0,0,0,0.7)');
        sh.addColorStop(1, 'rgba(0,0,0,0.0)');
        ctx.fillStyle = sh;
        ctx.fillRect(px, py + ts, ts, WALL_H);
      }
    }
  }
  ctx.restore();

  // grid-floor highlights / runes (sparse)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (d.grid[y][x] !== 1) continue;
      if ((x * 73 + y * 31) % 23 === 0) {
        const a = 0.15 + 0.1 * Math.sin(t * 2 + x + y);
        ctx.fillStyle = `rgba(160,107,255,${a})`;
        const px = x * ts + ts/2 - cam.x, py = y * ts + ts/2 - cam.y;
        ctx.beginPath(); ctx.arc(px, py, 2.5, 0, TAU); ctx.fill();
      }
    }
  }

  // === blood decals layer ===
  drawDecals(ctx, cam, w, h);

  // === exit portal ===
  if (!d.isBossFloor || d.boss?.dead) {
    const t1 = performance.now() / 400;
    const px = d.exitX - cam.x, py = d.exitY - cam.y;
    ctx.save();
    ctx.translate(px, py);
    // ground glow
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
    gg.addColorStop(0, 'rgba(160,107,255,.7)');
    gg.addColorStop(1, 'rgba(160,107,255,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, 90, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const r = 24 + i * 8 + Math.sin(t1 + i) * 4;
      ctx.strokeStyle = `rgba(200,150,255,${0.7 - i * 0.13})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    }
    // tear in space — vertical slit
    ctx.fillStyle = '#0a0014';
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#a06bff'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.ellipse(0, 0, 3, 14, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // === props ===
  ctx.font = '20px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of d.props) {
    const px = p.x - cam.x, py = p.y - cam.y;
    if (px < -40 || py < -40 || px > w + 40 || py > h + 40) continue;
    if (p.type === 'rune') {
      ctx.fillStyle = `rgba(160,107,255,${0.4 + 0.2 * Math.sin(t * 2 + p.x)})`;
      ctx.shadowColor = '#a06bff'; ctx.shadowBlur = 8;
      ctx.fillText('卐', px, py);
      ctx.shadowBlur = 0;
    } else if (p.type === 'sigil') {
      ctx.fillStyle = 'rgba(255,59,107,.65)';
      ctx.shadowColor = '#ff3b6b'; ctx.shadowBlur = 10;
      ctx.fillText('☥', px, py);
      ctx.shadowBlur = 0;
    } else if (p.type === 'torch') {
      const fy = Math.sin(t * 6 + p.x) * 1.5;
      // post
      ctx.fillStyle = '#1a0e08';
      ctx.fillRect(px - 2, py - 2, 4, 18);
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(px - 3, py + 14, 6, 4);
      // flame outer glow
      const og = ctx.createRadialGradient(px, py - 4 + fy, 0, px, py - 4, 30);
      og.addColorStop(0, 'rgba(255,180,80,.9)');
      og.addColorStop(0.5, 'rgba(255,80,30,.4)');
      og.addColorStop(1, 'rgba(255,80,30,0)');
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(px, py - 4 + fy, 30, 0, TAU); ctx.fill();
      // flame core
      ctx.fillStyle = '#ffe082';
      ctx.beginPath(); ctx.ellipse(px, py - 4 + fy, 4, 8 + Math.abs(fy), 0, 0, TAU); ctx.fill();
    } else if (p.type === 'bone') {
      ctx.fillStyle = '#ddd2b6'; ctx.font = '24px serif';
      ctx.fillText('☠', px, py);
    } else if (p.type === 'rubble') {
      ctx.fillStyle = '#0a0610';
      ctx.beginPath(); ctx.ellipse(px, py + 2, 10, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a2030';
      ctx.beginPath(); ctx.arc(px, py - 1, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a3040';
      ctx.beginPath(); ctx.arc(px - 3, py - 3, 4, 0, TAU); ctx.fill();
    }
  }
}

// === LIGHT PASS — renders a multiply layer of light pools over scene ===
export function drawLighting(ctx, d, cam, w, h, t, player, extras = []) {
  const buf = getLightBuffer(w, h);
  const lc = buf.getContext('2d');
  // base darkness — varies by biome ambient
  const ambient = d.biome === 'void' ? 0.92
                : d.biome === 'crypt' ? 0.85
                : d.biome === 'cathedral' ? 0.82
                : d.biome === 'frost' ? 0.55
                : d.biome === 'mirror' ? 0.7
                : d.biome === 'tower' ? 0.88
                : d.biome === 'urban' ? 0.7
                : 0.7;
  lc.fillStyle = `rgba(2,0,8,${ambient})`;
  lc.fillRect(0, 0, w, h);

  // additive mode — lights cut into darkness
  lc.globalCompositeOperation = 'destination-out';

  // player light
  if (player) {
    const px = player.x - cam.x, py = player.y - cam.y;
    drawRadialLight(lc, px, py, 220, '#a06bff', 0.85);
  }

  // torches
  for (const p of d.props) {
    if (p.type !== 'torch') continue;
    const px = p.x - cam.x, py = p.y - cam.y;
    if (px < -100 || py < -100 || px > w + 100 || py > h + 100) continue;
    const flick = 1 + Math.sin(t * 8 + p.x) * 0.08;
    drawRadialLight(lc, px, py - 4, 160 * flick, '#ffae5b', 0.9);
  }
  // exit portal light
  if (!d.isBossFloor || d.boss?.dead) {
    drawRadialLight(lc, d.exitX - cam.x, d.exitY - cam.y, 180, '#a06bff', 0.7);
  }
  // extra lights (boss aura, projectiles, etc.)
  for (const e of extras) drawRadialLight(lc, e.x - cam.x, e.y - cam.y, e.r, e.color, e.intensity);

  lc.globalCompositeOperation = 'source-over';
  // composite onto main: multiply darkness over scene
  ctx.drawImage(buf, 0, 0);
}

// solid check (for collision)
export function isSolid(d, x, y) {
  const ts = d.tileSize;
  const tx = Math.floor(x / ts), ty = Math.floor(y / ts);
  if (tx < 0 || ty < 0 || tx >= d.w || ty >= d.h) return true;
  return d.grid[ty][tx] === 0;
}

// archetype selection per pack theme + floor unlocks
function pickArchetype(theme, floor) {
  // base availability — more variety as floors deepen
  const pool = ['grunt', 'grunt'];
  if (floor >= 1) pool.push('ranged');
  if (floor >= 1) pool.push('swarm', 'swarm');
  if (floor >= 2) pool.push('brute');
  if (floor >= 2) pool.push('assassin');
  if (floor >= 3) pool.push('caster');
  if (floor >= 3) pool.push('tank');
  if (floor >= 4) pool.push('summoner');
  if (floor >= 4) pool.push('phantom');

  switch (theme) {
    case 'swarm':    return chance(0.7) ? 'swarm' : 'grunt';
    case 'sentry':   return chance(0.55) ? 'ranged' : (chance(0.5) ? 'caster' : 'grunt');
    case 'ambush':   return chance(0.5)  ? 'assassin' : (chance(0.5) ? 'phantom' : 'grunt');
    case 'choir':    return chance(0.45) ? 'caster' : (chance(0.5) ? 'summoner' : 'ranged');
    case 'garrison': return chance(0.4)  ? 'tank' : (chance(0.5) ? 'brute' : 'grunt');
    default:         return choice(pool);
  }
}

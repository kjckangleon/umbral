// === Game state, scenes, world, combat resolution ===================
import { Player, Enemy, Shadow, Projectile } from './entities.js';
import { generateDungeon, drawDungeon, drawLighting, isSolid } from './dungeon.js';
import { GATES, SKILLS, rollItem } from './data.js';
import { LORE, SYS_VOICE, ZONE_NAMES } from './lore.js';
import { TAU, dist, angle, clamp, choice, chance, bus, rand } from './util.js';
import { sfx, startMusic, stopMusic } from './audio.js';
import { showAbyss, showAbyssLines, floatNumber, updateHUD, setZoneText, flashDamage, flashLevel, cinematic, openMenu, closeMenu, isMenuOpen, bindMenu } from './ui.js';
import { key, pressedKey, mouse, endFrame, touch } from './input.js';
import { addBloodDecal, tickDecals, updateAmbient, drawAmbient, postFX } from './gfx.js';

const WIDTH = 1280, HEIGHT = 720;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = 'hub'; // hub | dungeon
    this.cam = { x: 0, y: 0, shake: 0, shakeT: 0 };
    this.t = 0;
    this.world = null;
    this.player = new Player(0, 0);
    this.particles = [];
    this.quests = [];
    this.combatT = 0;
    this.transition = 0;
    this.gameOver = false;
    this.currentGate = null;

    bindMenu({ enterGate: id => this.enterGate(id) });
    bus.on('levelup', lv => this.onLevelUp(lv));
    bus.on('enemyDied', (e, src) => this.onEnemyDied(e, src));
    bus.on('bossPhase', (b, ph) => this.onBossPhase(b, ph));
    bus.on('enemyExplode', e => this.onEnemyExplode(e));
    bus.on('phantomBlink', e => this.spawnHitParticles(e.x, e.y, '#7af5ff'));

    this.initHub();
    this.initIntro();

    // Resize handling
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      // canvas internal stays 1280x720
    };
    addEventListener('resize', fit);
  }

  initIntro() {
    setTimeout(() => {
      cinematic('YEAR 0021 — POST CONVERGENCE', 3200);
      setTimeout(() => cinematic('THE QUIET CITY', 3000), 3400);
      setTimeout(() => showAbyssLines(SYS_VOICE.intro), 6800);
      setTimeout(() => {
        showAbyss('FIRST DIRECTIVE', 'Enter a Veil. Survive. Begin to remember what you were not allowed to be.', 'OPEN MENU [TAB] · SELECT GATES', 'gold');
        this.quests.push({ id: 'q1', title: 'I — FIRST DESCENT', kind: 'boss', desc: 'Clear the Cracked Alley Gate. Defeat its Tatter-Lord.', target: 1, progress: 0, done: false });
      }, 9000);
    }, 200);
  }

  initHub() {
    // Hub: a small open space (no walls).
    const ts = 64, w = 30, h = 22;
    const grid = Array.from({ length: h }, () => Array(w).fill(1));
    for (let x = 0; x < w; x++) { grid[0][x] = 0; grid[h - 1][x] = 0; }
    for (let y = 0; y < h; y++) { grid[y][0] = 0; grid[y][w - 1] = 0; }
    this.world = {
      grid, w, h, tileSize: ts, rooms: [{ x:1, y:1, w: w-2, h: h-2, cx:w>>1, cy:h>>1 }],
      enemies: [], shadows: [], projectiles: [], particles: [], props: [],
      startX: (w >> 1) * ts, startY: (h >> 1) * ts,
      exitX: -9999, exitY: -9999,
      biome: 'urban', floor: 0, isBossFloor: false,
      isHub: true,
      player: this.player,
      spawnProjectile: (o) => this.world.projectiles.push(new Projectile(o)),
      dealHit: (target, src, dmg, opts) => this.dealHit(target, src, dmg, opts),
      combatT: 0
    };
    // hub atmospheric props
    for (let i = 0; i < 30; i++) {
      this.world.props.push({
        x: rand(60, (w - 1) * ts - 60),
        y: rand(60, (h - 1) * ts - 60),
        type: choice(['rune','torch','sigil','rubble'])
      });
    }
    // training dummy — invulnerable, regenerates
    const dummy = new Enemy(this.world.startX + 200, this.world.startY, 1, 'grunt', 'normal');
    dummy.name = 'TRAINING DUMMY';
    dummy.hpMax = 99999; dummy.hp = 99999;
    dummy.update = (dt) => {
      dummy.applyPhysics(dt);
      // continuous regen so it never dies
      dummy.hp = Math.min(dummy.hpMax, dummy.hp + 5000 * dt);
      dummy.dead = false;
    };
    this.world.enemies.push(dummy);
    this.player.x = this.world.startX;
    this.player.y = this.world.startY;
    setZoneText(ZONE_NAMES[0]);
  }

  enterGate(id) {
    const gate = GATES.find(g => g.id === id);
    if (!gate || this.player.level < gate.minLv) { sfx.warn(); return; }
    this.currentGate = gate;
    this.currentFloor = 1;
    closeMenu();
    cinematic(`GATE OPENING — ${gate.name}`, 2400);
    setTimeout(() => this.loadDungeon(gate, 1), 2000);
  }

  loadDungeon(gate, floor) {
    const d = generateDungeon(gate, floor);
    this.world = {
      ...d,
      shadows: [], projectiles: [], particles: [],
      player: this.player,
      isHub: false,
      gateRef: gate,
      spawnProjectile: (o) => this.world.projectiles.push(new Projectile(o)),
      dealHit: (target, src, dmg, opts) => this.dealHit(target, src, dmg, opts),
      combatT: 0
    };
    // re-summon shadow legion (keep up to maxActive)
    for (const s of this.player.shadowPool.slice(0, this.player.maxActive)) {
      const sh = new Shadow(d.startX + rand(-30, 30), d.startY + rand(-30, 30), s);
      sh.summonId = s.summonId;
      this.world.shadows.push(sh);
    }
    this.player.x = d.startX; this.player.y = d.startY;
    setZoneText(`${gate.zone} · FLOOR ${floor}`);
    startMusic(d.isBossFloor ? 'boss' : 'dungeon');
    if (d.isBossFloor) {
      setTimeout(() => {
        showAbyss('SOMETHING LARGE BREATHES NEARBY', `<i>${gate.boss}</i> waits at the floor's heart.`, '', 'warn');
      }, 1200);
    }
  }

  returnToHub() {
    cinematic('RETURNING TO THE QUIET CITY', 1800);
    setTimeout(() => {
      this.initHub();
      startMusic('hub');
      showAbyss('ABYSS INTERFACE', SYS_VOICE.hubReturn[0], '', '');
    }, 1600);
  }

  // === Combat resolution ===
  dealHit(target, src, dmg, opts = {}) {
    if (!target || target.dead) return;
    if (target === this.player && this.player.iframes > 0) {
      floatNumber(this.player.x, this.player.y - 30, 'PHASED', 'miss', this.cam);
      return;
    }
    // parry
    if (target === this.player && this.player.parryWindow > 0 && opts.parryable !== false) {
      this.player.parryWindow = 0;
      this.player.iframes = 0.5;
      sfx.parry(); this.shake(8);
      // riposte
      if (src && src.hurt) src.hurt(dmg * 2.5, this.player, { knock: 360, stagger: 0.6 });
      floatNumber(this.player.x, this.player.y - 30, 'PARRY', 'crit', this.cam);
      return;
    }
    // crit
    let final = dmg;
    let crit = false;
    if (src && src.team === 'player' && Math.random() < (this.player.crit ?? 0)) { final *= 2; crit = true; }
    final = Math.max(1, Math.round(final));
    if (this.player.domainT > 0 && src && src.team !== 'enemy') final = Math.round(final * 1.5);

    const hit = target.hurt(final, src, opts);
    if (!hit) return;
    floatNumber(target.x, target.y - target.r - 4, final, target === this.player ? '' : (crit ? 'crit' : ''), this.cam);
    if (target === this.player) {
      sfx.hurt(); flashDamage(); this.shake(6);
      this.world.combatT = 4;
      this.hitFlash = 1;
    } else {
      crit ? sfx.crit() : sfx.hit();
      this.spawnHitParticles(target.x, target.y, crit ? '#ff3b6b' : '#a06bff');
      this.shake(crit ? 6 : 2);
      // lifesteal
      if (src === this.player && this.player.lifesteal > 0) {
        const heal = Math.round(final * this.player.lifesteal);
        this.player.hp = Math.min(this.player.hpMax, this.player.hp + heal);
        if (heal > 0) floatNumber(this.player.x, this.player.y - 28, '+' + heal, 'heal', this.cam);
      }
      this.world.combatT = 4;
    }
  }

  onEnemyDied(e, src) {
    if (e === src) return;
    if (this.world.isHub) return;
    // blood decal
    addBloodDecal(e.x, e.y, e.tier === 'boss' ? 2.4 : e.tier === 'elite' ? 1.4 : 1);
    this.player.gainXp(e.xp ?? 0);
    this.player.gold += e.gold ?? 0;
    this.player.kills++;
    floatNumber(e.x, e.y - 30, `+${e.xp} XP`, 'shadow', this.cam);
    // loot drop
    if (chance(0.18 + this.player.stats.luck * 0.01) || e.tier !== 'normal') {
      const it = rollItem(e.level, e.tier === 'boss' ? 'legendary' : e.tier === 'elite' ? 'rare' : null);
      this.player.inventory.push(it);
      floatNumber(e.x, e.y - 50, it.name, 'shadow', this.cam);
      sfx.pickup();
    }
    // quest update
    for (const q of this.quests) {
      if (q.done) continue;
      if (q.kind === 'kill') { q.progress++; if (q.progress >= q.target) { q.done = true; this.questComplete(q); } }
    }
    // boss?
    if (e.tier === 'boss') {
      this.onBossKilled(e);
    }
  }

  onBossKilled(e) {
    setTimeout(() => {
      cinematic(`${e.name.toUpperCase()} :: SILENCED`, 2800);
      showAbyssLines(SYS_VOICE.bossDown, 'gold');
      // guaranteed legendary item
      const it = rollItem(e.level, 'legendary');
      this.player.inventory.push(it);
      // big xp
      this.player.gainXp(150);
      // quest progress
      for (const q of this.quests) {
        if (q.kind === 'boss' && !q.done) { q.progress = q.target; q.done = true; this.questComplete(q); }
      }
      // first quest
      const q1 = this.quests.find(q => q.id === 'q1');
      if (q1 && !q1.done) { q1.progress = q1.target; q1.done = true; this.questComplete(q1); }
    }, 800);
  }

  onBossPhase(b, ph) {
    cinematic(`PHASE ${ph} — THE MASK FALLS`, 1500);
    sfx.warn();
    this.shake(20);
    if (ph >= 3) { b.enraged = true; }
    // phase shockwave
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      this.world.projectiles.push(new Projectile({ x: b.x, y: b.y, ang: a, speed: 240, dmg: b.atk * 0.6, team: 'enemy', color: '#ff3b6b', life: 1.4 }));
    }
  }

  onEnemyExplode(e) {
    // unstable elites detonate — radial damage + visual
    sfx.bossHit();
    this.shake(14);
    this.spawnHitParticles(e.x, e.y, '#ffd860');
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      this.world.projectiles.push(new Projectile({ x: e.x, y: e.y, ang: a, speed: 320, dmg: e.atk * 0.9, team: 'enemy', color: '#ffd860', life: 1.0 }));
    }
    const p = this.player;
    if (dist(e.x, e.y, p.x, p.y) < 130) this.dealHit(p, e, e.atk * 1.4, { knock: 380 });
  }

  questComplete(q) {
    showAbyss('DIRECTIVE COMPLETE', q.title, q.reward ?? '+ memory restored', 'gold');
    sfx.levelup();
    if (q.id === 'q1') {
      // story trigger
      setTimeout(() => {
        showAbyssLines([
          'They came for your corpse. They will not get one.',
          'House Vehrenmoor is watching. So is the Crimson Ledger.',
          'Take the next gate. The Veils grow louder around you.'
        ]);
        this.quests.push({
          id: 'q2', title: 'II — THE LEDGER\'S OFFER', kind: 'boss',
          desc: 'Clear a D-rank Veil. The Ledger pays well for unlogged shards.',
          target: 1, progress: 0, done: false
        });
      }, 4500);
    }
  }

  onLevelUp(lv) {
    flashLevel(); sfx.levelup();
    showAbyssLines([...SYS_VOICE.levelUp, `LEVEL ${lv} ATTAINED — +5 STAT POINTS · +1 SKILL POINT`]);
    // unlock skills by level
    for (const sk of Object.values(SKILLS)) {
      if (sk.unlockLv && lv >= sk.unlockLv && !sk.unlocked) {
        sk.unlocked = true;
        showAbyss('NEW POWER OFFERED', `${sk.name}<br/><span style="color:var(--dim);font-size:11px">${sk.desc}</span>`, 'Open SKILLS panel to equip', 'gold');
      }
    }
    if (lv === 4) showAbyss('NEW SKILL', 'CROWN OF RAVENS available — visit SKILLS panel.', '', 'gold');
    if (lv === 6) showAbyss('NEW SKILL', 'GRAVE SPIKE available — visit SKILLS panel.', '', 'gold');
    if (lv === 8) showAbyss('FORBIDDEN POWER', 'BE THRONED [R] available. The Abyss has decided you are large enough.', '', 'warn');
  }

  // === Skill execution ===
  castSkill(slot) {
    const id = this.player.skillBar[slot];
    if (!id) return;
    const sk = SKILLS[id];
    const p = this.player;
    if ((p.cooldowns[id] ?? 0) > 0) return;
    if (p.mp < sk.cost) { sfx.warn(); floatNumber(p.x, p.y - 40, 'NO MANA', 'miss', this.cam); return; }
    p.mp -= sk.cost;
    p.cooldowns[id] = sk.cd;

    const a = angle(p.x, p.y, mouse.x + this.cam.x, mouse.y + this.cam.y);
    p.facing = a;

    if (sk.type === 'projectile') {
      if (sk.id === 'spike') {
        // ground eruption at cursor
        const tx = mouse.x + this.cam.x, ty = mouse.y + this.cam.y;
        setTimeout(() => {
          for (const e of this.world.enemies) {
            if (e.dead) continue;
            if (dist(tx, ty, e.x, e.y) < sk.base.radius) this.dealHit(e, p, p.spellPower + sk.base.dmg, { knock: 280 });
          }
          this.spawnSpikeFx(tx, ty, sk.base.radius);
          this.shake(12);
          sfx.cast();
        }, 320);
        // telegraph
        this.particles.push({ kind: 'tele', x: tx, y: ty, r: sk.base.radius, life: 0.32, max: 0.32 });
      } else {
        const dmg = p.spellPower + sk.base.dmg;
        this.world.projectiles.push(new Projectile({ x: p.x, y: p.y, ang: a, speed: sk.base.speed * 60, dmg, team: 'player', color: '#a06bff', life: 1.4, pierce: sk.base.pierce ?? 0, owner: p }));
        sfx.cast();
      }
    } else if (sk.type === 'melee') {
      this.meleeArc(p, sk.base.range, sk.base.arc, p.atk + sk.base.dmg, a, true);
      sfx.swing();
      this.shake(6);
    } else if (sk.type === 'aoe') {
      this.particles.push({ kind: 'ravens', x: 0, y: 0, follow: p, life: sk.base.dur, max: sk.base.dur, dmg: p.spellPower + sk.base.dmg, radius: sk.base.radius, tick: 0 });
      sfx.cast();
    } else if (sk.type === 'extract') {
      this.tryExtract();
    } else if (sk.type === 'ult') {
      p.domainT = sk.base.dur;
      // summon all shadows up to max
      const need = p.maxActive - this.world.shadows.filter(s => !s.dead).length;
      for (let i = 0; i < need && i < p.shadowPool.length; i++) {
        const s = p.shadowPool[i];
        if (this.world.shadows.find(sh => sh.summonId === s.summonId && !sh.dead)) continue;
        const sh = new Shadow(p.x + Math.cos(i / need * TAU) * 50, p.y + Math.sin(i / need * TAU) * 50, s);
        sh.summonId = s.summonId;
        this.world.shadows.push(sh);
      }
      // stagger nearby enemies
      for (const e of this.world.enemies) {
        if (e.dead) continue;
        if (dist(p.x, p.y, e.x, e.y) < 380) e.staggerT = 1.2;
      }
      sfx.shadow(); this.shake(24);
      cinematic('BE THRONED.', 2400);
      showAbyss('SOVEREIGN STATE ENGAGED', '', '', 'warn');
    }
  }

  meleeArc(actor, range, arc, dmg, ang, fromPlayer) {
    const targets = fromPlayer ? this.world.enemies : [];
    for (const e of targets) {
      if (e.dead) continue;
      const d = dist(actor.x, actor.y, e.x, e.y);
      if (d > range + e.r) continue;
      const a = angle(actor.x, actor.y, e.x, e.y);
      let da = Math.abs(a - ang);
      while (da > Math.PI) da = TAU - da;
      if (da < arc / 2) this.dealHit(e, actor, dmg, { knock: 300, stagger: 0.25 });
    }
    // visual
    this.particles.push({ kind: 'arc', x: actor.x, y: actor.y, ang, range, arc, life: 0.18, max: 0.18 });
  }

  tryExtract() {
    const p = this.player;
    const RADIUS = 240;
    // find every unextracted corpse within radius
    const corpses = this.world.enemies.filter(e => e.dead && !e.extracted && dist(p.x, p.y, e.x, e.y) < RADIUS);
    if (corpses.length === 0) {
      sfx.warn();
      floatNumber(p.x, p.y - 40, 'NO CORPSES', 'miss', this.cam);
      return;
    }

    // AOE ring fx
    this.particles.push({ kind: 'arc', x: p.x, y: p.y, ang: 0, range: RADIUS, arc: TAU, life: 0.5, max: 0.5 });
    sfx.extract();
    this.shake(12);

    let raised = 0, escaped = 0;
    for (const target of corpses) {
      target.extracted = true;
      const successP = clamp(
        p.shadowAffinity + (target.tier === 'boss' ? -0.3 : target.tier === 'elite' ? -0.05 : 0.15),
        0.1, 0.95
      );
      this.spawnExtractFx(target.x, target.y);
      if (Math.random() < successP) {
        const sh = Shadow.fromEnemy(target);
        sh.summonId = sh.id;
        const dormant = {
          summonId: sh.summonId, name: sh.name, glyph: sh.glyph,
          sourceType: target.type, tierSrc: target.tier, level: target.level,
          commander: target.tier !== 'normal',
          hpMax: sh.hpMax, atk: sh.atk, r: target.r
        };
        p.shadowPool.push(dormant);
        // active up to maxActive
        if (this.world.shadows.filter(s => !s.dead).length < p.maxActive) {
          sh.x = target.x; sh.y = target.y;
          this.world.shadows.push(sh);
        }
        p.shadowsExtracted++;
        raised++;
        floatNumber(target.x, target.y - 30, 'ARISE', 'shadow', this.cam);
      } else {
        escaped++;
        floatNumber(target.x, target.y - 30, 'ESCAPED', 'miss', this.cam);
      }
    }

    // summary popup when multiple corpses involved
    if (corpses.length > 1) {
      showAbyss('ABYSS INTERFACE', `${raised} risen · ${escaped} escaped`, '', raised ? 'gold' : '');
    }
    if (p.shadowsExtracted >= 1 && raised > 0 && p.shadowsExtracted === raised) {
      // first ever extract
      showAbyssLines(SYS_VOICE.firstExtract, 'gold');
    }
  }

  // === Particles ===
  spawnHitParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        kind: 'spark', x, y,
        vx: rand(-1, 1) * 200, vy: rand(-1, 1) * 200,
        life: 0.4, max: 0.4, color
      });
    }
  }
  spawnExtractFx(x, y) {
    for (let i = 0; i < 24; i++) {
      const a = rand(0, TAU);
      this.particles.push({
        kind: 'extract', x: x + Math.cos(a) * 80, y: y + Math.sin(a) * 80,
        vx: -Math.cos(a) * 200, vy: -Math.sin(a) * 200,
        life: 0.7, max: 0.7
      });
    }
  }
  spawnSpikeFx(x, y, r) {
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU);
      this.particles.push({
        kind: 'spike', x: x + Math.cos(a) * rand(0, r * 0.4), y: y + Math.sin(a) * rand(0, r * 0.4),
        vx: 0, vy: -rand(200, 600),
        life: 0.5, max: 0.5
      });
    }
  }

  shake(amt) { this.cam.shake = Math.max(this.cam.shake, amt); this.cam.shakeT = 0.3; }

  // === Movement collision ===
  moveEntity(e, dt) {
    const d = this.world;
    const oldX = e.x, oldY = e.y;
    e.applyPhysics(dt);
    if (isSolid(d, e.x, e.y)) {
      if (!isSolid(d, oldX, e.y)) e.x = oldX;
      else if (!isSolid(d, e.x, oldY)) e.y = oldY;
      else { e.x = oldX; e.y = oldY; }
    }
  }

  // === Update ===
  update(dt) {
    if (this.gameOver) return;
    this.t += dt;
    if (isMenuOpen()) { dt = 0; }

    const p = this.player;
    const w = this.world;
    w.combatT = Math.max(0, (w.combatT ?? 0) - dt);

    // input — open menu
    if (pressedKey('tab') || pressedKey('escape') || pressedKey('m')) {
      if (isMenuOpen()) closeMenu(); else openMenu(p, this);
    }

    if (!isMenuOpen() && !p.dead) {
      // movement (keyboard or virtual joystick)
      let mx = 0, my = 0;
      if (key('w') || key('arrowup')) my -= 1;
      if (key('s') || key('arrowdown')) my += 1;
      if (key('a') || key('arrowleft')) mx -= 1;
      if (key('d') || key('arrowright')) mx += 1;
      if (touch.move.active) {
        // analog stick has priority and supports variable magnitude
        mx = touch.move.x; my = touch.move.y;
      } else {
        const len = Math.hypot(mx, my);
        if (len) { mx /= len; my /= len; }
      }
      // clamp magnitude to 1
      const ml = Math.hypot(mx, my);
      if (ml > 1) { mx /= ml; my /= ml; }
      p.vx = mx * p.spd;
      p.vy = my * p.spd;
      // facing — priority: touch aim stick > recent mouse motion > WASD direction
      const usingKeyboard = (performance.now() - (mouse.lastMoved || 0)) > 1500;
      if (touch.aim.active && (Math.abs(touch.aim.x) + Math.abs(touch.aim.y) > 0.15)) {
        p.facing = Math.atan2(touch.aim.y, touch.aim.x);
      } else if (usingKeyboard && (mx || my)) {
        // keyboard-only: face the direction WASD is pointing
        p.facing = Math.atan2(my, mx);
      } else if (usingKeyboard) {
        // keep last facing — don't snap to mouse if it's idle
      } else {
        p.facing = angle(p.x, p.y, mouse.x + this.cam.x, mouse.y + this.cam.y);
      }

      // basic attack — left mouse OR K/J keys
      const attackHeld = mouse.down || key('k') || key('j');
      if (attackHeld && p.attackCd <= 0 && p.staggerT <= 0) {
        p.attackCd = 0.32;
        p.combo = (p.combo + 1) % 4;
        p.comboT = 1.2;
        const sk = SKILLS.slash;
        const dmg = p.atk + (p.combo === 3 ? p.atk * 0.5 : 0);
        this.meleeArc(p, sk.base.range + p.combo * 6, sk.base.arc, dmg, p.facing, true);
        sfx.swing();
      }
      // dodge / dash — space, L, or right mouse
      if ((pressedKey(' ') || pressedKey('l') || mouse.rdown) && p.dashCd <= 0 && p.staggerT <= 0) {
        p.dashCd = 0.7;
        const sk = SKILLS.dash;
        p.vx = Math.cos(p.facing) * sk.base.dist * 5;
        p.vy = Math.sin(p.facing) * sk.base.dist * 5;
        p.iframes = sk.base.iframes;
        p.parryWindow = 0.18;
        sfx.dodge();
      }
      // skills
      if (pressedKey('1')) this.castSkill(1);
      if (pressedKey('2')) this.castSkill(2);
      if (pressedKey('3')) this.castSkill(3);
      if (pressedKey('4')) this.castSkill(4);
      if (pressedKey('r')) this.castSkill('r');
      if (pressedKey('q')) this.tryExtract();
      // exit portal interact (approach to use)
      if (!w.isHub) {
        const canExit = !w.isBossFloor || (w.boss && w.boss.dead);
        if (canExit && dist(p.x, p.y, w.exitX, w.exitY) < 38) {
          if (pressedKey('e') || pressedKey('enter')) {
            if (this.currentGate.infinite) {
              // tower: next floor
              this.loadDungeon(this.currentGate, this.currentFloor + 1);
              this.currentFloor++;
            } else if (this.currentFloor < this.currentGate.floors) {
              this.loadDungeon(this.currentGate, this.currentFloor + 1);
              this.currentFloor++;
            } else {
              // sealed
              this.returnToHub();
            }
          }
        }
      } else {
        // hub gate gestalt — press G to open menu to gates
        if (pressedKey('g')) openMenu(p, this);
      }
    }

    // update entities with collision-aware movement
    p.update(dt, w);
    this.moveEntity(p, 0); // already applied via update? Player.update calls applyPhysics
    // re-collide manually
    if (isSolid(w, p.x, p.y)) {
      // simple resolve: scan tiles around
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const nx = p.x + dx * 8, ny = p.y + dy * 8;
        if (!isSolid(w, nx, ny)) { p.x = nx; p.y = ny; break; }
      }
    }
    for (const e of w.enemies) { if (!e.dead) e.update(dt, w); }
    for (const s of w.shadows) { if (!s.dead) s.update(dt, w); }
    for (const pr of w.projectiles) pr.update(dt, w);
    w.projectiles = w.projectiles.filter(p => !p.dead);

    // particles (game world)
    for (const ptc of this.particles) {
      ptc.life -= dt;
      if (ptc.kind === 'spark' || ptc.kind === 'extract' || ptc.kind === 'spike') {
        ptc.x += ptc.vx * dt; ptc.y += ptc.vy * dt;
        ptc.vx *= 0.92; ptc.vy *= 0.92;
      } else if (ptc.kind === 'ravens') {
        if (ptc.follow) { ptc.x = ptc.follow.x; ptc.y = ptc.follow.y; }
        ptc.tick = (ptc.tick ?? 0) - dt;
        if (ptc.tick <= 0) {
          ptc.tick = 0.3;
          for (const e of w.enemies) {
            if (e.dead) continue;
            if (dist(ptc.x, ptc.y, e.x, e.y) < ptc.radius) this.dealHit(e, this.player, ptc.dmg, { knock: 100 });
          }
        }
      }
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // ambient dust + decals
    updateAmbient(dt, this.cam, WIDTH, HEIGHT);
    tickDecals(dt);
    this.hitFlash = Math.max(0, (this.hitFlash ?? 0) - dt * 3);

    // camera
    const tx = p.x - WIDTH / 2, ty = p.y - HEIGHT / 2;
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 6);
    this.cam.shakeT = Math.max(0, this.cam.shakeT - dt);
    if (this.cam.shakeT <= 0) this.cam.shake = 0;

    // death
    if (p.dead && !this.gameOver) {
      this.gameOver = true;
      sfx.death();
      stopMusic();
      setTimeout(() => {
        document.getElementById('death').classList.remove('hidden');
      }, 800);
    }

    // HUD
    updateHUD(p);
    endFrame();
  }

  // === Render ===
  draw() {
    const ctx = this.ctx;
    ctx.save();
    // shake
    if (this.cam.shake > 0) {
      ctx.translate(rand(-this.cam.shake, this.cam.shake), rand(-this.cam.shake, this.cam.shake));
    }
    // background gradient
    ctx.fillStyle = '#04040a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const cam = this.cam;
    const w = this.world;
    drawDungeon(ctx, w, cam, WIDTH, HEIGHT, this.t, this.player);

    // ambient dust / embers — biome-tinted
    drawAmbient(ctx, cam, w.biome === 'frost' ? '#9bdcff' : w.biome === 'ruin' ? '#f5c97b' : w.biome === 'crypt' ? '#ff3b6b' : '#a06bff');

    // particles (under)
    for (const p of this.particles) {
      const a = p.life / p.max;
      const x = p.x - cam.x, y = p.y - cam.y;
      if (p.kind === 'spark') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(x, y, 3 * a, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'extract') {
        ctx.fillStyle = '#a06bff';
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'spike') {
        ctx.fillStyle = '#ddd2b6';
        ctx.globalAlpha = a;
        ctx.fillRect(x - 2, y, 4, 60 * (1 - a));
        ctx.globalAlpha = 1;
      } else if (p.kind === 'tele') {
        ctx.strokeStyle = `rgba(255,59,107,${a})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, TAU); ctx.stroke();
      } else if (p.kind === 'arc') {
        ctx.strokeStyle = `rgba(160,107,255,${a * 0.9})`;
        ctx.lineWidth = 18 * a;
        ctx.beginPath();
        ctx.arc(x, y, p.range * 0.85, p.ang - p.arc / 2, p.ang + p.arc / 2);
        ctx.stroke();
      } else if (p.kind === 'ravens') {
        for (let i = 0; i < 6; i++) {
          const ang = (this.t * 4 + i * TAU / 6);
          const rx = x + Math.cos(ang) * p.radius;
          const ry = y + Math.sin(ang) * p.radius;
          ctx.fillStyle = '#1a0033';
          ctx.shadowColor = '#a06bff'; ctx.shadowBlur = 14;
          ctx.font = '20px serif';
          ctx.fillText('☽', rx, ry);
          ctx.shadowBlur = 0;
        }
      }
    }

    // entities sorted by y
    const ents = [this.player, ...w.enemies.filter(e => !e.dead), ...w.shadows.filter(s => !s.dead)];
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw(ctx, cam);

    // dead enemies (corpse glyph)
    for (const e of w.enemies) {
      if (!e.dead) continue;
      const x = e.x - cam.x, y = e.y - cam.y;
      ctx.globalAlpha = e.extracted ? 0.2 : 0.55;
      ctx.fillStyle = '#1a0011';
      ctx.beginPath(); ctx.ellipse(x, y, e.r * 1.1, e.r * 0.5, 0, 0, TAU); ctx.fill();
      if (!e.extracted) {
        // pulsing extract beacon
        const a = 0.4 + 0.3 * Math.sin(this.t * 4 + e.x);
        ctx.strokeStyle = `rgba(160,107,255,${a})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, e.r * 1.4, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // projectiles
    for (const pr of w.projectiles) pr.draw(ctx, cam);

    // === LIGHTING PASS ===
    // collect dynamic lights
    const lights = [];
    if (this.player.domainT > 0) lights.push({ x: this.player.x, y: this.player.y, r: 280, color: '#ff3b6b', intensity: 0.9 });
    for (const e of w.enemies) {
      if (e.dead) continue;
      if (e.tier === 'boss') lights.push({ x: e.x, y: e.y, r: 220, color: '#ff3b6b', intensity: 0.7 });
      else if (e.tier === 'elite') lights.push({ x: e.x, y: e.y, r: 110, color: e.element === 'fire' ? '#ff8a3a' : e.element === 'frost' ? '#7af5ff' : e.element === 'unstable' ? '#ffd860' : '#a06bff', intensity: 0.55 });
      if (e.statuses?.burn) lights.push({ x: e.x, y: e.y, r: 80, color: '#ff8a3a', intensity: 0.5 });
    }
    for (const pr of w.projectiles) lights.push({ x: pr.x, y: pr.y, r: 50, color: pr.color, intensity: 0.6 });
    for (const ptc of this.particles) {
      if (ptc.kind === 'ravens' && ptc.follow) lights.push({ x: ptc.follow.x, y: ptc.follow.y, r: 200, color: '#a06bff', intensity: 0.6 });
    }
    drawLighting(ctx, w, cam, WIDTH, HEIGHT, this.t, this.player, lights);

    // post-process: vignette, grain, chromatic aberration on hit
    postFX(ctx, WIDTH, HEIGHT, this.hitFlash ?? 0);

    // exit prompt
    if (!w.isHub) {
      const canExit = !w.isBossFloor || (w.boss && w.boss.dead);
      if (canExit) {
        const d = dist(this.player.x, this.player.y, w.exitX, w.exitY);
        if (d < 100) {
          ctx.fillStyle = '#fff';
          ctx.font = '14px Rajdhani'; ctx.textAlign = 'center';
          ctx.shadowColor = '#a06bff'; ctx.shadowBlur = 10;
          ctx.fillText('[E] DESCEND', w.exitX - cam.x, w.exitY - cam.y - 50);
          ctx.shadowBlur = 0;
        }
      }
    }

    // hub training dummy hint
    if (w.isHub) {
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.font = '13px Rajdhani'; ctx.textAlign = 'center';
      ctx.fillText('WASD MOVE · MOUSE OR WASD AIM · LMB / K ATTACK · SPACE / L DODGE', WIDTH / 2, HEIGHT - 30);
      ctx.fillText('1-4 SKILLS · R ULT · TAB MENU · Q EXTRACT', WIDTH / 2, HEIGHT - 12);
    }

    ctx.restore();
  }

  reviveAtHub() {
    this.gameOver = false;
    this.player.dead = false;
    this.player.hp = this.player.hpMax;
    this.player.mp = this.player.mpMax;
    document.getElementById('death').classList.add('hidden');
    this.initHub();
    startMusic('hub');
    showAbyss('REFORGED', 'You have not died. The Abyss does not permit it.', '', 'gold');
  }
}

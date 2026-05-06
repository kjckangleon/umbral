// === Entities: Player, Enemies, Shadows, Projectiles ====================
import { TAU, rand, choice, clamp, dist, angle, hsl, chance, uid, bus } from './util.js';
import { sfx } from './audio.js';
import { ENEMY_NAMES } from './lore.js';
import { SKILLS, rollItem } from './data.js';
import { drawSovereign, drawCreature } from './gfx.js';

// === Base ===
class Entity {
  constructor(x, y) {
    this.id = uid();
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = 16;
    this.facing = 0;
    this.dead = false;
    this.hp = 1; this.hpMax = 1;
    this.team = 'neutral';
    this.flashT = 0;
    this.staggerT = 0;
    this.pushVx = 0; this.pushVy = 0;
    this.statuses = {}; // { burn: {dur, dmg, tick}, slow: {dur, mult}, bleed: {dur, dmg, tick} }
  }
  hurt(dmg, src, opts = {}) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.flashT = 0.12;
    this.staggerT = opts.stagger ?? 0.08;
    if (src) {
      const a = angle(src.x, src.y, this.x, this.y);
      const k = opts.knock ?? 200;
      this.pushVx += Math.cos(a) * k;
      this.pushVy += Math.sin(a) * k;
    }
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.onDie?.(src); }
    return true;
  }
  applyStatus(name, data) {
    const cur = this.statuses[name];
    if (!cur || (cur.dur ?? 0) < (data.dur ?? 0)) this.statuses[name] = { ...data, tick: 0 };
  }
  applyPhysics(dt) {
    // status tick
    for (const [k, st] of Object.entries(this.statuses)) {
      st.dur -= dt;
      if (st.dur <= 0) { delete this.statuses[k]; continue; }
      st.tick = (st.tick ?? 0) - dt;
      if ((k === 'burn' || k === 'bleed') && st.tick <= 0) {
        st.tick = 0.5;
        if (!this.dead) {
          this.hp -= st.dmg;
          this.flashT = Math.max(this.flashT, 0.05);
          if (this.hp <= 0) { this.hp = 0; this.dead = true; this.onDie?.(st.src); }
        }
      }
    }
    let mult = 1;
    if (this.statuses.slow) mult *= this.statuses.slow.mult;
    this.x += (this.vx * mult) * dt + this.pushVx * dt;
    this.y += (this.vy * mult) * dt + this.pushVy * dt;
    this.pushVx *= Math.pow(0.001, dt);
    this.pushVy *= Math.pow(0.001, dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.staggerT = Math.max(0, this.staggerT - dt);
  }
}

// =============================================================
// PLAYER
// =============================================================
export class Player extends Entity {
  constructor(x, y) {
    super(x, y);
    this.r = 18;
    this.team = 'player';
    this.name = 'VEILWALKER';
    this.level = 1; this.xp = 0; this.xpNext = 100;
    this.statPoints = 0; this.skillPoints = 0;
    this.stats = { str: 5, agi: 5, int: 5, vit: 5, per: 5, shadow: 5, mana: 5, luck: 5 };
    this.equipped = { weapon: null, armor: null, trinket: null };
    this.recompute();
    this.hp = this.hpMax; this.mp = this.mpMax;
    this.gold = 0;
    this.inventory = [];
    this.skillBar = { 1: 'cleave', 2: 'bolt', 3: null, 4: 'extract', r: null };
    this.unlocked = new Set(['slash', 'dash', 'cleave', 'bolt', 'extract']);
    this.cooldowns = {};
    this.attackCd = 0;
    this.dashCd = 0;
    this.iframes = 0;
    this.parryWindow = 0;
    this.combo = 0; this.comboT = 0;
    this.shadowPool = []; // dormant
    this.activeShadows = []; // summoned in field (refs)
    this.maxActive = 3;
    this.kills = 0;
    this.shadowsExtracted = 0;
    this.rank = 'E';
    this.questFlags = new Set();
    this.domainT = 0;
  }

  recompute() {
    const eq = this.equippedBonuses();
    this.hpMax = 80 + this.stats.vit * 14 + (eq.def ?? 0) * 4 + (eq.vit ?? 0) * 14;
    this.mpMax = 40 + this.stats.mana * 10 + (eq.magic ?? 0) * 3;
    this.atk = 8 + this.stats.str * 2.2 + (eq.atk ?? 0) + (eq.str ?? 0) * 2;
    this.spellPower = 6 + this.stats.int * 2.4 + (eq.magic ?? 0) + (eq.int ?? 0) * 2;
    this.spd = 220 + this.stats.agi * 6 + (eq.agi ?? 0) * 4;
    this.crit = 0.05 + this.stats.per * 0.012 + (eq.crit ?? 0) * 0.01;
    this.shadowAffinity = 0.10 + this.stats.shadow * 0.03 + (eq.shadow ?? 0) * 0.02;
    this.lifesteal = (eq.lifesteal ?? 0) * 0.01;
    this.maxActive = 2 + Math.floor(this.stats.shadow / 4);
    this.hp = Math.min(this.hp, this.hpMax);
    this.mp = Math.min(this.mp, this.mpMax);
    // rank derived from level
    const L = this.level;
    this.rank = L < 4 ? 'E' : L < 8 ? 'D' : L < 14 ? 'C' : L < 22 ? 'B' : L < 32 ? 'A' : L < 45 ? 'S' : L < 60 ? 'SS' : 'MONARCH';
  }

  equippedBonuses() {
    const tot = {};
    for (const slot of ['weapon', 'armor', 'trinket']) {
      const it = this.equipped[slot]; if (!it) continue;
      for (const [k, v] of Object.entries(it.base ?? {})) tot[k] = (tot[k] ?? 0) + v;
      for (const [k, v] of Object.entries(it.bonus ?? {})) tot[k] = (tot[k] ?? 0) + v;
    }
    return tot;
  }

  gainXp(n) {
    this.xp += n;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.statPoints += 5;
      this.skillPoints += 1;
      this.xpNext = Math.floor(100 * Math.pow(1.18, this.level - 1));
      bus.emit('levelup', this.level);
    }
    this.recompute();
  }

  spendStat(k) {
    if (this.statPoints <= 0) return false;
    this.stats[k]++; this.statPoints--; this.recompute(); return true;
  }

  update(dt, world) {
    if (this.dead) return;
    this.applyPhysics(dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.parryWindow = Math.max(0, this.parryWindow - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    this.domainT = Math.max(0, this.domainT - dt);
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);

    // mp regen
    this.mp = Math.min(this.mpMax, this.mp + (3 + this.stats.mana * 0.2) * dt);
    // hp regen out of combat
    if ((world.combatT ?? 0) <= 0) this.hp = Math.min(this.hpMax, this.hp + (1 + this.stats.vit * 0.15) * dt);

    // damp
    this.vx *= Math.pow(0.0001, dt);
    this.vy *= Math.pow(0.0001, dt);
  }

  draw(ctx, cam) {
    const x = this.x - cam.x, y = this.y - cam.y;
    const moving = Math.abs(this.vx) + Math.abs(this.vy) > 30;
    drawSovereign(ctx, x, y, this.facing, performance.now() / 1000, {
      moving, domain: this.domainT
    });
  }
}

// =============================================================
// ENEMY — 9 archetypes, telegraphed attacks, elemental affixes
// =============================================================

const ARCHETYPES = {
  grunt:    { glyph:'✦', shape:'circle',   r:16, spd:115, hpMul:1.0, atkMul:1.0, hue:[260,320], sat:30, lit:22 },
  ranged:   { glyph:'◆', shape:'diamond',  r:15, spd: 75, hpMul:0.85,atkMul:1.0, hue:[180,200], sat:55, lit:38 },
  brute:    { glyph:'■', shape:'block',    r:28, spd: 55, hpMul:2.2, atkMul:1.4, hue:[  0, 20], sat:40, lit:25 },
  assassin: { glyph:'▲', shape:'triangle', r:14, spd:175, hpMul:0.7, atkMul:1.3, hue:[290,330], sat:65, lit:30 },
  caster:   { glyph:'✶', shape:'star',     r:16, spd: 60, hpMul:0.9, atkMul:1.1, hue:[210,260], sat:60, lit:42 },
  swarm:    { glyph:'·', shape:'circle',   r:10, spd:155, hpMul:0.35,atkMul:0.6, hue:[330,360], sat:50, lit:35 },
  tank:     { glyph:'☗', shape:'block',    r:30, spd: 45, hpMul:3.0, atkMul:0.9, hue:[ 40, 60], sat:25, lit:30 },
  summoner: { glyph:'卐', shape:'star',    r:18, spd: 65, hpMul:1.2, atkMul:0.9, hue:[270,300], sat:55, lit:38 },
  phantom:  { glyph:'☽', shape:'circle',   r:16, spd:130, hpMul:0.9, atkMul:1.2, hue:[200,240], sat:30, lit:50 }
};

const ELEMENTS = {
  none:    { c:'#fff',   tag:'',         apply: null },
  fire:    { c:'#ff8a3a',tag:'INFERNAL', apply: t => t.applyStatus('burn',  { dur:3, dmg:2, src:null }) },
  frost:   { c:'#7af5ff',tag:'FROZEN',   apply: t => t.applyStatus('slow',  { dur:2.5, mult:0.55 }) },
  bleed:   { c:'#ff3b6b',tag:'BLEEDING', apply: t => t.applyStatus('bleed', { dur:4, dmg:3, src:null }) },
  void:    { c:'#a06bff',tag:'VOID-TOUCHED', apply: t => t.applyStatus('slow', { dur:1.5, mult:0.7 }) },
  unstable:{ c:'#ffd860',tag:'UNSTABLE', apply: null }   // explodes on death
};

export class Enemy extends Entity {
  constructor(x, y, level = 1, type = 'grunt', tier = 'normal') {
    super(x, y);
    this.team = 'enemy';
    this.level = level;
    this.type = type;
    this.tier = tier; // normal | elite | boss
    this.name = choice(ENEMY_NAMES[type] ?? ENEMY_NAMES.grunt);

    const a = ARCHETYPES[type] ?? ARCHETYPES.grunt;
    this.archetype = a;

    // tier scaling
    const tMul = tier === 'boss' ? 18 : tier === 'elite' ? 4.2 : 1;
    this.hpMax = Math.round((30 + level * 14) * a.hpMul * tMul);
    this.hp = this.hpMax;
    this.atk = Math.round((6 + level * 1.6) * a.atkMul * (tier === 'boss' ? 1.6 : tier === 'elite' ? 1.25 : 1));
    this.spd = a.spd * (tier === 'boss' ? 0.85 : 1);
    this.r = tier === 'boss' ? Math.max(34, a.r * 1.7) : a.r;

    this.xp = Math.round((20 + level * 8) * tMul);
    this.gold = Math.round(rand(2, 8) * level * tMul);

    this.color = hsl(rand(a.hue[0], a.hue[1]), a.sat, a.lit);
    this.glyph = a.glyph;
    if (tier === 'boss') { this.glyph = '☠'; this.color = hsl(0, 70, 30); }

    // elemental affix (elites & some bosses)
    if (tier === 'elite') {
      this.element = choice(['fire','frost','bleed','void','unstable']);
      this.name = `${ELEMENTS[this.element].tag} ${this.name}`;
    } else if (tier === 'boss') {
      this.element = choice(['fire','frost','void','bleed']);
    } else {
      this.element = chance(0.06) ? choice(['fire','frost','bleed']) : 'none';
    }

    // AI state
    this.state = 'idle';     // idle | chase | telegraph | strike | recover | retreat | cast
    this.stateT = 0;
    this.atkT = rand(0, 1.5); // initial cd jitter
    this.aiSeed = Math.random() * TAU;
    this.spawnT = 0;          // for swarm summoner
    this.phaseT = 0;          // phantom phase

    // boss phases
    this.phase = 1;
    this.phaseThresh = tier === 'boss' ? [0.66, 0.33] : [];
    this.enraged = false;

    // AI personality
    this.aggro = false;
    this.lostTargetT = 0;
  }

  onDie(src) {
    sfx.enemyDie();
    bus.emit('enemyDied', this, src);
    // unstable elites explode
    if (this.element === 'unstable') {
      bus.emit('enemyExplode', this);
    }
  }

  // helper to start a telegraphed attack
  beginTelegraph(world, kind, dur, payload) {
    this.state = 'telegraph';
    this.stateT = dur;
    this.tele = { kind, dur, max: dur, payload };
    bus.emit('telegraph', this, this.tele);
  }

  resolveTelegraph(world, target) {
    const t = this.tele;
    if (!t) return;
    if (t.kind === 'slam') {
      const dd = dist(this.x, this.y, target.x, target.y);
      if (dd < 100 + this.r) {
        world.dealHit(target, this, this.atk * 1.6, { knock: 420 });
        this.applyElemHit(target);
      }
      sfx.bossHit();
    } else if (t.kind === 'shotgun') {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = this.facing + (i - (n - 1) / 2) * 0.18;
        world.spawnProjectile({ x: this.x, y: this.y, ang: a, speed: 360, dmg: this.atk * 0.8, team:'enemy', color:'#ff7aa6', life:1.4 });
      }
    } else if (t.kind === 'aoe') {
      const tx = t.payload.x, ty = t.payload.y;
      const dd = dist(tx, ty, target.x, target.y);
      if (dd < t.payload.r) {
        world.dealHit(target, this, this.atk * 1.4, { knock: 240 });
        this.applyElemHit(target);
      }
    } else if (t.kind === 'lunge') {
      this.vx = Math.cos(this.facing) * 1200;
      this.vy = Math.sin(this.facing) * 1200;
      this.pushVx += this.vx; this.pushVy += this.vy;
      // damage handled in chase contact
      this.lungeT = 0.35;
    } else if (t.kind === 'volley') {
      const n = t.payload.n ?? 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + this.aiSeed;
        world.spawnProjectile({ x: this.x, y: this.y, ang: a, speed: 280, dmg: this.atk, team:'enemy', color:'#ff3b6b', life:1.6 });
      }
    } else if (t.kind === 'summon') {
      const cnt = t.payload.n ?? 3;
      for (let i = 0; i < cnt; i++) {
        const ang = (i / cnt) * TAU;
        const ex = this.x + Math.cos(ang) * 60, ey = this.y + Math.sin(ang) * 60;
        world.enemies.push(new Enemy(ex, ey, Math.max(1, this.level - 1), 'swarm', 'normal'));
      }
    }
    this.tele = null;
    this.state = 'recover';
    this.stateT = 0.45;
  }

  applyElemHit(target) {
    const e = ELEMENTS[this.element];
    if (e.apply) {
      const before = e.apply.toString();
      // bind src for DoT credit
      if (this.element === 'fire')   target.applyStatus('burn',  { dur:3, dmg: 2 + this.level * 0.4, src:this });
      else if (this.element === 'bleed') target.applyStatus('bleed', { dur:4, dmg: 3 + this.level * 0.5, src:this });
      else if (this.element === 'frost') target.applyStatus('slow', { dur:2.5, mult:0.55 });
      else if (this.element === 'void')  target.applyStatus('slow', { dur:1.5, mult:0.7 });
    }
  }

  update(dt, world) {
    if (this.dead) return;
    this.applyPhysics(dt);
    if (this.staggerT > 0) return;

    // boss phase change
    if (this.tier === 'boss' && this.phaseThresh.length) {
      const ratio = this.hp / this.hpMax;
      while (this.phaseThresh.length && ratio < this.phaseThresh[0]) {
        this.phaseThresh.shift();
        this.phase++;
        this.staggerT = 0.7;
        if (this.phase >= 3) this.enraged = true;
        bus.emit('bossPhase', this, this.phase);
      }
    }

    // pick target — player preferred but switches to nearby shadows
    const candidates = [world.player, ...world.shadows.filter(s => !s.dead)];
    let tgt = null, bd = Infinity;
    for (const c of candidates) {
      if (!c || c.dead) continue;
      const d = dist(this.x, this.y, c.x, c.y);
      const score = d * (c === world.player ? 0.85 : 1);
      if (score < bd) { bd = score; tgt = c; }
    }
    if (!tgt) { this.vx *= 0.9; this.vy *= 0.9; return; }
    const d = dist(this.x, this.y, tgt.x, tgt.y);
    this.facing = angle(this.x, this.y, tgt.x, tgt.y);
    this.atkT -= dt; this.stateT -= dt;
    this.phaseT -= dt;
    if (this.lungeT) this.lungeT -= dt;

    const rage = this.enraged ? 1.4 : 1;
    const inAggro = d < 520 || this.aggro;
    if (inAggro) this.aggro = true;

    // telegraph window: only damp movement
    if (this.state === 'telegraph') {
      this.vx *= 0.85; this.vy *= 0.85;
      if (this.stateT <= 0) this.resolveTelegraph(world, tgt);
      return this._afterMove(dt);
    }
    if (this.state === 'recover') {
      this.vx *= 0.6; this.vy *= 0.6;
      if (this.stateT <= 0) this.state = 'chase';
      return this._afterMove(dt);
    }

    // archetype behaviors -----------------------------------------
    switch (this.type) {
      case 'ranged':    this.aiRanged(world, tgt, d, rage); break;
      case 'brute':     this.aiBrute(world, tgt, d, rage); break;
      case 'assassin':  this.aiAssassin(world, tgt, d, rage); break;
      case 'caster':    this.aiCaster(world, tgt, d, rage); break;
      case 'swarm':     this.aiSwarm(world, tgt, d, rage); break;
      case 'tank':      this.aiTank(world, tgt, d, rage); break;
      case 'summoner':  this.aiSummoner(world, tgt, d, rage); break;
      case 'phantom':   this.aiPhantom(world, tgt, d, rage); break;
      default:          this.aiGrunt(world, tgt, d, rage); break;
    }

    // bosses augment with extra patterns
    if (this.tier === 'boss') this.aiBoss(world, tgt, d, rage);

    this._afterMove(dt);
  }

  _afterMove(dt) {
    this.vx *= Math.pow(0.001, dt);
    this.vy *= Math.pow(0.001, dt);
  }

  // === AI archetype implementations ===
  aiGrunt(world, tgt, d, rage) {
    this.vx = Math.cos(this.facing) * this.spd * rage;
    this.vy = Math.sin(this.facing) * this.spd * rage;
    if (d < this.r + tgt.r + 6 && this.atkT <= 0) {
      this.atkT = 0.9 / rage;
      world.dealHit(tgt, this, this.atk, { knock: 220 });
      this.applyElemHit(tgt);
    }
  }
  aiRanged(world, tgt, d, rage) {
    const want = 260;
    if (d > want + 30) { this.vx = Math.cos(this.facing) * this.spd * rage; this.vy = Math.sin(this.facing) * this.spd * rage; }
    else if (d < want - 50) { this.vx = -Math.cos(this.facing) * this.spd * 0.85; this.vy = -Math.sin(this.facing) * this.spd * 0.85; }
    else { // strafe
      this.vx = Math.cos(this.facing + Math.PI/2) * this.spd * 0.6 * Math.sin(this.aiSeed + performance.now()/600);
      this.vy = Math.sin(this.facing + Math.PI/2) * this.spd * 0.6 * Math.sin(this.aiSeed + performance.now()/600);
    }
    if (this.atkT <= 0 && d < 380) {
      this.atkT = 1.4 / rage;
      // shotgun every 3rd shot
      if (chance(0.3)) this.beginTelegraph(world, 'shotgun', 0.45);
      else world.spawnProjectile({ x:this.x, y:this.y, ang:this.facing, speed: 380, dmg:this.atk, team:'enemy', color:'#ff7aa6', life:1.5 });
    }
  }
  aiBrute(world, tgt, d, rage) {
    if (d > 110) {
      this.vx = Math.cos(this.facing) * this.spd * rage;
      this.vy = Math.sin(this.facing) * this.spd * rage;
    } else { this.vx *= 0.5; this.vy *= 0.5; }
    if (d < 130 && this.atkT <= 0) {
      this.atkT = 2.4 / rage;
      this.beginTelegraph(world, 'slam', 0.7);
    }
  }
  aiAssassin(world, tgt, d, rage) {
    // circle then lunge
    if (d > 220) {
      this.vx = Math.cos(this.facing) * this.spd * rage;
      this.vy = Math.sin(this.facing) * this.spd * rage;
    } else if (d > 90) {
      // strafe-circle
      const a = this.facing + Math.PI/2;
      this.vx = Math.cos(a) * this.spd * 0.9;
      this.vy = Math.sin(a) * this.spd * 0.9;
      if (this.atkT <= 0) { this.atkT = 2.0; this.beginTelegraph(world, 'lunge', 0.4); }
    } else {
      // close — quick swipe
      if (this.atkT <= 0) {
        this.atkT = 0.6;
        world.dealHit(tgt, this, this.atk, { knock:160 });
        this.applyElemHit(tgt);
      }
    }
    // contact damage during lunge
    if (this.lungeT > 0 && d < this.r + tgt.r + 8) {
      world.dealHit(tgt, this, this.atk * 0.8, { knock: 220 });
      this.applyElemHit(tgt);
      this.lungeT = 0;
    }
  }
  aiCaster(world, tgt, d, rage) {
    const want = 320;
    if (d < want - 60) {
      this.vx = -Math.cos(this.facing) * this.spd;
      this.vy = -Math.sin(this.facing) * this.spd;
    } else { this.vx *= 0.5; this.vy *= 0.5; }
    if (this.atkT <= 0 && d < 480) {
      this.atkT = 3.0 / rage;
      // ground AoE under target's predicted position
      const px = tgt.x + tgt.vx * 0.5;
      const py = tgt.y + tgt.vy * 0.5;
      this.beginTelegraph(world, 'aoe', 0.9, { x: px, y: py, r: 90 });
    }
  }
  aiSwarm(world, tgt, d, rage) {
    // wobble-chase
    const w = Math.sin(performance.now()/120 + this.aiSeed) * 0.6;
    const a = this.facing + w;
    this.vx = Math.cos(a) * this.spd * rage;
    this.vy = Math.sin(a) * this.spd * rage;
    if (d < this.r + tgt.r + 4 && this.atkT <= 0) {
      this.atkT = 0.6;
      world.dealHit(tgt, this, this.atk, { knock:120 });
      this.applyElemHit(tgt);
    }
  }
  aiTank(world, tgt, d, rage) {
    // very slow, swings wide cone
    if (d > 90) {
      this.vx = Math.cos(this.facing) * this.spd;
      this.vy = Math.sin(this.facing) * this.spd;
    }
    if (d < 110 && this.atkT <= 0) {
      this.atkT = 2.2;
      this.beginTelegraph(world, 'slam', 0.85);
    }
    // damage reduction (block)
    if (!this._guarded) {
      this._guarded = true;
      const origHurt = this.hurt.bind(this);
      this.hurt = (dmg, src, opts) => origHurt(dmg * 0.55, src, opts);
    }
  }
  aiSummoner(world, tgt, d, rage) {
    // keeps distance; spawns swarms; channels volleys
    if (d < 260) { this.vx = -Math.cos(this.facing) * this.spd; this.vy = -Math.sin(this.facing) * this.spd; }
    else { this.vx *= 0.5; this.vy *= 0.5; }
    this.spawnT -= 0.016;
    if (this.atkT <= 0) {
      this.atkT = 4.5 / rage;
      if (chance(0.55)) this.beginTelegraph(world, 'summon', 1.1, { n: 3 });
      else this.beginTelegraph(world, 'volley', 0.9, { n: 10 });
    }
  }
  aiPhantom(world, tgt, d, rage) {
    // periodically blinks intangible
    if (this.phaseT <= 0) {
      this._phased = !this._phased;
      this.phaseT = this._phased ? 0.9 : 2.0;
    }
    if (d > 180) {
      this.vx = Math.cos(this.facing) * this.spd * rage;
      this.vy = Math.sin(this.facing) * this.spd * rage;
    } else if (this._phased) {
      // teleport behind target
      if (this.atkT <= 0) {
        this.atkT = 2.6;
        const a = angle(tgt.x, tgt.y, this.x, this.y);
        this.x = tgt.x - Math.cos(a) * 40;
        this.y = tgt.y - Math.sin(a) * 40;
        bus.emit('phantomBlink', this);
        this.beginTelegraph(world, 'lunge', 0.25);
      }
    } else {
      if (d < this.r + tgt.r + 6 && this.atkT <= 0) {
        this.atkT = 0.8;
        world.dealHit(tgt, this, this.atk, { knock:200 });
        this.applyElemHit(tgt);
      }
    }
  }

  // bosses get layered patterns
  aiBoss(world, tgt, d, rage) {
    // periodically fires omnidirectional volleys — phase-gated
    if (this.atkT > 0.4) return;
    const r = Math.random();
    if (this.phase >= 2 && r < 0.04) {
      this.atkT = 3.6 / rage;
      this.beginTelegraph(world, 'volley', 1.0, { n: 12 });
    } else if (this.phase >= 3 && r < 0.05) {
      this.atkT = 5;
      this.beginTelegraph(world, 'summon', 1.3, { n: 4 });
    }
  }

  draw(ctx, cam) {
    const x = this.x - cam.x, y = this.y - cam.y;

    // intangible phantom — translucent
    const alpha = this._phased ? 0.4 : 1;
    ctx.globalAlpha = alpha;

    const elemC = ELEMENTS[this.element]?.c ?? '#fff';
    const t = performance.now() / 1000;
    if (!this._seed) this._seed = Math.random() * 1000;

    drawCreature(ctx, x, y, t, {
      kind: this.type,
      r: this.r,
      facing: this.facing,
      bodyColor: this.color,
      elemColor: this.element !== 'none' ? elemC : null,
      flash: this.flashT > 0,
      seed: this._seed,
      boss: this.tier === 'boss'
    });

    // status overlays
    if (this.statuses.burn) {
      for (let i = 0; i < 3; i++) {
        const ang = performance.now()/120 + i * TAU/3;
        const a = 0.5 + 0.3 * Math.sin(performance.now()/100 + i);
        ctx.fillStyle = `rgba(255,140,60,${a})`;
        ctx.shadowColor = '#ff8a3a'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x + Math.cos(ang)*this.r*0.7, y - this.r*0.8 + Math.sin(ang)*4, 3.5, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    if (this.statuses.bleed) {
      ctx.fillStyle = '#ff3b6b';
      ctx.fillRect(x - 2, y + this.r * 0.8 - 2, 4, 6);
      // drip
      ctx.fillRect(x - 0.5, y + this.r + Math.sin(performance.now()/200) * 3, 1.5, 4);
    }
    if (this.statuses.slow) {
      ctx.strokeStyle = 'rgba(122,245,255,.7)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, this.r + 5, 0, TAU); ctx.stroke();
      // ice shards
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5 + performance.now()/2000;
        ctx.fillStyle = '#7af5ff';
        ctx.shadowColor = '#7af5ff'; ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * (this.r + 5), y + Math.sin(a) * (this.r + 5));
        ctx.lineTo(x + Math.cos(a + 0.1) * (this.r + 9), y + Math.sin(a + 0.1) * (this.r + 9));
        ctx.lineTo(x + Math.cos(a - 0.1) * (this.r + 9), y + Math.sin(a - 0.1) * (this.r + 9));
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // telegraph indicator
    if (this.state === 'telegraph' && this.tele) {
      const p = 1 - (this.stateT / this.tele.max);
      const tk = this.tele.kind;
      const col = `rgba(255,59,107,${0.5 + 0.4*p})`;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2 + p * 4;
      ctx.shadowColor = '#ff3b6b'; ctx.shadowBlur = 12;
      if (tk === 'slam') {
        ctx.beginPath(); ctx.arc(x, y, 100 * (0.4 + p * 0.6), 0, TAU); ctx.stroke();
      } else if (tk === 'shotgun' || tk === 'lunge') {
        const a = this.facing;
        const w = tk === 'shotgun' ? 0.5 : 0.18;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, 220 * p, a - w, a + w);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,59,107,${0.18 + 0.2*p})`;
        ctx.fill(); ctx.stroke();
      } else if (tk === 'aoe') {
        const px = this.tele.payload.x - cam.x, py = this.tele.payload.y - cam.y;
        ctx.beginPath(); ctx.arc(px, py, this.tele.payload.r * (0.3 + p*0.7), 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(255,59,107,${0.15 * p})`; ctx.fill();
      } else if (tk === 'volley') {
        ctx.beginPath(); ctx.arc(x, y, 30 + p * 40, 0, TAU); ctx.stroke();
      } else if (tk === 'summon') {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * TAU + p * 4;
          const rr = 40 + Math.sin(p * 8 + i) * 10;
          const sx = x + Math.cos(ang) * rr, sy = y + Math.sin(ang) * rr;
          i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.closePath(); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // hp bar
    const w = this.r * 2.4;
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(x - w / 2 - 1, y - this.r - 13, w + 2, 5);
    const hpC = this.tier === 'boss' ? '#ff3b6b' : this.tier === 'elite' ? elemC : '#ff7aa6';
    ctx.fillStyle = hpC;
    ctx.fillRect(x - w / 2, y - this.r - 12, w * (this.hp / this.hpMax), 3);
    if (this.tier !== 'normal') {
      ctx.fillStyle = this.tier === 'boss' ? '#ff3b6b' : elemC;
      ctx.font = '10px Rajdhani'; ctx.textBaseline = 'bottom';
      ctx.shadowColor = hpC; ctx.shadowBlur = 8;
      ctx.fillText(this.name.toUpperCase(), x, y - this.r - 16);
      ctx.shadowBlur = 0;
    }
    if (this.enraged) {
      ctx.strokeStyle = `rgba(255,59,107,${0.4 + 0.3*Math.sin(performance.now()/100)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, this.r + 8 + Math.sin(performance.now()/120)*3, 0, TAU); ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}

// =============================================================
// SHADOW (extracted enemy, fights for player)
// =============================================================
export class Shadow extends Entity {
  constructor(x, y, sourceData) {
    super(x, y);
    this.team = 'shadow';
    this.r = sourceData.r;
    this.sourceType = sourceData.type;
    this.tierSrc = sourceData.tier;
    this.level = sourceData.level;
    this.rank = 'NORMAL';
    this.name = sourceData.name;
    this.glyph = sourceData.glyph;
    this.commander = sourceData.commander ?? false;

    const mult = this.commander ? 1.6 : (this.tierSrc === 'boss' ? 2 : this.tierSrc === 'elite' ? 1.3 : 1);
    this.hpMax = Math.round((40 + this.level * 12) * mult);
    this.hp = this.hpMax;
    this.atk = Math.round((8 + this.level * 1.4) * mult);
    this.spd = 180;
    this.atkCd = 0;
    this.summonId = sourceData.summonId ?? uid();
  }

  static fromEnemy(enemy) {
    return new Shadow(enemy.x, enemy.y, {
      type: enemy.type, tier: enemy.tier, level: enemy.level,
      name: enemy.name, glyph: enemy.glyph, r: enemy.r,
      commander: enemy.tier === 'boss' || enemy.tier === 'elite'
    });
  }

  onDie() { sfx.enemyDie(); }

  update(dt, world) {
    if (this.dead) return;
    this.applyPhysics(dt);
    this.atkCd = Math.max(0, this.atkCd - dt);

    const p = world.player;
    // find nearest enemy
    let tgt = null, bd = Infinity;
    for (const e of world.enemies) {
      if (e.dead) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < 360 && d < bd) { bd = d; tgt = e; }
    }
    if (tgt) {
      this.facing = angle(this.x, this.y, tgt.x, tgt.y);
      this.vx = Math.cos(this.facing) * this.spd;
      this.vy = Math.sin(this.facing) * this.spd;
      if (bd < this.r + tgt.r + 6 && this.atkCd <= 0) {
        this.atkCd = 0.7;
        world.dealHit(tgt, this, this.atk, { knock: 180 });
      }
    } else if (p) {
      // follow player loosely
      const d = dist(this.x, this.y, p.x, p.y);
      if (d > 120) {
        const a = angle(this.x, this.y, p.x, p.y);
        this.vx = Math.cos(a) * this.spd * 0.9;
        this.vy = Math.sin(a) * this.spd * 0.9;
      } else { this.vx *= 0.8; this.vy *= 0.8; }
    }
    this.vx *= Math.pow(0.001, dt);
    this.vy *= Math.pow(0.001, dt);
  }

  draw(ctx, cam) {
    const x = this.x - cam.x, y = this.y - cam.y;
    // shadow ground
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath(); ctx.ellipse(x, y + this.r * 0.7, this.r, this.r * 0.4, 0, 0, TAU); ctx.fill();
    // smoky body
    const grad = ctx.createRadialGradient(x, y, 0, x, y, this.r * 1.6);
    grad.addColorStop(0, this.commander ? 'rgba(245,201,123,.9)' : 'rgba(160,107,255,.85)');
    grad.addColorStop(0.6, 'rgba(40,20,80,.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, this.r * 1.4, 0, TAU); ctx.fill();
    // glyph
    ctx.fillStyle = this.commander ? '#fff5cc' : '#fff';
    ctx.shadowColor = this.commander ? '#f5c97b' : '#a06bff'; ctx.shadowBlur = 14;
    ctx.font = `${this.r * 1.3}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.glyph, x, y);
    ctx.shadowBlur = 0;
    // hp
    const w = this.r * 2;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(x - w / 2, y - this.r - 8, w, 3);
    ctx.fillStyle = this.commander ? '#f5c97b' : '#a06bff';
    ctx.fillRect(x - w / 2, y - this.r - 8, w * (this.hp / this.hpMax), 3);
  }
}

// =============================================================
// PROJECTILE
// =============================================================
export class Projectile {
  constructor({ x, y, ang, speed, dmg, team, color, life = 1, pierce = 0, owner }) {
    this.id = uid();
    this.x = x; this.y = y;
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;
    this.dmg = dmg; this.team = team;
    this.color = color || '#a06bff';
    this.life = life; this.r = 8;
    this.pierce = pierce; this.hits = new Set();
    this.dead = false; this.owner = owner;
    this.trail = [];
  }
  update(dt, world) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();
    this.x += this.vx * dt; this.y += this.vy * dt;
    // collisions
    const targets = this.team === 'player' ? world.enemies : [world.player, ...world.shadows];
    for (const t of targets) {
      if (!t || t.dead || this.hits.has(t.id)) continue;
      if (dist(this.x, this.y, t.x, t.y) < t.r + this.r) {
        world.dealHit(t, this.owner ?? { x: this.x - this.vx, y: this.y - this.vy }, this.dmg, { knock: 160 });
        this.hits.add(t.id);
        if (this.pierce-- <= 0) { this.dead = true; return; }
      }
    }
  }
  draw(ctx, cam) {
    const x = this.x - cam.x, y = this.y - cam.y;
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const a = i / this.trail.length;
      ctx.fillStyle = this.color.startsWith('#') ? this.color + Math.floor(a * 255).toString(16).padStart(2,'0') : this.color;
      ctx.globalAlpha = a * 0.6;
      ctx.beginPath(); ctx.arc(t.x - cam.x, t.y - cam.y, this.r * a, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(x, y, this.r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

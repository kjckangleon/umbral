// === Skills, items, gates definitions =================================
import { rand, choice } from './util.js';

export const SKILLS = {
  slash: {
    id: 'slash', name: 'UMBRAL SLASH', icon: '⚔', cost: 0, cd: 0.5, type: 'melee',
    desc: 'Basic shadow-edged strike. Scales with STR. Crit chance scales with PER.',
    base: { dmg: 14, range: 70, arc: 1.6 },
    unlocked: true, equippable: false
  },
  dash: {
    id: 'dash', name: 'PHANTOM DASH', icon: '➤', cost: 8, cd: 1.0, type: 'mobility',
    desc: 'Step through the Veil. I-frames. Distance scales with AGI.',
    base: { dist: 220, iframes: 0.35 },
    unlocked: true, equippable: false
  },
  cleave: {
    id: 'cleave', name: 'NIGHT CLEAVE', icon: '⚔', cost: 18, cd: 4, type: 'melee', slot: 1,
    desc: 'Wide arc of black flame. Hits all in front. Heavy stagger.',
    base: { dmg: 38, range: 110, arc: 2.4 },
    unlocked: true, equippable: true, level: 1
  },
  bolt: {
    id: 'bolt', name: 'VOID BOLT', icon: '✦', cost: 15, cd: 1.4, type: 'projectile', slot: 2,
    desc: 'Hurl a piercing shard of antilight. Scales with INT.',
    base: { dmg: 22, speed: 16, pierce: 2 },
    unlocked: true, equippable: true, level: 1
  },
  ravens: {
    id: 'ravens', name: 'CROWN OF RAVENS', icon: '☽', cost: 30, cd: 8, type: 'aoe', slot: 3,
    desc: 'A whirling diadem of shadow-birds. Damages all nearby for 3s.',
    base: { dmg: 8, radius: 180, dur: 3 },
    unlocked: false, unlockLv: 4, equippable: true, level: 1
  },
  extract: {
    id: 'extract', name: 'ARISE', icon: '☠', cost: 0, cd: 1.5, type: 'extract', slot: 4,
    desc: 'Aim at a slain enemy. Extract their Echo as a shadow under your command. Chance scales with SHADOW POWER.',
    base: {},
    unlocked: true, equippable: true, level: 1
  },
  domain: {
    id: 'domain', name: 'BE THRONED', icon: '◉', cost: 60, cd: 60, type: 'ult', slot: 'r',
    desc: 'Unfurl your sovereignty. All shadows summoned, all enemies stagger, you gain hyperarmor + 50% damage for 8s.',
    base: { dur: 8, bonus: 0.5 },
    unlocked: false, unlockLv: 8, equippable: true, level: 1
  },
  spike: {
    id: 'spike', name: 'GRAVE SPIKE', icon: '✦', cost: 22, cd: 3.5, type: 'projectile', slot: 2,
    desc: 'Erupt a column of bone from the ground at the cursor.',
    base: { dmg: 55, radius: 70 },
    unlocked: false, unlockLv: 6, equippable: true, level: 1
  }
};

export function listSkills() { return Object.values(SKILLS); }

export const RARITY = {
  common:    { c: '#aab', mult: 1.0,  name: 'COMMON' },
  uncommon:  { c: '#7af5ff', mult: 1.25, name: 'UNCOMMON' },
  rare:      { c: '#a06bff', mult: 1.6, name: 'RARE' },
  epic:      { c: '#ff8aff', mult: 2.0, name: 'EPIC' },
  legendary: { c: '#ffb86b', mult: 2.7, name: 'LEGENDARY' },
  monarch:   { c: '#ff3b6b', mult: 4.0, name: 'MONARCH' }
};

const PREFIX = ['Hollow', 'Pale', 'Veil-Carved', 'Bleeding', 'Shrouded', 'Sovereign\'s', 'Mournful', 'Whispering', 'Tarnished', 'Inverted', 'Choir-Sung'];
const NOUN = { weapon: ['Edge', 'Sliver', 'Fang', 'Reaver', 'Litany', 'Memory', 'Arbiter'],
               armor:  ['Mantle', 'Shroud', 'Carapace', 'Vestment', 'Reliquary'],
               trinket:['Sigil', 'Coin', 'Tear', 'Eye', 'Knot'] };

export function rollItem(level = 1, forceRarity) {
  const slots = ['weapon', 'armor', 'trinket'];
  const slot = choice(slots);
  const r = forceRarity || rollRarity(level);
  const rd = RARITY[r];
  const name = `${choice(PREFIX)} ${choice(NOUN[slot])}`;
  const base = slot === 'weapon' ? { atk: 4 + level * 2 } :
               slot === 'armor'  ? { def: 2 + level } :
               { magic: 2 + level };
  for (const k of Object.keys(base)) base[k] = Math.round(base[k] * rd.mult);
  // bonus stats
  const bonus = {};
  const possible = ['str','agi','int','vit','per','shadow','luck','crit','lifesteal'];
  const numBonus = ({common:0,uncommon:1,rare:2,epic:3,legendary:4,monarch:5})[r];
  for (let i = 0; i < numBonus; i++) {
    const k = choice(possible);
    bonus[k] = (bonus[k] || 0) + Math.ceil(rand(1, 4) * rd.mult);
  }
  return { id: Math.random().toString(36).slice(2), name, slot, rarity: r, base, bonus, level };
}

function rollRarity(lv) {
  const r = Math.random() * 1000;
  const lb = Math.min(60, lv * 2); // luck bonus to roll
  const x = r - lb;
  if (x < 4) return 'monarch';
  if (x < 24) return 'legendary';
  if (x < 80) return 'epic';
  if (x < 200) return 'rare';
  if (x < 450) return 'uncommon';
  return 'common';
}

// === Gates / dungeons ===
export const GATES = [
  { id: 'g1', rank: 'E', name: 'CRACKED ALLEY GATE',  zone: 'THE QUIET CITY',
    desc: 'A small Veil bleeding into a forgotten alley. Hollow strays gather here.',
    biome: 'urban', floors: 2, enemyLv: [1, 3], boss: 'Tatter-Lord Grevh', minLv: 1 },
  { id: 'g2', rank: 'D', name: 'WHISPERING STEEL VEIL', zone: 'STEEL VEIL',
    desc: 'Mirror-bladed corridors. Things that look like duelists lurk here.',
    biome: 'mirror', floors: 3, enemyLv: [3, 5], boss: 'Magistrate of Empty Verdicts', minLv: 3 },
  { id: 'g3', rank: 'C', name: 'HOLLOW MOUNTAIN PASS', zone: 'HOLLOW MOUNTAIN',
    desc: 'A frozen temple inside a gutted peak. The Blind Dragon Priest watches.',
    biome: 'frost', floors: 4, enemyLv: [5, 8], boss: 'Frostfang Inquisitor', minLv: 5 },
  { id: 'g4', rank: 'B', name: 'BURIED CITY UNDERSPIRE', zone: 'BURIED CITY',
    desc: 'A drowned megacity beneath the Pale Sea. The Titan walks here in pieces.',
    biome: 'ruin', floors: 5, enemyLv: [8, 12], boss: 'Warden of Twelve Chains', minLv: 8 },
  { id: 'g5', rank: 'A', name: 'BLACK HYMN CATHEDRAL', zone: 'BLACK HYMNS',
    desc: 'Light here is wrong. The Fallen Seraph still believes she is good.',
    biome: 'cathedral', floors: 6, enemyLv: [12, 16], boss: 'Fallen Seraph', minLv: 12 },
  { id: 'g6', rank: 'S', name: 'THE LONG FUNERAL', zone: 'LONG FUNERAL',
    desc: 'A procession that has not stopped in 600 years. The Corpse King hosts you.',
    biome: 'crypt', floors: 7, enemyLv: [16, 22], boss: 'The Corpse King', minLv: 16 },
  { id: 'g7', rank: 'SS', name: 'INVERTED TOWER', zone: 'INVERTED TOWER',
    desc: 'Endless. Each floor is a room you have already died in.',
    biome: 'tower', floors: 99, enemyLv: [20, 99], boss: 'The Coil', minLv: 22, infinite: true },
  { id: 'g8', rank: 'MONARCH', rankClass: 'monarch', name: 'THE LAST THRONE', zone: 'ABYSS REGISTRY',
    desc: 'The Abyss Interface has prepared a chair. Will you sit?',
    biome: 'void', floors: 1, enemyLv: [40, 60], boss: 'The Last Sovereign', minLv: 35 }
];

# UMBRAL — Sovereign of the Hollow Veil

A dark-fantasy action RPG inspired by the *progression, atmosphere, and power fantasy* of Solo Leveling — but with fully original worldbuilding, characters, monsters, lore, mechanics, and visual identity. Runs in the browser. No build step. No assets — every visual is drawn procedurally on canvas, every sound is synthesized via WebAudio.

> *Year 0021, Post-Convergence. The sky tore open above the Pale Sea. Through every wound came the Hollow. You are E-Rank. The lowest. A flicker in a world of furnaces. But somewhere beneath the silence of your bones, an older voice has begun to speak. It calls itself the **Abyss Interface**. It does not ask permission.*

## Run it

Just open [`index.html`](index.html) in any modern browser, or serve the folder:

```bash
cd solo-leveling-like
python3 -m http.server 8000
# open http://localhost:8000
```

Click **[ ENTER THE VEIL ]** to begin (this also unlocks audio).

## Controls

| Action | Key |
|---|---|
| Move | `WASD` / Arrows |
| Aim | Mouse |
| Basic attack (combo) | Left Mouse |
| Dodge / Parry (i-frames + 0.18s parry window) | `Space` or Right Mouse |
| Skill 1–4 | `1` `2` `3` `4` |
| Ultimate (BE THRONED) | `R` |
| Extract shadow from corpse (also slot 4) | `Q` |
| Open / close Menu | `Tab` / `Esc` |
| Descend portal (next floor / exit) | `E` while standing on it |

## What's implemented

### World — original setting
- **Ardenholt**, post-Convergence Earth. Veils (rifts) tear into reality.
- **Five factions**: The Argent Spire, House Vehrenmoor, The Crimson Ledger, Choir of Ash, The Ninth Bureau.
- **Nine Monarchs**: Smiling Executioner, Blind Dragon Priest, Titan of Chains, Fallen Seraph, Corpse King, Coral Empress, The Coil, One Who Was Not Invited, The Last Sovereign.
- **Eight ranks**: E (Ember) → D → C → B → A → S → SS (Eclipse) → MONARCH.
- Six story acts from "The Quiet City" to "The Last Throne". See the **Codex** in-game.

### The forbidden system: **Abyss Interface**
- Speaks to the player in cinematic popups (top-of-screen cards, synthesized "ping").
- Issues **directives** (quests) that evolve as you progress.
- Reacts to actions: first kill, first extract, level thresholds, boss approach, boss kill.
- This is your "System" — fully original name and voice.

### Combat
- Fast 4-hit melee combo with dynamic stagger and knockback.
- **Dodge with i-frames + parry window** — perfect-timing right after dodge → riposte for 2.5× damage.
- **Crit** scaling with PERCEPTION + lifesteal.
- Projectiles, AoEs, ground eruptions, telegraphed boss slams, multi-phase bosses with rage transitions and shockwaves.
- Floating combat numbers, hit-stop screen shake, damage flash.

### Stats (you allocate manually on level-up)
`STR · AGI · INT · VIT · PER · SHADOW POWER · MANA · LUCK` — all derived stats (HP, MP, ATK, Spell Power, Move Speed, Crit, Shadow Affinity, Max Active Shadows, Lifesteal) recompute live.

### Skill system
Unlock skills with skill points, equip to 5 slots (1–4 + R). Skill list:
- **Umbral Slash** (basic combo) · **Phantom Dash** (dodge) · **Night Cleave** (heavy arc) · **Void Bolt** (piercing projectile) · **Crown of Ravens** (orbiting AoE for 3s) · **Grave Spike** (cursor eruption) · **Arise** (extract corpse to shadow) · **Be Throned** (ultimate domain — hyperarmor, +50% damage, mass summon, mass stagger).

### Shadow / Necromancer mechanic
- On any corpse within 220px, press `4` or `Q` to **EXTRACT**. Success rate scales with SHADOW affinity; bosses are hardest, normal grunts easiest.
- Extracted shadows are stored permanently in your **Legion**. They auto-summon up to your max-active count when entering a dungeon and fight enemies independently.
- Bosses and elites become **Named Commanders** (gold tint, stronger, distinct presence in the legion list).
- Spend gold in the **Shadows panel** to **rank up** any shadow (HP+18%, ATK+15%).
- Visual: violet smoky bodies for normals; gold smoke for commanders.

### Dungeons (procedural)
Every floor is BSP-generated with rooms, corridors, props (runes, sigils, torches, bones), enemy packs, occasional elites, and a glowing exit portal. Eight gates with distinct biomes:
- **Cracked Alley** (E · urban) → **Whispering Steel** (D · mirror) → **Hollow Mountain Pass** (C · frost) → **Buried City Underspire** (B · ruin) → **Black Hymn Cathedral** (A · cathedral) → **The Long Funeral** (S · crypt) → **Inverted Tower** (SS · 99-floor infinite endgame) → **The Last Throne** (MONARCH · void).
- Each gate has multiple floors and a **named boss** with multi-phase combat and a guaranteed legendary drop.

### Loot & rarity
6 tiers from COMMON (gray) to **MONARCH** (red, glow). Procedurally named with prefixes ("Hollow", "Veil-Carved", "Sovereign's"…) and stat rolls scaling with rarity.

### UI
Holographic letterboxed cinematics, animated Abyss popups, level-up flash, damage radial vignette, zone-name reveal, minimap stub, skill cooldown sweeps, quest tracker, equipment panel, codex with full lore.

### Audio
All synthesized via WebAudio:
- Ambient drone music with mood swap (hub / dungeon / **boss**) using detuned saw + LFO + low-pass.
- SFX: hit, crit, swing, dodge, parry, cast, **extract** (sub-bass + reverse sweep), level-up arpeggio, boss slam, system ping, death dirge.

## Architecture

```
index.html
styles.css
src/
  main.js       — boot, RAF loop
  game.js       — scene, world, combat resolver, skill execution
  entities.js   — Player, Enemy, Shadow, Projectile
  dungeon.js    — BSP gen, biome rendering, collision
  ui.js         — HUD, Abyss popups, menu panels, cinematic, floaters
  data.js       — skills, item rolling, gates
  lore.js       — original worldbuilding text
  audio.js      — WebAudio music + SFX
  input.js      — keyboard/mouse
  util.js       — math, RNG, event bus
```

No frameworks, no dependencies, no asset files — everything runs from the static folder.

## Extending

Designed to be hackable. Add a new **Monarch boss**? Append to [`GATES`](src/data.js) and add a phase entry in [`Enemy`](src/entities.js). New **skill**? Add to `SKILLS` with `type: 'projectile' | 'melee' | 'aoe' | 'extract' | 'ult'` and [`Game.castSkill`](src/game.js) handles dispatch. New **biome**? Add a palette in `biomePalette` in [`dungeon.js`](src/dungeon.js).

The **Inverted Tower** is already wired as an infinite procedural endgame — every `[E]` on its exit portal generates a deeper, harder floor.

— *The Abyss watches. Rise.*

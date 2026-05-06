// === Procedural audio (WebAudio) ======================================
// All SFX are synthesized — no asset files.

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;

function ensure() {
  if (ctx) return ctx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  masterGain = ctx.createGain(); masterGain.gain.value = 0.6; masterGain.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(masterGain);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(masterGain);
  return ctx;
}

export function unlock() { ensure(); if (ctx?.state === 'suspended') ctx.resume(); }

function tone({ freq = 440, type = 'sine', dur = 0.2, vol = 0.4, atk = 0.005, rel = 0.1, slide = 0, dest } = {}) {
  ensure(); if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur + rel);
  o.connect(g); g.connect(dest ?? sfxGain);
  o.start(); o.stop(ctx.currentTime + dur + rel + 0.05);
  return { o, g };
}

function noise(dur = 0.2, vol = 0.3, filterFreq = 800, q = 4) {
  ensure(); if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start();
}

export const sfx = {
  hit() { tone({ freq: 220, type: 'square', dur: 0.06, vol: 0.25, slide: -120 }); noise(0.1, 0.18, 1400); },
  crit() { tone({ freq: 540, type: 'sawtooth', dur: 0.12, vol: 0.3, slide: -300 }); noise(0.15, 0.25, 2200); },
  swing() { noise(0.12, 0.12, 600, 8); },
  dodge() { tone({ freq: 880, type: 'sine', dur: 0.15, vol: 0.18, slide: 400 }); },
  parry() { tone({ freq: 1600, type: 'square', dur: 0.08, vol: 0.25 }); tone({ freq: 2400, type: 'sine', dur: 0.2, vol: 0.18 }); },
  cast() { tone({ freq: 200, type: 'sine', dur: 0.4, vol: 0.18, slide: 800 }); },
  shadow() { tone({ freq: 120, type: 'sawtooth', dur: 0.6, vol: 0.22, slide: -60 }); tone({ freq: 70, type: 'sine', dur: 0.6, vol: 0.18 }); },
  extract() { tone({ freq: 80, type: 'sawtooth', dur: 0.8, vol: 0.3, slide: 200 }); tone({ freq: 320, type: 'sine', dur: 0.6, vol: 0.15 }); noise(0.4, 0.2, 200, 2); },
  levelup() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.3 }), i * 90)); },
  enemyDie() { tone({ freq: 180, type: 'sawtooth', dur: 0.4, vol: 0.2, slide: -120 }); noise(0.3, 0.2, 300); },
  bossHit() { tone({ freq: 60, type: 'sine', dur: 0.4, vol: 0.4 }); noise(0.3, 0.3, 200, 1); },
  ui() { tone({ freq: 1200, type: 'square', dur: 0.04, vol: 0.1 }); },
  uiOpen() { tone({ freq: 600, type: 'sine', dur: 0.12, vol: 0.12, slide: 600 }); },
  systemPing() { tone({ freq: 880, type: 'sine', dur: 0.08, vol: 0.18 }); tone({ freq: 1320, type: 'sine', dur: 0.12, vol: 0.12 }); },
  warn() { tone({ freq: 440, type: 'square', dur: 0.18, vol: 0.2 }); tone({ freq: 330, type: 'square', dur: 0.18, vol: 0.2 }); },
  pickup() { tone({ freq: 880, type: 'triangle', dur: 0.1, vol: 0.18, slide: 400 }); },
  death() { [220, 165, 110, 80].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sawtooth', dur: 0.5, vol: 0.3 }), i * 200)); },
  hurt() { tone({ freq: 160, type: 'sawtooth', dur: 0.18, vol: 0.25, slide: -60 }); }
};

// Ambient drone music
let droneNodes = [];
export function startMusic(mood = 'hub') {
  stopMusic();
  ensure(); if (!ctx) return;
  const base = mood === 'boss' ? 55 : mood === 'dungeon' ? 73 : mood === 'hub' ? 110 : 87;
  const freqs = mood === 'boss' ? [base, base * 1.5, base * 2.37] :
                mood === 'dungeon' ? [base, base * 1.5, base * 2] :
                [base, base * 1.5, base * 2.25, base * 3];
  freqs.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    o.type = i === 0 ? 'sawtooth' : 'sine';
    o.frequency.value = f;
    lfo.frequency.value = 0.1 + i * 0.07;
    lfoG.gain.value = 0.04;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    g.gain.value = 0.06 / (i + 1);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 800;
    o.connect(filter); filter.connect(g); g.connect(musicGain);
    o.start(); lfo.start();
    droneNodes.push(o, lfo);
  });
  if (mood === 'boss') {
    // choir-like pad
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = base * 4;
    const g = ctx.createGain(); g.gain.value = 0.04;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 5;
    o.connect(f); f.connect(g); g.connect(musicGain);
    o.start(); droneNodes.push(o);
  }
}
export function stopMusic() {
  droneNodes.forEach(n => { try { n.stop(); } catch(e){} });
  droneNodes = [];
}

export function setMusicVol(v) { ensure(); if (musicGain) musicGain.gain.value = v; }
export function setSfxVol(v) { ensure(); if (sfxGain) sfxGain.gain.value = v; }

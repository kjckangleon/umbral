// === UMBRAL :: utility helpers =========================================
export const TAU = Math.PI * 2;
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b ?? a + 1));
export const choice = arr => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const angle = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const aabb = (a, b) => Math.abs(a.x - b.x) < (a.r + b.r) && Math.abs(a.y - b.y) < (a.r + b.r);

export function chance(p) { return Math.random() < p; }
export function uid() { return Math.random().toString(36).slice(2, 9); }

// === Event bus ===
class Bus {
  constructor() { this.h = new Map(); }
  on(ev, fn) { (this.h.get(ev) ?? this.h.set(ev, []).get(ev)).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { const a = this.h.get(ev); if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  emit(ev, ...a) { (this.h.get(ev) ?? []).slice().forEach(f => f(...a)); }
}
export const bus = new Bus();

// === Pseudo-random color helpers ===
export const hsl = (h, s = 70, l = 60, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

// timing
export const now = () => performance.now();

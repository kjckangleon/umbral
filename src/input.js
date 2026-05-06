// === Input ============================================================
const keys = new Set();
const pressed = new Set();   // single-frame
const mouse = { x: 0, y: 0, down: false, clicked: false, rdown: false, lastMoved: 0 };

// touch-driven analog inputs (consumed by game.js)
const touch = {
  move: { x: 0, y: 0, active: false },   // -1..1 vector for movement
  aim:  { x: 0, y: 0, active: false },   // -1..1 vector for aim; active = also attack
};

addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  keys.add(k); pressed.add(k);
  if (['arrowup','arrowdown','arrowleft','arrowright',' ','tab'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('mousemove', e => {
  const c = document.getElementById('game');
  const r = c.getBoundingClientRect();
  // canvas is rendered with object-fit:contain — find the actual content rect
  const scale = Math.min(r.width / 1280, r.height / 720);
  const cw = 1280 * scale, ch = 720 * scale;
  const ox = r.left + (r.width - cw) / 2;
  const oy = r.top + (r.height - ch) / 2;
  mouse.x = (e.clientX - ox) / scale;
  mouse.y = (e.clientY - oy) / scale;
  mouse.lastMoved = performance.now();
});
addEventListener('mousedown', e => {
  if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  else if (e.button === 2) { mouse.rdown = true; }
});
addEventListener('mouseup', e => {
  if (e.button === 0) mouse.down = false;
  else if (e.button === 2) mouse.rdown = false;
});
addEventListener('contextmenu', e => e.preventDefault());

// ---- helpers used by the touch overlay -----------------------------------
export function setKeyDown(k, down) {
  k = k.toLowerCase();
  if (down) { if (!keys.has(k)) pressed.add(k); keys.add(k); }
  else keys.delete(k);
}
export function tapKey(k) {
  k = k.toLowerCase();
  pressed.add(k); keys.add(k);
  setTimeout(() => keys.delete(k), 60);
}
export function setMouseButton(btn, down) {
  if (btn === 0) {
    if (down && !mouse.down) mouse.clicked = true;
    mouse.down = down;
  } else if (btn === 2) {
    mouse.rdown = down;
  }
}

export function key(k) { return keys.has(k); }
export function pressedKey(k) { return pressed.has(k); }
export function endFrame() { pressed.clear(); mouse.clicked = false; }
export { mouse, touch };


// === Touch / Mobile Controls ==============================================
// Dual virtual joysticks + action buttons. Activates on coarse-pointer devices
// (phones/tablets) but can be force-enabled with ?touch=1.
import { setKeyDown, tapKey, setMouseButton, touch } from './input.js';

const isTouchDevice = () => {
  if (location.search.includes('touch=1')) return true;
  if (location.search.includes('touch=0')) return false;
  return matchMedia('(hover: none) and (pointer: coarse)').matches
    || ('ontouchstart' in window && innerWidth < 1100);
};

export function initTouchControls() {
  if (!isTouchDevice()) return;
  document.body.classList.add('mobile');

  const root = document.createElement('div');
  root.id = 'touch-ui';
  root.innerHTML = `
    <div class="tc-stick tc-move" id="tc-move">
      <div class="tc-base"></div><div class="tc-knob"></div>
    </div>
    <div class="tc-stick tc-aim" id="tc-aim">
      <div class="tc-base"></div><div class="tc-knob"></div>
      <div class="tc-hint">AIM · HOLD TO ATTACK</div>
    </div>
    <button class="tc-btn tc-ult"   data-key="r">◉<span>R</span></button>
    <div class="tc-skills">
      <button class="tc-btn tc-skill" data-key="1">⚔<span>1</span></button>
      <button class="tc-btn tc-skill" data-key="2">✦<span>2</span></button>
      <button class="tc-btn tc-skill" data-key="3">☽<span>3</span></button>
      <button class="tc-btn tc-skill" data-key="4">☠<span>4</span></button>
      <button class="tc-btn tc-dodge" data-key=" ">DODGE</button>
    </div>
    <div class="tc-utils">
      <button class="tc-btn tc-util" data-key="tab">MENU</button>
      <button class="tc-btn tc-util" data-key="e">USE</button>
      <button class="tc-btn tc-util" data-key="q">EXTRACT</button>
    </div>
  `;
  document.body.appendChild(root);

  // ---- joystick helper -------------------------------------------------
  // Listens on document so a finger that drifts off the stick keeps tracking.
  function bindStick(el, target) {
    const knob = el.querySelector('.tc-knob');
    let touchId = null, cx = 0, cy = 0, radius = 56;

    const begin = (clientX, clientY) => {
      const r = el.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      radius = Math.min(r.width, r.height) / 2;
      target.active = true;
      el.classList.add('active');
      update(clientX, clientY);
    };
    const update = (clientX, clientY) => {
      const dx = clientX - cx, dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      const k = len > radius ? radius / len : 1;
      target.x = (dx * k) / radius;
      target.y = (dy * k) / radius;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    };
    const release = () => {
      touchId = null;
      target.active = false;
      target.x = 0; target.y = 0;
      knob.style.transform = '';
      el.classList.remove('active');
    };

    el.addEventListener('touchstart', e => {
      if (touchId !== null) return;
      const t = e.changedTouches[0];
      touchId = t.identifier;
      begin(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', e => {
      if (touchId === null) return;
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) { update(t.clientX, t.clientY); e.preventDefault(); break; }
      }
    }, { passive: false });

    const endHandler = e => {
      if (touchId === null) return;
      for (const t of e.changedTouches) if (t.identifier === touchId) { release(); break; }
    };
    document.addEventListener('touchend', endHandler);
    document.addEventListener('touchcancel', endHandler);
  }

  bindStick(document.getElementById('tc-move'), touch.move);
  bindStick(document.getElementById('tc-aim'),  touch.aim);

  // ---- buttons ---------------------------------------------------------
  for (const btn of root.querySelectorAll('.tc-btn')) {
    const k = btn.dataset.key;
    let pressed = false;
    const press = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (pressed) return;
      pressed = true;
      btn.classList.add('down');
      if (k === ' ') setKeyDown(' ', true);   // hold for dodge
      else tapKey(k);                          // tap for skills/util
    };
    const release = (e) => {
      if (e) { e.preventDefault?.(); e.stopPropagation?.(); }
      if (!pressed) return;
      pressed = false;
      btn.classList.remove('down');
      if (k === ' ') setKeyDown(' ', false);
    };
    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release);
    btn.addEventListener('touchcancel', release);
    // mouse fallbacks for ?touch=1 desktop testing
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
    // suppress the synthetic click that follows touchend
    btn.addEventListener('click', e => e.preventDefault());
  }

  // ---- per-frame: aim stick triggers attack ---------------------------
  let attacking = false;
  function tick() {
    const want = touch.aim.active && (Math.abs(touch.aim.x) + Math.abs(touch.aim.y) > 0.15);
    if (want !== attacking) {
      attacking = want;
      setMouseButton(0, want);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // disable pinch-zoom & double-tap zoom; do NOT block touchmove globally
  // (joystick / button handlers already preventDefault their own events)
  document.addEventListener('gesturestart', e => e.preventDefault());
  let lastTap = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTap < 300) e.preventDefault();
    lastTap = now;
  }, { passive: false });
}

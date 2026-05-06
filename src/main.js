// === Entry point ======================================================
import { Game } from './game.js';
import { unlock, startMusic } from './audio.js';
import { initTouchControls } from './touch.js';

const canvas = document.getElementById('game');
canvas.style.display = 'none';

const boot = document.getElementById('boot');
const startBtn = document.getElementById('boot-start');
const hud = document.getElementById('hud');

let game = null;

startBtn.addEventListener('click', () => {
  unlock();
  boot.style.display = 'none';
  canvas.style.display = 'block';
  hud.classList.remove('hidden');
  game = new Game(canvas);
  initTouchControls();
  startMusic('hub');
  loop();
});

document.getElementById('death-revive').addEventListener('click', () => {
  game?.reviveAtHub();
});

let last = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(loop);
}

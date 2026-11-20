import { initialInput, ISLAND_RADIUS, Night, TICK_RATE } from './simulation.mjs';
import { Scene } from './scene.mjs';

const byId = (id) => document.getElementById(id);
const ui = Object.fromEntries([
  'game', 'scene', 'map', 'intro', 'start', 'load-error', 'hud', 'pause', 'touch', 'flames', 'carried',
  'score', 'lantern-count', 'lantern-pips', 'clock', 'notice', 'prompt', 'overlay', 'overlay-tag',
  'overlay-title', 'overlay-description', 'overlay-action',
].map((id) => [id, byId(id)]));

const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'KeyQ', 'KeyR', 'Space', 'KeyE', 'KeyF']);
const actions = new Set(['Space', 'KeyE', 'KeyF']);
const keys = new Set();
const pending = new Set();
const stepMs = 1000 / TICK_RATE;
let night;
let scene;
let tuning;
let mode = 'menu';
let yaw = 0;
let pulseAt = -Infinity;
let noticeUntil = 0;
let drag;
let accumulator = 0;
let previousTime;
let hudAt = -Infinity;

function setMode(next) {
  mode = next;
  ui.game.dataset.mode = next;
  ui.intro.hidden = next !== 'menu';
  ui.hud.hidden = next === 'menu';
  ui.pause.hidden = next !== 'playing';
  ui.touch.hidden = next !== 'playing';
  ui.overlay.hidden = next !== 'paused' && next !== 'ended';
  keys.clear();
  pending.clear();
  accumulator = 0;
}

function start() {
  night = new Night(tuning, 42);
  yaw = 0;
  pulseAt = -Infinity;
  noticeUntil = 0;
  ui.notice.hidden = true;
  setMode('playing');
  updateHud(performance.now());
  ui.scene.focus();
}

function overlay(tag, title, description, action) {
  ui['overlay-tag'].textContent = tag;
  ui['overlay-title'].textContent = title;
  ui['overlay-description'].textContent = description;
  ui['overlay-action'].textContent = action;
  ui['overlay-action'].focus();
}

function pause() {
  if (mode !== 'playing') return;
  setMode('paused');
  overlay('Đêm 1 · Đảo Bến', 'Tạm dừng', 'Mây sẽ chờ bạn quay lại.', 'Tiếp tục');
}

function resume() {
  setMode('playing');
  ui.scene.focus();
}

function end(reason) {
  setMode('ended');
  const won = night.state === 'won';
  const detail = {
    all_lit: 'Cả năm chiếc đèn đã sáng. Đảo Bến đã thoát khỏi sương đen.',
    dawn: 'Bình minh đến trước khi Mây thắp lại đủ đèn.',
    no_flames: 'Mây đã cạn sinh lực. Hãy tìm nơi an toàn quanh những chiếc đèn sáng.',
  };
  overlay(won ? 'Chiến thắng' : 'Kết thúc Đêm 1', won ? 'Đảo Bến bừng sáng' : 'Ánh sáng đã tắt',
    `${detail[reason]} Điểm của bạn: ${night.score}.`, 'Chơi lại');
}

function showNotice(message, now) {
  ui.notice.textContent = message;
  ui.notice.hidden = false;
  noticeUntil = now + 1700;
}

function readControls() {
  const active = (...codes) => Number(codes.some((code) => keys.has(code)));
  const action = (code) => keys.has(code) || pending.has(code);
  yaw += (active('KeyR') - active('KeyQ')) * 1.8 / TICK_RATE;
  const input = initialInput();
  input.move = [active('KeyD', 'ArrowRight') - active('KeyA', 'ArrowLeft'),
    active('KeyW', 'ArrowUp') - active('KeyS', 'ArrowDown')];
  input.cam_yaw_deg = yaw * 180 / Math.PI;
  input.jump = action('Space');
  input.interact = action('KeyE');
  input.pulse = action('KeyF');
  pending.clear();
  return input;
}

function advance(now) {
  const input = readControls();
  const couldPulse = night.player.carried >= tuning.pulse_cost;
  const requestedPulse = input.pulse && !night.previousInput.pulse;
  const events = night.step(input);
  if (requestedPulse && !couldPulse && !events.some((event) => event.name === 'pulse')) {
    showNotice(`Cần ${tuning.pulse_cost} đom đóm để tỏa sáng.`, now);
  }
  for (const { name, data } of events) {
    switch (name) {
      case 'pulse':
        pulseAt = now;
        if (data.stunned_ids.length) showNotice('Đã xua Bóng Mực!', now);
        break;
      case 'lantern_lit': showNotice('Đèn đã sáng. Hãy đứng gần đèn để tránh Bóng Mực.', now); break;
      case 'player_hit': showNotice('Mây mất một sinh lực.', now); break;
      case 'game_over': end(data.reason); break;
    }
  }
}

function updateHud(now) {
  const { flames, carried } = night.player;
  const lanterns = night.lanterns.filter((lantern) => lantern.lit).length;
  ui.flames.textContent = '✦'.repeat(flames) + '✧'.repeat(tuning.flames - flames);
  ui.flames.setAttribute('aria-label', `${flames} trên ${tuning.flames}`);
  ui.carried.textContent = `${carried}/${tuning.carry_capacity}`;
  ui.score.textContent = night.score;
  ui['lantern-count'].textContent = `${lanterns}/${tuning.lantern_count_night1}`;
  for (const [index, pip] of Array.from(ui['lantern-pips'].children).entries()) {
    pip.classList.toggle('lit', night.lanterns[index].lit);
  }
  const remaining = Math.ceil(night.timeLeft);
  ui.clock.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  ui.clock.setAttribute('datetime', `PT${remaining}S`);
  ui.notice.hidden = now >= noticeUntil;
  const nearby = night.nearbyLantern();
  ui.prompt.hidden = !nearby || mode !== 'playing';
  if (nearby) {
    const message = carried ? `E · Nạp đèn (${nearby.deposited}/${tuning.lantern_cost})` : 'Nhặt đom đóm để nạp đèn.';
    if (ui.prompt.textContent !== message) ui.prompt.textContent = message;
  }
  renderMap();
}

function renderMap() {
  const ctx = ui.map.getContext('2d');
  const center = ui.map.width / 2;
  const radius = center - 9;
  const scale = radius / ISLAND_RADIUS;
  ctx.clearRect(0, 0, ui.map.width, ui.map.height);
  const disc = (x, y, r, fill) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  disc(center, center, radius, '#252f42');
  ctx.strokeStyle = '#767d9a';
  ctx.stroke();
  const map = ([x, , z]) => [center + x * scale, center - z * scale];
  for (const mote of night.motes) disc(...map(mote.pos), 0.9, '#b58d5c');
  for (const shade of night.shades) disc(...map(shade.pos), 2.4, '#b780e1');
  for (const lantern of night.lanterns) {
    const [x, y] = map(lantern.pos);
    disc(x, y, 4.3, lantern.lit ? '#ffca6d' : '#777b9b');
    if (!lantern.lit) disc(x, y, 2.65, '#252f42');
  }
  const [x, y] = map(night.player.pos);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(yaw);
  ctx.beginPath();
  ctx.moveTo(0, -6.5);
  ctx.lineTo(4.3, 3.5);
  ctx.lineTo(-4.3, 3.5);
  ctx.closePath();
  ctx.fillStyle = '#e9f4f0';
  ctx.fill();
  ctx.restore();
}

function frame(now) {
  const delta = previousTime === undefined ? 0 : Math.min(now - previousTime, 100);
  previousTime = now;
  if (mode === 'playing') {
    accumulator += delta;
    while (accumulator >= stepMs && mode === 'playing') {
      accumulator -= stepMs;
      advance(now);
    }
  }
  if (mode !== 'menu' && now - hudAt >= 80) {
    updateHud(now);
    hudAt = now;
  }
  scene.render(night, yaw, now / 1000, (now - pulseAt) / 1000, mode === 'menu');
  requestAnimationFrame(frame);
}

function press(code) {
  if (!keys.has(code) && actions.has(code)) pending.add(code);
  keys.add(code);
}

function bindControls() {
  ui.scene.tabIndex = -1;
  ui.start.addEventListener('click', start);
  ui.pause.addEventListener('click', pause);
  ui['overlay-action'].addEventListener('click', () => (mode === 'paused' ? resume() : start()));
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      if (event.repeat) return;
      if (mode === 'paused') resume();
      else pause();
    }
    if (mode !== 'playing' || !controls.has(event.code)) return;
    event.preventDefault();
    press(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pending.clear();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  for (const button of ui.touch.querySelectorAll('button')) {
    const { key } = button.dataset;
    button.addEventListener('pointerdown', (event) => {
      button.setPointerCapture(event.pointerId);
      press(key);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, () => keys.delete(key));
    }
  }
  ui.scene.addEventListener('pointerdown', (event) => {
    if (mode !== 'playing') return;
    ui.scene.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX };
  });
  ui.scene.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId || mode !== 'playing') return;
    yaw += (event.clientX - drag.x) * 0.008;
    drag.x = event.clientX;
  });
  ui.scene.addEventListener('lostpointercapture', () => { drag = undefined; });
}

ui.start.disabled = true;
try {
  const response = await fetch(new URL('../game.contract.json', import.meta.url));
  if (!response.ok) throw new Error('Không tải được cấu hình của Đảo Bến.');
  ({ tuning } = await response.json());
  night = new Night(tuning, 42);
  scene = new Scene(ui.scene);
  for (const lantern of night.lanterns) ui['lantern-pips'].append(document.createElement('i'));
  bindControls();
  ui.start.disabled = false;
  requestAnimationFrame(frame);
} catch (error) {
  ui['load-error'].textContent = error.message;
  ui['load-error'].hidden = false;
}

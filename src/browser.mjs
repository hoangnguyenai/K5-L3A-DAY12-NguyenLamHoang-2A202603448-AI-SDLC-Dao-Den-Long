import { initialInput, ISLAND_RADIUS, Night, TICK_RATE } from './simulation.mjs';
import { Scene } from './scene.mjs';
import { GameAudio } from './audio.mjs';
import { loadSettings, saveSettings } from './settings.mjs';
import { mapFor } from './maps.mjs';

const byId = (id) => document.getElementById(id);
const ui = Object.fromEntries([
  'game', 'scene', 'map', 'intro', 'start', 'load-error', 'hud', 'pause', 'touch', 'flames', 'carried',
  'score', 'lantern-count', 'lantern-pips', 'clock', 'notice', 'prompt', 'overlay', 'overlay-tag',
  'overlay-title', 'overlay-description', 'overlay-action',
  'pause-options', 'restart-night', 'back-menu', 'menu-settings', 'pause-settings', 'settings',
  'accessibleColors', 'threshold', 'volume', 'volume-value', 'sensitivity', 'sensitivity-value', 'settings-status',
  'night-intro', 'enter-night', 'night-name', 'night-story', 'chapter', 'mote-bar', 'dash-status', 'pulse-status', 'direction', 'wind-notice',
].map((id) => [id, byId(id)]));

const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'KeyQ', 'KeyR', 'Space', 'KeyE', 'KeyF', 'ShiftLeft', 'ShiftRight']);
const actions = new Set(['Space', 'KeyE', 'KeyF', 'ShiftLeft', 'ShiftRight']);
const keys = new Set();
const pending = new Set();
const stepMs = 1000 / TICK_RATE;
let night;
let scene;
let tuning;
let mode = 'menu';
let yaw = 0;
let pulseAt = -Infinity;
let pickupUntil = 0;
let noticeUntil = 0;
let drag;
let accumulator = 0;
let previousTime;
let hudAt = -Infinity;
let lastCountdown;
let windWasWarning = false;
let fpsWindowStart;
let fpsFrames = 0;
const audio = new GameAudio();
let storage;
try { storage = window.localStorage; } catch { /* Cài đặt vẫn có hiệu lực trong phiên. */ }
const settings = loadSettings(storage);
audio.setVolume(settings.volume);
let currentNight = 1;
let totalScore = 0;
const nightStories = [
  'Ông Đăng nói: “Mây à, mỗi đốm sáng là một lời hứa. Giữ ít nhất ba chiếc đèn sáng khi trời hửng. Đèn yếu cần được châm thêm dầu.”',
  'Ông Đăng nói: “Cầu tre nối hai bờ Đảo Cau. Dùng bục nhảy và Bùa Gió, nhưng coi chừng Gió Lạc cướp ánh sáng.”',
  'Ông Đăng nói: “Lên dốc rồi tìm bục nhảy tới tháp chuông. Giữ ít nhất năm đèn sáng tới Bình Minh.”',
];

function setMode(next) {
  mode = next;
  ui.game.dataset.mode = next;
  ui.intro.hidden = next !== 'menu';
  ui['night-intro'].hidden = next !== 'introduction';
  ui.hud.hidden = next === 'menu' || next === 'introduction';
  ui.pause.hidden = next !== 'playing';
  ui.touch.hidden = next !== 'playing';
  ui.overlay.hidden = next !== 'paused' && next !== 'ended';
  ui['pause-options'].hidden = next !== 'paused';
  audio.playing = next === 'playing';
  keys.clear();
  pending.clear();
  accumulator = 0;
}

function start() {
  audio.unlock();
  fpsWindowStart = performance.now();
  fpsFrames = 0;
  delete ui.scene.dataset.averageFps;
  night = new Night(tuning, 42, {}, currentNight);
  ui.chapter.textContent = `Đêm ${currentNight} / ${night.map.name}`;
  ui['lantern-pips'].replaceChildren(...night.lanterns.map(() => document.createElement('i')));
  yaw = 0;
  pulseAt = -Infinity;
  pickupUntil = 0;
  noticeUntil = 0;
  lastCountdown = undefined;
  windWasWarning = false;
  ui.notice.hidden = true;
  setMode('playing');
  updateHud(performance.now());
  ui.scene.focus();
}

function introduce() {
  night = new Night(tuning, 42, {}, currentNight);
  setMode('introduction');
  ui['night-name'].textContent = `Đêm ${currentNight} · ${night.map.name}`;
  ui['night-story'].textContent = nightStories[currentNight - 1];
  ui['enter-night'].focus();
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
  overlay(`Đêm ${currentNight} · ${night.map.name}`, 'Tạm dừng', 'Mây sẽ chờ bạn quay lại.', 'Tiếp tục');
}

function resume() {
  setMode('playing');
  ui.scene.focus();
}

function end(reason) {
  setMode('ended');
  const won = night.state === 'won';
  const detail = {
    dawn: 'Bình minh đến trước khi Mây thắp lại đủ đèn.',
    no_flames: 'Mây đã cạn sinh lực. Hãy tìm nơi an toàn quanh những chiếc đèn sáng.',
  };
  if (won) totalScore += night.score;
  overlay(won ? 'Chiến thắng' : `Kết thúc Đêm ${currentNight}`,
    won ? (currentNight === 3 ? 'Bình Minh' : `${night.map.name} bừng sáng`) : 'Ánh sáng đã tắt',
    `${won ? 'Mây đã giữ đảo sáng đến bình minh.' : detail[reason]} Điểm Đêm: ${night.score}. Tổng điểm các Đêm đã thắng: ${totalScore}.`,
    won ? (currentNight === 3 ? 'Về menu' : 'Đêm kế tiếp') : 'Chơi lại');
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
  input.dash = action('ShiftLeft') || action('ShiftRight');
  pending.clear();
  return input;
}

function advance(now) {
  const input = readControls();
  const couldPulse = night.player.carried >= tuning.pulse_cost;
  const requestedPulse = input.pulse && !night.previousInput.pulse;
  const requestedInteract = input.interact && !night.previousInput.interact;
  const jumping = input.jump && !night.previousInput.jump && night.player.pos[1] === 0;
  const events = night.step(input);
  if (requestedInteract && !events.some((event) => ['deposit', 'refuel'].includes(event.name))) {
    showNotice(night.nearbyLantern()
      ? 'Túi đang trống. Hãy nhặt đom đóm để nạp ánh sáng.'
      : 'Hãy đứng cách đèn cần nạp tối đa 2 m rồi nhấn E.', now);
  }
  if (jumping) audio.effect('jump');
  if (requestedPulse && !couldPulse && !events.some((event) => event.name === 'pulse')) {
    showNotice(`Cần ${tuning.pulse_cost} đom đóm để tỏa sáng.`, now);
  }
  for (const { name, data } of events) {
    audio.effect(name === 'game_over' ? data.result : name);
    switch (name) {
      case 'mote_picked':
        pickupUntil = now + 600;
        scene.pickup(night.player.pos, now / 1000);
        showNotice(`+1 đom đóm · Túi ${data.carried}/${night.capacity}`, now);
        break;
      case 'deposit':
        showNotice(`${data.lantern_id}: đã nạp ${data.amount} · ${data.deposited} đom đóm trong đèn`, now);
        break;
      case 'pulse':
        pulseAt = now;
        if (data.stunned_ids.length) showNotice('Đã xua Bóng Mực!', now);
        break;
      case 'refuel': showNotice(`${data.lantern_id} · Đã châm dầu · ${data.fuel}/100`, now); break;
      case 'lantern_out': showNotice(`${data.lantern_id} đã cạn dầu. Cần 5 đom đóm để thắp lại.`, now); break;
      case 'lantern_lit': showNotice(`${data.lantern_id} đã sáng! Đứng gần đèn để tránh Bóng Mực.`, now); break;
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
  ui.carried.textContent = `${carried}/${night.capacity}`;
  ui.carried.classList.toggle('collecting', now < pickupUntil);
  ui['mote-bar'].classList.toggle('collecting', now < pickupUntil);
  ui.score.textContent = night.score;
  ui['lantern-count'].textContent = `${lanterns}/${night.lanterns.length}`;
  ui.threshold.textContent = `Bình minh cần ${night.requiredLights} đèn`;
  if (ui['mote-bar'].childElementCount !== night.capacity) {
    ui['mote-bar'].replaceChildren(...Array.from({ length: night.capacity }, () => document.createElement('i')));
  }
  for (const [index, cell] of Array.from(ui['mote-bar'].children).entries()) cell.classList.toggle('filled', index < carried);
  ui['dash-status'].textContent = night.player.charm > 0 ? 'Lướt · Bùa Gió' : `Lướt ${Math.max(0, night.player.dashCd / 60).toFixed(1)}s`;
  ui['pulse-status'].textContent = `Tỏa sáng ${Math.max(0, night.player.pulseCd / 60).toFixed(1)}s`;
  for (const [index, pip] of Array.from(ui['lantern-pips'].children).entries()) {
    pip.classList.toggle('lit', night.lanterns[index].lit);
  }
  const remaining = Math.ceil(night.timeLeft);
  ui.clock.classList.toggle('danger', remaining <= 30);
  const windWarning = night.windEnabled && night.simTick % 1800 >= 1680;
  ui['wind-notice'].hidden = !windWarning && !night.wind.active;
  ui['wind-notice'].textContent = night.wind.active ? '❧ Gió mạnh đang thổi' : '❧ Gió mạnh sắp đến';
  if (windWarning && !windWasWarning) audio.effect('wind');
  windWasWarning = windWarning;
  if (mode === 'playing' && remaining > 0 && remaining <= 10 && lastCountdown !== remaining) {
    audio.effect('countdown');
    lastCountdown = remaining;
  }
  ui.clock.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  ui.clock.setAttribute('datetime', `PT${remaining}S`);
  ui.notice.hidden = now >= noticeUntil;
  const nearby = night.nearbyLantern();
  ui.prompt.hidden = !nearby || mode !== 'playing';
  if (nearby) {
    const message = nearby.lit ? `E — Châm dầu (${Math.floor(nearby.fuelUnits / 60)}/100)`
      : `E — Nạp ánh sáng (${nearby.deposited}/${nearby.ever_lit ? tuning.relight_cost : tuning.lantern_cost})`;
    if (ui.prompt.textContent !== message) ui.prompt.textContent = message;
  }
  renderMap();
  const target = night.lanterns.filter((lantern) => !lantern.lit).sort((a, b) =>
    Math.hypot(a.pos[0] - night.player.pos[0], a.pos[2] - night.player.pos[2])
    - Math.hypot(b.pos[0] - night.player.pos[0], b.pos[2] - night.player.pos[2]))[0];
  if (target) {
    const dx = target.pos[0] - night.player.pos[0];
    const dz = target.pos[2] - night.player.pos[2];
    const angle = Math.atan2(dx, dz) - yaw;
    const outside = !scene.isOnScreen([target.pos[0], target.pos[1] + 3, target.pos[2]]);
    ui.direction.hidden = !outside;
    ui.direction.textContent = `${Math.sin(angle) < 0 ? '←' : '→'} ${target.id} · ${Math.round(Math.hypot(dx, dz))} m`;
  } else ui.direction.hidden = true;
}

function renderMap() {
  const ctx = ui.map.getContext('2d');
  const center = ui.map.width / 2;
  const radius = center - 9;
  const scale = radius / (currentNight === 2 ? 65 : night.map.radius);
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
  const map = ([x, , z]) => [center + (x - (currentNight === 2 ? 35 : 0)) * scale, center - z * scale];
  for (const mote of night.motes) disc(...map(mote.pos), 0.9, '#b58d5c');
  for (const shade of night.shades) disc(...map(shade.pos), 2.4, settings.accessibleColors ? '#00B3FF' : '#7A3CFF');
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
  fpsWindowStart ??= now;
  fpsFrames++;
  if (now - fpsWindowStart >= 5000) {
    ui.scene.dataset.averageFps = (fpsFrames * 1000 / (now - fpsWindowStart)).toFixed(1);
    ui.scene.dataset.viewport = `${ui.scene.clientWidth}x${ui.scene.clientHeight}`;
    fpsWindowStart = now;
    fpsFrames = 0;
  }
  audio.update(now);
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
  scene.render(night, yaw, now / 1000, (now - pulseAt) / 1000, mode === 'menu' || mode === 'introduction');
  requestAnimationFrame(frame);
}

function press(code) {
  if (!keys.has(code) && actions.has(code)) pending.add(code);
  keys.add(code);
}

function bindControls() {
  ui.scene.tabIndex = -1;
  ui.start.addEventListener('click', () => { currentNight = 1; totalScore = 0; introduce(); });
  ui['enter-night'].addEventListener('click', start);
  ui.pause.addEventListener('click', pause);
  ui['restart-night'].addEventListener('click', start);
  ui['back-menu'].addEventListener('click', () => {
    night = new Night(tuning, 42);
    setMode('menu');
    ui.start.focus();
  });
  function openSettings() {
    audio.unlock();
    ui.accessibleColors.checked = settings.accessibleColors;
    ui.volume.value = settings.volume;
    ui.sensitivity.value = settings.sensitivity;
    ui['volume-value'].textContent = `${Math.round(settings.volume * 100)}%`;
    ui['sensitivity-value'].textContent = `${settings.sensitivity.toFixed(2)}×`;
    ui.settings.showModal();
  }
  ui.accessibleColors.addEventListener('change', () => {
    settings.accessibleColors = ui.accessibleColors.checked;
    document.body.classList.toggle('accessible', settings.accessibleColors);
    scene.accessibleColors = settings.accessibleColors;
    ui['settings-status'].textContent = saveSettings(storage, settings) ? 'Đã lưu.' : 'Áp dụng trong phiên này.';
  });
  ui['menu-settings'].addEventListener('click', openSettings);
  ui['pause-settings'].addEventListener('click', openSettings);
  for (const key of ['volume', 'sensitivity']) {
    ui[key].addEventListener('input', () => {
      settings[key] = Number(ui[key].value);
      audio.setVolume(settings.volume);
      ui['volume-value'].textContent = `${Math.round(settings.volume * 100)}%`;
      ui['sensitivity-value'].textContent = `${settings.sensitivity.toFixed(2)}×`;
      ui['settings-status'].textContent = saveSettings(storage, settings)
        ? 'Đã lưu cài đặt.' : 'Cài đặt áp dụng cho phiên này. Trình duyệt đang chặn lưu trữ.';
    });
  }
  ui['overlay-action'].addEventListener('click', () => {
    if (mode === 'paused') resume();
    else if (night.state === 'won' && currentNight < 3) { currentNight++; introduce(); }
    else if (night.state === 'won') { setMode('menu'); ui.start.focus(); }
    else start();
  });
  window.addEventListener('keydown', (event) => {
    if (ui.settings.open) return;
    if (event.code === 'Escape' || event.code === 'KeyP') {
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
    yaw += (event.clientX - drag.x) * 0.008 * settings.sensitivity;
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
  scene.accessibleColors = settings.accessibleColors;
  document.body.classList.toggle('accessible', settings.accessibleColors);
  for (const lantern of night.lanterns) ui['lantern-pips'].append(document.createElement('i'));
  bindControls();
  ui.start.disabled = false;
  requestAnimationFrame(frame);
} catch (error) {
  ui['load-error'].textContent = error.message;
  ui['load-error'].hidden = false;
}

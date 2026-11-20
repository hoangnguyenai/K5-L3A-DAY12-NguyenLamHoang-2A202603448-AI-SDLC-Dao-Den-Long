import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Chạy trình duyệt kiểm thử riêng cho bản web local. Không dùng profile người học.
const root = fileURLToPath(new URL('../', import.meta.url));
const proof = join(root, 'docs', 'phase-2', 'proof');
await mkdir(proof, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'lantern-browser-'));
const executable = process.env.LANTERN_CHROME ?? (process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const chrome = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {
  windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
});
let socket;
let chromeOutput = '';
chrome.stderr.on('data', (chunk) => { chromeOutput = (chromeOutput + chunk.toString()).slice(-4000); });
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Chrome chưa sẵn sàng sau 15s')), 15000);
    chrome.on('error', reject);
    chrome.on('exit', (code) => reject(new Error(`Chrome thoát ${code}: ${output.slice(-500)}`)));
    chrome.stderr.on('data', (chunk) => {
      output += chunk.toString();
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const address = new URL(endpoint);
  const tabs = await (await fetch(`http://127.0.0.1:${address.port}/json/list`)).json();
  const page = tabs.find((tab) => tab.type === 'page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 1;
  const pending = new Map();
  const errors = [];
  socket.onclose = () => {
    for (const task of pending.values()) task.reject(new Error(`Chrome đóng kết nối: ${chromeOutput}`));
    pending.clear();
  };
  socket.onmessage = (message) => {
    const event = JSON.parse(message.data);
    if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails.text);
    const task = pending.get(event.id);
    if (task) {
      pending.delete(event.id);
      if (event.error) task.reject(new Error(JSON.stringify(event.error)));
      else task.resolve(event.result);
    }
  };
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout ${method}: ${chromeOutput}`)); }, 15000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.result.description);
    return result.result.value;
  };
  async function waitFor(expression) {
    const start = Date.now();
    while (Date.now() - start < 15000) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const message = await evaluate(`document.getElementById('load-error')?.textContent`);
    throw new Error(`Không thấy điều kiện: ${expression}. ${message ?? ''}`);
  }
  const click = (id) => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  const screenshot = async (name) => {
    const { data } = await command('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(proof, name), Buffer.from(data, 'base64'));
  };
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await waitFor(`document.getElementById('start')?.disabled === false`);
  await screenshot('menu.png');
  await click('menu-settings');
  await evaluate(`document.getElementById('volume').value = '0.6'; document.getElementById('volume').dispatchEvent(new Event('input')); document.getElementById('sensitivity').value = '1.5'; document.getElementById('sensitivity').dispatchEvent(new Event('input')); document.getElementById('settings').close();`);
  await command('Page.reload');
  await waitFor(`document.getElementById('start')?.disabled === false`);
  await click('menu-settings');
  assert.equal(await evaluate(`document.getElementById('volume').value`), '0.6');
  assert.equal(await evaluate(`document.getElementById('sensitivity').value`), '1.5');
  await screenshot('settings.png');
  await evaluate(`document.getElementById('settings').close()`);
  await click('start');
  assert.equal(await evaluate(`document.getElementById('night-intro').hidden`), false);
  await click('enter-night');
  await waitFor(`Number(document.getElementById('scene').dataset.averageFps) > 0`);
  await screenshot('night-1.png');
  const fps = await evaluate(`({ fps: Number(document.getElementById('scene').dataset.averageFps), viewport: document.getElementById('scene').dataset.viewport })`);
  await click('pause');
  const clock = await evaluate(`document.getElementById('clock').textContent`);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(await evaluate(`document.getElementById('clock').textContent`), clock);
  assert.equal(await evaluate(`document.getElementById('pause-options').hidden`), false);
  await screenshot('pause.png');
  await click('restart-night');
  assert.equal(await evaluate(`document.getElementById('score').textContent`), '0');
  const key = (type, code, value) => command('Input.dispatchKeyEvent', { type, code, key: value });
  await key('keyDown', 'KeyW', 'w');
  await waitFor(`document.getElementById('carried').textContent !== '0/10'`);
  await key('keyUp', 'KeyW', 'w');
  assert.match(await evaluate(`document.getElementById('notice').textContent`), /\+1 đom đóm/);
  await screenshot('pickup.png');
  await key('keyDown', 'KeyW', 'w');
  await waitFor(`document.getElementById('prompt').hidden === false`);
  await key('keyUp', 'KeyW', 'w');
  await key('keyDown', 'KeyE', 'e');
  await key('keyUp', 'KeyE', 'e');
  await waitFor(`document.getElementById('notice').textContent.includes('đã nạp')`);
  assert.equal(await evaluate(`document.getElementById('lantern-count').textContent`), '0/5');
  assert.equal(await evaluate(`document.getElementById('carried').textContent`), '0/10');
  await screenshot('partial-deposit.png');
  await key('keyDown', 'KeyE', 'e');
  await key('keyUp', 'KeyE', 'e');
  await waitFor(`document.getElementById('notice').textContent.includes('Túi đang trống')`);
  await click('pause');
  await click('back-menu');
  assert.equal(await evaluate(`document.getElementById('intro').hidden`), false);
  // Bản đồ được vẽ qua cùng Scene và Night, trong canvas thử riêng.
  const mapFps = [];
  for (const night of [2, 3]) {
    const measured = await evaluate(`(async () => {
      const { Scene } = await import('/src/scene.mjs');
      const { Night } = await import('/src/simulation.mjs');
      const { tuning } = await (await fetch('/game.contract.json')).json();
      document.getElementById('map-preview')?.remove();
      document.getElementById('game').style.display = 'none';
      const canvas = document.createElement('canvas');
      canvas.id = 'map-preview';
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:100;background:#0E1430';
      document.body.append(canvas);
      const scene = new Scene(canvas);
      const game = new Night(tuning, 42, { player: { pos: ${night === 2 ? '[35,0,0]' : '[0,6,15]'} } }, ${night});
      for (const lantern of game.lanterns.slice(0, -1)) lantern.lit = true;
      return await new Promise((resolve) => {
        let start;
        let frames = 0;
        function draw(now) {
          start ??= now;
          scene.render(game, 0, now / 1000, Infinity, true);
          frames++;
          if (now - start < 5000) requestAnimationFrame(draw);
          else resolve(frames * 1000 / (now - start));
        }
        requestAnimationFrame(draw);
      });
    })()`);
    mapFps.push({ night, fps: measured, lit: night + 3, mode: 'Scene preview' });
    await screenshot(`night-${night}-map-preview.png`);
  }
  assert.deepEqual(errors, []);
  const report = { resolution: '1280x720', ...fps, errors,
    settingsPersisted: true, pauseClockFrozen: true, restart: true, menu: true,
    pickupFeedback: true, partialDepositFeedback: true, emptyDepositFeedback: true,
    mapPreviews: [2, 3], mapFps, date: new Date().toISOString(),
    note: 'Chrome headless, FPS đo từ requestAnimationFrame trong cửa sổ 5 giây. Preview Đêm 2/3 dùng Scene riêng, không phải bằng chứng thắng chuỗi.' };
  await writeFile(join(proof, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
  assert.ok(fps.fps >= 30, `Đêm 1 chỉ đạt ${fps.fps} FPS`);
  for (const measured of mapFps) assert.ok(measured.fps >= 30, `Preview Đêm ${measured.night} chỉ đạt ${measured.fps} FPS`);
  console.log(JSON.stringify(report));
} finally {
  socket?.close();
  chrome.kill();
}

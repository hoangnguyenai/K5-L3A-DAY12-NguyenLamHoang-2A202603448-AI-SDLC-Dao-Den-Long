import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test, after } from 'node:test';
import { Night, initialInput } from '../src/simulation.mjs';
import { mapFor, terrainHeight } from '../src/maps.mjs';
import { loadSettings, saveSettings } from '../src/settings.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { tuning } = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
const empty = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false };
const controls = (value = {}) => ({ ...initialInput(), ...value });
const temp = mkdtempSync(join(tmpdir(), 'lantern-phase2-'));
after(() => rmSync(temp, { recursive: true, force: true }));

function cli(name, night, scenario, frames, ticks) {
  const scenarioFile = join(temp, `${name}-scenario.json`);
  const inputsFile = join(temp, `${name}-inputs.json`);
  const outputFile = join(temp, `${name}.jsonl`);
  writeFileSync(scenarioFile, JSON.stringify(scenario));
  writeFileSync(inputsFile, JSON.stringify({ frames }));
  const result = spawnSync(process.execPath, [...process.execArgv, join(root, 'scripts/headless.mjs'),
    '--seed', '42', '--night', String(night), '--ticks', String(ticks), '--snapshot-every', '1',
    '--scenario', scenarioFile, '--inputs', inputsFile, '--out', outputFile], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  const raw = readFileSync(outputFile, 'utf8');
  return raw.trim().split('\n').map(JSON.parse);
}

test('headless pause giữ thời gian, cooldown, TTL và sim_tick; cạnh nút tiếp tục', () => {
  const rows = cli('pause', 1, { ...empty, player: { pulse_cd_ticks: 100 },
    motes: [{ pos: [20, 0, 0], kind: 'dropped', ttl_ticks: 100 }],
  }, [{ tick: 0, pause: true }, { tick: 9, pause: false }, { tick: 10, pause: true }], 12);
  const snapshots = rows.filter((row) => row.type === 'snapshot');
  assert.equal(snapshots[10].state, 'paused');
  assert.equal(snapshots[10].sim_tick, 0);
  assert.equal(snapshots[10].time_left_s, 240);
  assert.equal(snapshots[10].player.pulse_cd_s, 100 / 60);
  assert.equal(snapshots[10].motes[0].ttl_s, 100 / 60);
  assert.equal(snapshots[11].sim_tick, 1);
  assert.deepEqual(rows.filter((row) => ['paused', 'resumed'].includes(row.name)).map((row) => row.tick), [1, 11]);
});

test('headless lướt đủ 12 tick, giữ độ cao và hướng, không lặp khi giữ nút', () => {
  const rows = cli('dash', 1, { ...empty, player: { pos: [0, 3, 0] } }, [{ tick: 0, dash: true }], 13);
  const snapshots = rows.filter((row) => row.type === 'snapshot');
  assert.deepEqual(snapshots[12].player.pos, [0, 3, 2.8]);
  assert.equal(snapshots[12].player.dash_cd_s, 79 / 60);
  assert.equal(rows.filter((row) => row.name === 'dash').length, 1);
});

test('headless Bùa Gió tăng tốc, cho lướt lại và hồi bùa đúng thời gian', () => {
  const rows = cli('charm', 2, { ...empty, player: { pos: [35, 0, 0] } }, [
    { tick: 1, move: [1, 0] }, { tick: 11, move: [0, 0], dash: true },
    { tick: 12, dash: false }, { tick: 23, dash: true },
  ], 24);
  const snapshots = rows.filter((row) => row.type === 'snapshot');
  assert.equal(snapshots[11].player.pos[0], 36.2);
  assert.equal(rows.filter((row) => row.name === 'dash').length, 2);
  assert.equal(rows.find((row) => row.name === 'charm_picked').data.charm_ticks, 600);
  const night = new Night(tuning, 1, { ...empty, player: { pos: [35, 0, 0] } }, 2);
  night.step(controls());
  night.player.pos = [0, 0, 0];
  for (let tick = 0; tick < 2700; tick++) night.step(controls());
  assert.equal(night.charms[0].available, true);
  assert.equal(night.player.charm, 0);
});

test('headless Gió Lạc cướp trước hit, bỏ qua bất tử và thả đồ khi trúng pulse', () => {
  const rows = cli('steal', 2, { ...empty, player: { carried: 10 },
    drifters: [{ id: 'D1', pos: [0, 0.8, 0] }], shades: [{ id: 'S1', pos: [0, 0.8, 0] }],
  }, [], 1);
  const events = rows.filter((row) => row.type === 'event');
  const steal = events.findIndex((row) => row.name === 'drifter_steal');
  const hit = events.findIndex((row) => row.name === 'player_hit');
  assert.ok(steal < hit);
  assert.equal(events[hit].data.dropped, 3);
  assert.equal(rows.at(-2).player.carried, 4);
  const drop = cli('drop', 2, { ...empty, player: { carried: 3, invuln_ticks: 90 },
    drifters: [{ id: 'D1', pos: [2, 0.8, 0], state: 'flee', stolen: 3 }],
  }, [{ tick: 0, pulse: true }], 1);
  assert.equal(drop.find((row) => row.name === 'drifter_drop').data.amount, 3);
  assert.equal(drop.at(-2).motes.filter((mote) => mote.kind === 'dropped').length, 3);
  assert.equal(drop.at(-2).drifters[0].stolen, 0);
  const protectedPlayer = cli('steal-invuln', 2, { ...empty, player: { carried: 5, invuln_ticks: 90 },
    drifters: [{ id: 'D1', pos: [0, 0.8, 0] }],
  }, [], 1);
  assert.equal(protectedPlayer.find((row) => row.name === 'drifter_steal').data.amount, 3);
});

test('headless pulse dùng khoảng cách 3D, choáng 120 tick và đẩy 4m trong 15 tick', () => {
  const rows = cli('pulse-standard', 1, { ...empty, player: { carried: 10 }, shades: [
    { id: 'S1', pos: [5, 0.8, 0] }, { id: 'S2', pos: [0, 6, 0] },
  ] }, [{ tick: 0, pulse: true }], 15);
  const event = rows.find((row) => row.name === 'pulse');
  assert.deepEqual(event.data.stunned_ids, ['S1']);
  assert.equal(rows.at(-2).shades[0].pos[0], 9);
  assert.equal(rows.at(-2).score, 5);
  assert.equal(rows.at(-2).player.carried, 7);
});

test('headless rơi mất đồ bỏ qua bất tử, hồi sinh sau 60 tick đúng một hit', () => {
  const rows = cli('fall', 2, { ...empty, player: { pos: [35, -10.1, 8], carried: 7, invuln_ticks: 90 } }, [], 61);
  const hits = rows.filter((row) => row.name === 'player_hit');
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 7 });
  const last = rows.at(-2);
  assert.deepEqual(last.player.pos, [0, 0, 0]);
  assert.deepEqual(last.player.vel, [0, 0, 0]);
  assert.equal(last.player.invuln, true);
});

test('headless bục nhảy Đảo Cau giữ vận tốc phóng và đáp trên đảo đích', () => {
  const rows = cli('pad', 2, { ...empty, player: { pos: [20, 0, 18] } }, [{ tick: 0, move: [-1, 0] }], 85);
  const snapshots = rows.filter((row) => row.type === 'snapshot');
  assert.ok(snapshots[20].player.pos[0] > 20);
  assert.ok(snapshots[20].player.vel[0] > 20);
  const end = snapshots.at(-1).player;
  assert.equal(end.grounded, true);
  assert.ok(Math.hypot(end.pos[0] - 70, end.pos[2]) <= 28);
});

test('headless gió chỉ Đêm 3, báo lịch 1800 và pause ngăn tiến gió', () => {
  const rows = cli('wind', 3, { ...empty, wind_enabled: true }, [], 1801);
  const snapshots = rows.filter((row) => row.type === 'snapshot');
  assert.equal(snapshots[1799].wind.active, false);
  assert.equal(snapshots[1800].wind.active, true);
  assert.ok(Number.isFinite(snapshots[1800].wind.dir_deg));
});

test('bản đồ chuẩn, dốc, vách, tháp và pad Đêm 3', () => {
  assert.deepEqual([1, 2, 3].map((night) => mapFor(night).lanterns.length), [5, 6, 7]);
  assert.equal(terrainHeight(1, 40, 0), 0);
  assert.equal(terrainHeight(1, 40.01, 0), -Infinity);
  assert.equal(terrainHeight(2, 35, 2), 0);
  assert.equal(terrainHeight(2, 35, 2.01), -Infinity);
  assert.equal(terrainHeight(3, 0, 18), 3);
  assert.equal(terrainHeight(3, 0, 5), 6);
  assert.ok(Math.abs(terrainHeight(3, 27 * Math.cos(Math.PI / 6), 27 * Math.sin(Math.PI / 6)) - 1.5) < 1e-8);
  const pad = new Night(tuning, 42, { ...empty, player: { pos: [0, 3, 13] } }, 3);
  for (let index = 0; index < 60; index++) pad.step(controls());
  assert.equal(pad.player.pos[1], 6);
  assert.equal(pad.player.grounded, true);
  const wall = new Night(tuning, 42, { ...empty, player: { pos: [24.1, 0, 1] } }, 3);
  for (let index = 0; index < 30; index++) wall.step(controls({ move: [-1, 0] }));
  assert.ok(wall.player.pos[0] >= 24);
});

test('lịch sinh chuẩn, thực thể mới không tương tác trong tick sinh', () => {
  const night = new Night(tuning, 42, { random_drifters: false });
  assert.equal(night.motes.length, 20);
  assert.equal(new Set(night.motes.map((mote) => JSON.stringify(mote.pos))).size, 20);
  for (let tick = 0; tick < 300; tick++) night.step(controls());
  assert.equal(night.shades.length, 2);
  assert.equal(night.player.flames, 3);
  assert.ok(night.shades.every((shade) => shade.state === 'spawning'));
  const drifters = new Night(tuning, 42, { random_shades: false }, 2);
  for (let tick = 0; tick < 1200; tick++) drifters.step(controls());
  assert.equal(drifters.drifters[0].id, 'D1');
});

test('cài đặt lưu và đọc lại, dữ liệu hỏng quay về mặc định', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  assert.equal(saveSettings(storage, { volume: 0.6, sensitivity: 1.5, accessibleColors: true }), true);
  assert.deepEqual(loadSettings(storage), { volume: 0.6, sensitivity: 1.5, accessibleColors: true });
  assert.deepEqual(loadSettings({ getItem: () => '{oops' }), { volume: 0.35, sensitivity: 1, accessibleColors: false });
});

test('CLI từ chối pause sai kiểu và id trùng với mã 2', () => {
  const path = join(temp, 'bad.json');
  writeFileSync(path, JSON.stringify({ frames: [{ tick: 0, pause: 1 }] }));
  const result = spawnSync(process.execPath, [...process.execArgv, join(root, 'scripts/headless.mjs'),
    '--seed', '1', '--night', '2', '--ticks', '2', '--out', join(temp, 'bad.jsonl'), '--inputs', path], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /pause/);
});

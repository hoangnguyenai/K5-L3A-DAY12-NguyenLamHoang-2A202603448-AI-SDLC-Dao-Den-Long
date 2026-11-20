import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { initialInput, Night } from '../src/simulation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { tuning } = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'dao-den-long-'));
after(() => rmSync(directory, { recursive: true, force: true }));

function file(name, data) {
  const path = join(directory, name);
  writeFileSync(path, JSON.stringify(data));
  return path;
}

const fixture = (name) => join(root, 'tests', 'fixtures', `${name}.json`);
const empty = { random_motes: false, random_shades: false };

function run(name, options = {}) {
  const output = join(directory, `${name}.jsonl`);
  const flags = Object.entries({ seed: 42, night: 1, ticks: 240, out: output, ...options })
    .flatMap(([key, value]) => [`--${key}`, String(value)]);
  const processResult = spawnSync(process.execPath, [
    ...process.execArgv, join(root, 'scripts', 'headless.mjs'), ...flags,
  ], { cwd: root, encoding: 'utf8', timeout: 10000 });
  if (processResult.status !== 0) return processResult;
  assert.equal(processResult.stderr, '');
  const raw = readFileSync(output, 'utf8');
  const rows = raw.trimEnd().split('\n').map(JSON.parse);
  assert.equal(rows.at(-1).type, 'end');
  return { ...processResult, raw, rows, events: rows.filter((row) => row.type === 'event'), end: rows.at(-1) };
}

test('input từng phần, xoay camera, chuẩn hóa đường chéo và snapshot đúng tick', () => {
  const scenario = file('empty.json', empty);
  const inputs = file('move.json', { frames: [
    { tick: 0, move: [0, 1], cam_yaw_deg: 90 },
    { tick: 10, cam_yaw_deg: 0 },
    { tick: 20, move: [1, 1] },
  ] });
  const result = run('movement', { scenario, inputs, ticks: 31 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.rows.slice(0, -1).map(({ tick, sim_tick, player }) => [tick, sim_tick, player.pos]), [
    [0, 0, [0, 0, 0]], [10, 10, [1, 0, 0]], [20, 20, [1, 0, 1]], [30, 30, [1.707, 0, 1.707]],
  ]);
  assert.deepEqual(result.end, { type: 'end', ticks: 31, state: 'playing', score: 0 });
});

test('nhặt đúng bán kính ngang, tỏa sáng hất lùi, nạp và thắp đèn', () => {
  const result = run('pulse', { scenario: fixture('pulse-scenario'), inputs: fixture('pulse-inputs'), ticks: 3, 'snapshot-every': 1 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.events, [
    { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 7 } },
    { type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['ink'] } },
    { type: 'event', tick: 2, name: 'deposit', data: { lantern_id: 'L1', amount: 4, deposited: 6 } },
    { type: 'event', tick: 2, name: 'lantern_lit', data: { lantern_id: 'L1' } },
  ]);
  const first = result.rows.find((row) => row.type === 'snapshot' && row.tick === 1);
  assert.deepEqual(first.shades[0], { id: 'ink', pos: [8, 0.8, 0], state: 'stunned' });
  assert.equal(result.end.score, 130);
});

test('giữ nút không lặp hành động, hồi chiêu và hết choáng đúng tick', () => {
  const night = new Night(tuning, 42, { ...empty, player: { carried: 8 }, shades: [{ pos: [5, 0, 0] }] });
  const input = { ...initialInput(), pulse: true, jump: true };
  assert.equal(night.step(input).filter((event) => event.name === 'pulse').length, 1);
  assert.ok(night.player.pos[1] > 0);
  night.step(initialInput());
  assert.equal(night.step(input).length, 0);
  while (night.tick < 150) assert.equal(night.step(input).length, 0);
  assert.equal(night.shades[0].state, 'stunned');
  assert.equal(night.player.pos[1], 0);
  night.step(initialInput());
  assert.equal(night.shades[0].state, 'chase');
  assert.equal(night.step(input)[0].name, 'pulse');
});

test('sức chứa, nạp một phần, vùng an toàn và scenario không tự cộng điểm', () => {
  const night = new Night(tuning, 42, { ...empty,
    player: { carried: 9 }, motes: [[0, 0, 0], [0, 0, 0]], shades: [{ pos: [0, 0.5, 0] }],
    lanterns: [{ id: 'L3', pos: [0, 0, 0], lit: true }, { id: 'L1', pos: [2, 0, 0] }],
  });
  assert.equal(night.snapshot().score, 0);
  night.step({ ...initialInput(), interact: true });
  assert.equal(night.player.carried, 4);
  assert.equal(night.motes.length, 1);
  assert.equal(night.player.flames, 3);
  const [x, , z] = night.shades[0].pos;
  assert.ok(Math.hypot(x, z) >= tuning.safe_radius);
  assert.ok(Math.hypot(x - 2, z) >= tuning.safe_radius);
  const partial = new Night(tuning, 42, { ...empty, player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 0] }] });
  assert.equal(partial.step({ ...initialInput(), interact: true }).length, 1);
  assert.equal(partial.lanterns[0].lit, false);
  assert.equal(partial.lanterns[0].deposited, 2);
});

test('thua khi cạn sinh lực hoặc tới bình minh, có khoảng bất tử giữa các cú chạm', () => {
  const contact = file('contact.json', { ...empty, shades: [{ pos: [0, 10, 0] }] });
  const hit = run('contact', { scenario: contact, ticks: 300 });
  assert.equal(hit.status, 0, hit.stderr);
  assert.deepEqual(hit.events.filter((event) => event.name === 'player_hit').map(({ tick, data }) => [tick, data.flames, data.dropped]), [
    [1, 2, 0], [76, 1, 0], [151, 0, 0],
  ]);
  assert.deepEqual(hit.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.deepEqual(hit.end, { type: 'end', ticks: 151, state: 'lost', score: 0 });
  const dawn = run('dawn', { scenario: file('dawn.json', { ...empty, time_left_s: 0.05 }), 'snapshot-every': 1 });
  assert.equal(dawn.status, 0, dawn.stderr);
  assert.equal(dawn.end.ticks, 3);
  assert.deepEqual(dawn.events.at(-1).data, { result: 'lost', reason: 'dawn' });
  assert.equal(dawn.rows.at(-2).time_left_s, 0);
});

test('màn mặc định chơi được tới thắng và cùng seed cho JSONL giống từng byte', () => {
  const options = { inputs: fixture('night1-route'), ticks: 2500, 'snapshot-every': 120 };
  const runA = run('route-a', options);
  const runB = run('route-b', options);
  assert.equal(runA.status, 0, runA.stderr);
  assert.equal(runB.status, 0, runB.stderr);
  assert.equal(runA.raw, runB.raw);
  const lamps = runA.events.filter((event) => event.name === 'lantern_lit');
  assert.deepEqual(lamps.map((event) => event.data.lantern_id), ['L1', 'L3', 'L2', 'L5', 'L4']);
  assert.equal(runA.end.ticks, 2030);
  assert.equal(runA.end.state, 'won');
  const picked = runA.events.filter((event) => event.name === 'mote_picked').length;
  const hits = runA.events.filter((event) => event.name === 'player_hit').length;
  assert.equal(runA.end.score, picked * tuning.score.per_mote + lamps.length * tuning.score.per_lantern
    + Math.floor(tuning.night1_duration_s - runA.end.ticks / 60) * tuning.score.per_second_left
    + (tuning.flames - hits) * tuning.score.per_flame_left);
});

test('ticks bằng 0 và input/scenario sai cấu trúc trả mã 2 qua stderr', () => {
  const zero = run('zero', { ticks: 0 });
  assert.equal(zero.status, 0, zero.stderr);
  assert.deepEqual(zero.rows.map((row) => row.type), ['snapshot', 'end']);
  const duplicate = run('invalid-ticks', { inputs: file('invalid-inputs.json', { frames: [{ tick: 0 }, { tick: 0 }] }) });
  assert.equal(duplicate.status, 2);
  assert.match(duplicate.stderr, /frames\[1\]\.tick/);
  const wrongVector = run('invalid-pos', { scenario: file('invalid-scenario.json', { player: { pos: [0, 0] } }) });
  assert.equal(wrongVector.status, 2);
  assert.match(wrongVector.stderr, /player\.pos/);
});

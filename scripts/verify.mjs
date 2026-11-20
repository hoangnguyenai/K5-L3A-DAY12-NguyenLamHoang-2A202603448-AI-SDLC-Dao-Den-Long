import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import os from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const proof = join(root, 'docs', 'phase-4', 'proof');
mkdirSync(proof, { recursive: true });
function run(script, args = []) {
  const result = spawnSync(process.execPath, [...process.execArgv, script, ...args], {
    cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${script}\n${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
run('scripts/build.mjs');
for (const phase of [1, 2, 3, 4]) {
  const output = run(`tests/phase-${phase}.mjs`);
  writeFileSync(join(proof, `phase-${phase}.tap`), output);
  console.log(`Phase ${phase}: kiểm thử đạt.`);
}

const empty = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false };
const cases = [
  { name: 'drain', night: 1, ticks: 60, scenario: { ...empty,
    lanterns: [{ id: 'L1', lit: true, fuel: 25 }],
    shades: [{ id: 'S1', pos: [0, 0.8, 25], state: 'drain', target_lantern_id: 'L1' }] },
    frames: [], expectedEvent: 'fuel_drain' },
  { name: 'relight', night: 1, ticks: 1, scenario: { ...empty,
    player: { carried: 5, pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true, fuel: 1/60 }] },
    frames: [{ tick: 0, interact: true }], expectedEvent: 'lantern_lit' },
  { name: 'refuel', night: 1, ticks: 1, scenario: { ...empty,
    player: { carried: 12, successful_lights: 1, pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true, fuel: 17 }] },
    frames: [{ tick: 0, interact: true }], expectedEvent: 'refuel' },
  { name: 'pause', night: 1, ticks: 40, scenario: { ...empty, player: { pulse_cd_ticks: 100 } },
    frames: [{ tick: 0, pause: true }, { tick: 20, pause: false }, { tick: 30, pause: true }] },
  { name: 'dash', night: 1, ticks: 15, scenario: { ...empty, player: { pos: [0, 3, 0] } }, frames: [{ tick: 0, dash: true }] },
  { name: 'charm', night: 2, ticks: 30, scenario: { ...empty, player: { pos: [35, 0, 0] } }, frames: [
    { tick: 1, dash: true }, { tick: 2, dash: false }, { tick: 13, dash: true }] },
  { name: 'drifter-steal', night: 2, ticks: 1, scenario: { ...empty, player: { carried: 10 },
    drifters: [{ id: 'D1', pos: [0, 0.8, 0] }], shades: [{ id: 'S1', pos: [0, 0.8, 0] }] }, frames: [] },
  { name: 'drifter-drop', night: 2, ticks: 1, scenario: { ...empty, player: { carried: 3 },
    drifters: [{ id: 'D1', pos: [2, 0.8, 0], state: 'flee', stolen: 3 }] }, frames: [{ tick: 0, pulse: true }] },
  { name: 'fall', night: 2, ticks: 61, scenario: { ...empty, player: { pos: [35, -10.1, 8], carried: 7, invuln_ticks: 90 } }, frames: [] },
  { name: 'pad', night: 2, ticks: 85, scenario: { ...empty, player: { pos: [20, 0, 18] } }, frames: [] },
  { name: 'wind', night: 3, ticks: 1801, scenario: { ...empty, wind_enabled: true }, frames: [] },
];
for (const night of [1, 2, 3]) {
  const count = night + 4;
  cases.push({ name: `night-${night}-win`, night, ticks: 5,
    scenario: { ...empty, time_left_s: 1/60, player: { carried: 10, pos: night === 3 ? [0, 6, 6] : [0, 0, 0] },
      lanterns: Array.from({ length: count }, (_, index) => ({ id: `L${index + 1}`,
        ...(index === 0 ? { pos: night === 3 ? [0, 6, 6] : [0, 0, 0] } : { lit: true }) })) },
    frames: [{ tick: 0, interact: true }] });
}
const results = [];
for (const item of cases) {
  const scenario = join(proof, `${item.name}.scenario.json`);
  const inputs = join(proof, `${item.name}.inputs.json`);
  const output = join(proof, `${item.name}.jsonl`);
  writeFileSync(scenario, JSON.stringify(item.scenario, null, 2) + '\n');
  writeFileSync(inputs, JSON.stringify({ frames: item.frames }, null, 2) + '\n');
  const args = ['--seed', '42', '--night', String(item.night), '--ticks', String(item.ticks),
    '--scenario', scenario, '--inputs', inputs, '--out', output, '--snapshot-every', '10'];
  run('scripts/headless.mjs', args);
  const first = readFileSync(output);
  run('scripts/headless.mjs', args);
  if (!first.equals(readFileSync(output))) throw new Error(`Tính tất định sai: ${item.name}`);
  const rows = first.toString().trim().split('\n').map(JSON.parse);
  if (item.expectedEvent && !rows.some(row => row.name === item.expectedEvent)) throw new Error(item.name);
  if (item.name.endsWith('-win') && rows.at(-1).state !== 'won') throw new Error(item.name);
  results.push({ scenario: item.name, deterministic: true, end: JSON.parse(first.toString().trim().split('\n').at(-1)) });
}
const benchmarkScenario = join(proof, 'benchmark.scenario.json');
writeFileSync(benchmarkScenario, JSON.stringify({ player: { invuln_ticks: 100000 }, wind_enabled: false }) + '\n');
const start = performance.now();
run('scripts/headless.mjs', ['--seed', '42', '--night', '3', '--ticks', '18000', '--scenario', benchmarkScenario,
  '--out', join(proof, 'benchmark.jsonl')]);
const elapsed = performance.now() - start;
if (elapsed > 30000) throw new Error(`Headless quá chậm: ${elapsed}ms`);
writeFileSync(join(proof, 'summary.json'), JSON.stringify({
  node: process.version, platform: process.platform, cpu: os.cpus()[0]?.model,
  scenarios: results, benchmark: { ticks: 18000, elapsed_ms: elapsed, limit_ms: 30000,
    note: 'Bất tử đủ lâu và tắt gió để chạy trọn thời lượng, giữ lịch sinh thực thể mặc định.' },
}, null, 2) + '\n');
console.log(`${cases.length} scenario tất định; 18.000 tick chạy trong ${elapsed.toFixed(1)}ms.`);

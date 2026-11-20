import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { initialInput, Night } from '../src/simulation.mjs';
import { mapFor } from '../src/maps.mjs';

class InputError extends Error {}

function argsOf(args) {
  const allowed = ['seed', 'night', 'ticks', 'out', 'scenario', 'inputs', 'snapshot-every'];
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const key = flag.slice(2);
    const value = args[index + 1];
    if (!flag.startsWith('--') || !allowed.includes(key) || Object.hasOwn(options, key)
        || !value || value.startsWith('--')) throw new Error(`Tham số không hợp lệ: ${flag}`);
    options[key] = value;
  }
  const integer = (key, min, fallback) => {
    const value = options[key] ?? fallback;
    if (!/^-?\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value)) || Number(value) < min) {
      throw new Error(`--${key} phải là số nguyên từ ${min} trở lên`);
    }
    return Number(value);
  };
  if (!options.out) throw new Error('Thiếu --out');
  if (integer('night', 1) > 3) throw new Error('--night phải là 1, 2 hoặc 3');
  return {
    ...options,
    night: integer('night', 1),
    seed: integer('seed', Number.MIN_SAFE_INTEGER),
    ticks: integer('ticks', 0),
    interval: integer('snapshot-every', 1, '10'),
  };
}

function requireValue(valid, path) {
  if (!valid) throw new InputError(`${path} không hợp lệ`);
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBoolean = (value) => typeof value === 'boolean';
const integerIn = (value, min, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
const isVector = (value, count, max = Infinity) => Array.isArray(value) && value.length === count
  && value.every((coordinate) => Number.isFinite(coordinate) && Math.abs(coordinate) <= max);
const optional = (obj, key, test, path) => {
  if (Object.hasOwn(obj, key)) requireValue(test(obj[key]), `${path}.${key}`);
};

function validateScenario(scenario, tuning, night) {
  requireValue(isObject(scenario), 'scenario');
  optional(scenario, 'player', isObject, 'scenario');
  if (scenario.player) {
    optional(scenario.player, 'pos', (pos) => isVector(pos, 3), 'player');
    optional(scenario.player, 'carried', (count) => integerIn(count, 0, tuning.carry_capacity), 'player');
    optional(scenario.player, 'flames', (count) => integerIn(count, 0), 'player');
    for (const key of ['invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) {
      optional(scenario.player, key, (count) => integerIn(count, 0), 'player');
    }
  }
  optional(scenario, 'random_motes', isBoolean, 'scenario');
  optional(scenario, 'random_shades', isBoolean, 'scenario');
  optional(scenario, 'random_drifters', isBoolean, 'scenario');
  optional(scenario, 'wind_enabled', isBoolean, 'scenario');
  optional(scenario, 'time_left_s', (value) => Number.isFinite(value) && value >= 0, 'scenario');
  optional(scenario, 'motes', (motes) => Array.isArray(motes) && motes.every((mote) => isVector(mote, 3)
    || (isObject(mote) && isVector(mote.pos, 3) && ['random', 'dropped'].includes(mote.kind ?? 'random'))), 'scenario');
  optional(scenario, 'shades', Array.isArray, 'scenario');
  const shadeIds = new Set();
  for (const [index, shade] of (scenario.shades ?? []).entries()) {
    const path = `shades[${index}]`;
    requireValue(isObject(shade) && isVector(shade.pos, 3), `${path}.pos`);
    optional(shade, 'id', (id) => typeof id === 'string' && id.length > 0 && !shadeIds.has(id), path);
    if (shade.id) shadeIds.add(shade.id);
    optional(shade, 'state', (state) => ['spawning', 'wander', 'chase', 'recoil', 'stunned'].includes(state), path);
    optional(shade, 'state_ticks_left', (count) => integerIn(count, 0), path);
  }
  for (const key of ['drifters', 'charms']) {
    optional(scenario, key, Array.isArray, 'scenario');
    const ids = new Set();
    for (const [index, entity] of (scenario[key] ?? []).entries()) {
      const path = `${key}[${index}]`;
      requireValue(isObject(entity) && typeof entity.id === 'string' && entity.id.length > 0 && !ids.has(entity.id), `${path}.id`);
      ids.add(entity.id);
      if (key === 'drifters') {
        requireValue(isVector(entity.pos, 3), `${path}.pos`);
        optional(entity, 'state', (state) => ['idle', 'chase', 'flee', 'removed'].includes(state), path);
        optional(entity, 'stolen', (count) => integerIn(count, 0, 3), path);
        optional(entity, 'state_ticks_left', (count) => integerIn(count, 0), path);
      } else {
        optional(entity, 'pos', (pos) => isVector(pos, 3), path);
        optional(entity, 'available', isBoolean, path);
        optional(entity, 'respawn_ticks', (count) => integerIn(count, 0), path);
        optional(entity, 'respawn_s', (value) => Number.isFinite(value) && value >= 0, path);
      }
    }
  }
  optional(scenario, 'lanterns', Array.isArray, 'scenario');
  const remainingIds = new Set(mapFor(night).lanterns.map((_, index) => `L${index + 1}`));
  for (const [index, lantern] of (scenario.lanterns ?? []).entries()) {
    const path = `lanterns[${index}]`;
    requireValue(isObject(lantern) && remainingIds.delete(lantern.id), `${path}.id`);
    optional(lantern, 'pos', (pos) => isVector(pos, 3), path);
    optional(lantern, 'lit', isBoolean, path);
    optional(lantern, 'deposited', (count) => integerIn(count, 0, tuning.lantern_cost), path);
  }
  return scenario;
}

function validateInputs(inputs) {
  requireValue(isObject(inputs) && Array.isArray(inputs.frames), 'inputs.frames');
  let previous = -1;
  for (const [index, frame] of inputs.frames.entries()) {
    const path = `frames[${index}]`;
    requireValue(isObject(frame) && integerIn(frame.tick, previous + 1), `${path}.tick`);
    optional(frame, 'move', (move) => isVector(move, 2, 1), path);
    optional(frame, 'cam_yaw_deg', Number.isFinite, path);
    for (const control of ['jump', 'interact', 'pulse', 'dash', 'pause']) optional(frame, control, isBoolean, path);
    previous = frame.tick;
  }
  return inputs.frames;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new InputError(`${path}: ${error.message}`);
  }
}

async function main() {
  const options = argsOf(process.argv.slice(2));
  const { tuning } = JSON.parse(await readFile(new URL('../game.contract.json', import.meta.url), 'utf8'));
  const scenario = options.scenario ? validateScenario(await readJson(options.scenario), tuning, options.night) : {};
  const frames = options.inputs ? validateInputs(await readJson(options.inputs)) : [];
  const night = new Night(tuning, options.seed, scenario, options.night);
  const input = initialInput();
  let nextFrame = 0;
  const output = createWriteStream(options.out, { encoding: 'utf8' });
  await once(output, 'open');
  const completed = finished(output);
  completed.catch(() => {});
  const write = (row) => output.write(`${JSON.stringify(row)}\n`);
  write(night.snapshot());
  while (night.tick < options.ticks && ['playing', 'paused'].includes(night.state)) {
    if (frames[nextFrame]?.tick === night.tick) Object.assign(input, frames[nextFrame++]);
    let ready = true;
    for (const row of night.step(input)) if (!write(row)) ready = false;
    if (night.tick % options.interval === 0 && !write(night.snapshot())) ready = false;
    if (!ready) await once(output, 'drain');
  }
  write({ type: 'end', ticks: night.tick, state: night.state, score: night.score });
  output.end();
  await completed;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = error instanceof InputError ? 2 : 1;
});

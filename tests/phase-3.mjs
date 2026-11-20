import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { Night, initialInput } from '../src/simulation.mjs';

const { tuning } = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url)));
const game = (scenario, night = 1) => new Night(tuning, 42, {
  random_motes: false, random_shades: false, random_drifters: false, ...scenario,
}, night);
const step = (night, input = {}) => night.step({ ...initialInput(), ...input });
const lamp = (fuel) => ({ id: 'L1', lit: true, fuel, pos: [0, 0, 0] });
const drain = (id) => ({ id, state: 'drain', target_lantern_id: 'L1', pos: [1, 0.8, 0] });

test('extinction and relight in one tick, relight points and capacity cap', () => {
  const night = game({ lanterns: [lamp(1/60)], player: { carried: 6, successful_lights: 5 } });
  const events = step(night, { interact: true });
  assert.deepEqual(events.map(e => e.name), ['night_start', 'lantern_out', 'deposit', 'lantern_lit']);
  assert.equal(events.at(-1).data.relight, true);
  assert.deepEqual(night.snapshot().lanterns[0], { ...lamp(100), deposited: 5, ever_lit: true, relit_count: 1 });
  assert.equal(night.capacity, 20);
  assert.equal(night.player.carried, 1);
  assert.equal(night.score, 65);
});

test('first light, capped refuel and full lamp eligibility', () => {
  const night = game({ lanterns: [{ id: 'L1', pos: [0, 0, 0] }], player: { carried: 10 } });
  assert.equal(step(night, { interact: true }).at(-1).data.relight, false);
  assert.equal(night.nearbyLantern(), undefined);
  assert.equal(night.capacity, 12);
  step(night);
  night.player.carried = 2;
  assert.deepEqual(step(night, { interact: true }).at(-1).data, { lantern_id: 'L1', amount: 1, fuel: 100 });
  assert.equal(night.score, 155);
});

test('stacked drain, pause and 60-tick event cadence', () => {
  const night = game({ player: { pos: [20, 0, 0] }, lanterns: [lamp(25)], shades: [drain('S1'), drain('S2')] });
  step(night, { pause: true });
  step(night);
  assert.equal(night.snapshot().lanterns[0].fuel, 25);
  step(night, { pause: true });
  for (let i = 1; i < 59; i++) assert.ok(!step(night).some(e => e.name === 'fuel_drain'));
  assert.deepEqual(step(night).filter(e => e.name === 'fuel_drain').map(e => e.data.fuel), [14, 14]);
});

test('weak light attracts wander, draining shade chases and pulse earns 15', () => {
  const night = game({ player: { pos: [20, 0, 0], carried: 3 }, lanterns: [lamp(20)],
    shades: [{ ...drain('S1'), state: 'wander' }] });
  step(night);
  assert.equal(night.shades[0].state, 'drain');
  night.player.pos = [5, 0, 0];
  step(night, { pulse: true });
  assert.equal(night.shades[0].state, 'stunned');
  assert.equal(night.score, 15);
  const chasing = game({ lanterns: [lamp(25)], shades: [drain('S1')] });
  step(chasing);
  assert.notEqual(chasing.shades[0].state, 'drain');
});

test('refuel restores protection at exactly 30, suppressing contact', () => {
  const night = game({ lanterns: [lamp(20.1)], shades: [drain('S1')], player: { carried: 1 } });
  step(night, { interact: true });
  assert.equal(night.lanterns[0].fuelUnits, 1800);
  assert.equal(night.shades[0].state, 'wander');
  assert.equal(night.player.flames, 3);
});

test('dawn uses final lamps, floors fuel and gives death priority on every island', () => {
  for (const [night, required] of [[1,3],[2,4],[3,5]]) {
    const lanterns = Array.from({length: required}, (_, i) => ({ id: 'L' + (i+1), lit: true }));
    const won = game({ lanterns, time_left_s: 1/60 }, night);
    assert.equal(step(won).at(-1).data.reason, 'dawn_survived');
    assert.equal(won.score, required * 149 + 150);
    assert.equal(step(game({ lanterns, player: { flames: 0 }, time_left_s: 1/60 }, night)).at(-1).data.reason, 'no_flames');
    lanterns[0].fuel = 1/60;
    assert.equal(step(game({ lanterns, time_left_s: 1/60 }, night)).at(-1).data.reason, 'dawn');
  }
  const all = game({ lanterns: Array.from({length: 5}, (_, i) => ({ id: 'L' + (i+1), lit: true })) });
  step(all);
  assert.equal(all.state, 'playing');
  assert.equal(all.capacity, 10);
});

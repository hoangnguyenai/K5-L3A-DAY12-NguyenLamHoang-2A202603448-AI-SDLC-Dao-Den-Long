import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initialInput, Night } from '../src/simulation.mjs';

const { tuning } = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
const empty = { random_motes: false, random_shades: false, random_drifters: false };
const input = (changes) => ({ ...initialInput(), ...changes });

test('hồi quy di chuyển theo camera và chuẩn hóa đường chéo với số chuẩn', () => {
  const night = new Night(tuning, 42, empty);
  for (let index = 0; index < 10; index++) night.step(input({ move: [0, 1], cam_yaw_deg: 90 }));
  assert.deepEqual(night.snapshot().player.pos, [1, 0, 0]);
  for (let index = 0; index < 10; index++) night.step(input({ move: [1, 1] }));
  assert.deepEqual(night.snapshot().player.pos, [1.707, 0, 0.707]);
});

test('hồi quy nhặt theo XZ và độ cao, sức chứa và nạp nhiều lần', () => {
  const night = new Night(tuning, 42, { ...empty, player: { carried: 8 },
    motes: [[0, 1.5, 1], [0, 1.501, 0], [0, 0, 1.001], [0, 0, 0]],
    lanterns: [{ id: 'L1', pos: [2, 0, 0] }],
  });
  night.step(input({ interact: true }));
  assert.equal(night.player.carried, 0);
  assert.equal(night.motes.length, 2);
  assert.equal(night.lanterns[0].lit, true);
  assert.equal(night.score, 150);
});

test('hồi quy thắng, thua và không cộng điểm khi dựng scenario', () => {
  const lanterns = Array.from({ length: 5 }, (_, index) => ({ id: 'L' + (index + 1), lit: true }));
  const won = new Night(tuning, 42, { ...empty, lanterns, time_left_s: 1 / 60 });
  assert.equal(won.score, 0);
  won.step(input({}));
  assert.equal(won.state, 'won');
  assert.equal(won.score, 895);
  const lost = new Night(tuning, 42, { ...empty, lanterns, player: { flames: 0 } });
  assert.equal(lost.step(input({})).at(-1).data.reason, 'no_flames');
  const dawn = new Night(tuning, 42, { ...empty, time_left_s: 1 / 60 });
  assert.equal(dawn.step(input({})).at(-1).data.reason, 'dawn');
});

test('hồi quy tính tất định cả id tự sinh', () => {
  const a = new Night(tuning, 2026);
  const b = new Night(tuning, 2026);
  for (let tick = 0; tick < 900; tick++) {
    assert.deepEqual(a.step(input({})), b.step(input({})));
    assert.deepEqual(a.snapshot(), b.snapshot());
  }
});

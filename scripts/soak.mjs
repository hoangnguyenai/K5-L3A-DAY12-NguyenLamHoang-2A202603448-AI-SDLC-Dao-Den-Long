import { readFile, writeFile } from 'node:fs/promises';
import { Night, initialInput } from '../src/simulation.mjs';
import { options } from './options.mjs';
const { seed, nights, out } = options({ seed: 7, nights: 10, out: 'soak.json' });
const { tuning } = JSON.parse(await readFile(new URL('../game.contract.json', import.meta.url)));
const rss = () => process.memoryUsage.rss() / 1048576;
const start = performance.now();
const results = [];
let crashes = 0, mem_start_mb;
for (let i = 0; i < nights; i++) {
  let game = new Night(tuning, seed + i, {}, 1 + i % 3);
  mem_start_mb ??= rss();
  let state = (seed + i) >>> 0;
  const random = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296);
  const input = initialInput();
  try {
    while (game.state === 'playing') {
      if (game.tick % 30 === 0) {
        const angle = random() * Math.PI * 2;
        input.move = [Math.cos(angle), Math.sin(angle)];
      }
      game.step({ ...input, jump: random() < .05, dash: random() < .03, pulse: random() < .02, interact: random() < .1 });
    }
    results.push(game.state);
  } catch (error) { crashes++; results.push('crashed'); console.error(error); }
  game = null;
  global.gc?.();
}
const report = { nights, crashes, results, mem_start_mb, mem_end_mb: rss(), duration_s: (performance.now() - start) / 1000 };
await writeFile(out, JSON.stringify(report, null, 2) + '\n');
console.log(report);
if (crashes || report.mem_end_mb > 1.2 * mem_start_mb) process.exitCode = 1;

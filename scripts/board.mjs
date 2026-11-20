import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
const path = process.env.LANTERN_BOARD ?? join(homedir(), '.dao-den-long', 'leaderboard.json');
export async function board() {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return { entries: [] }; throw e; }
}
let queue = Promise.resolve();
export function saveEntry({name, score, nights_won, seed}) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_]{3,12}$/.test(name)
    || !Number.isSafeInteger(score) || score < 0 || !Number.isInteger(nights_won)
    || nights_won < 0 || nights_won > 3 || !Number.isSafeInteger(seed)) throw Error('Điểm hoặc tên không hợp lệ');
  const entry = {name, score, nights_won, seed, achieved_at: new Date().toISOString()};
  const task = queue.then(async () => {
    const data = await board();
    data.entries.push(entry);
    data.entries.sort((a,b) => b.score - a.score || a.achieved_at.localeCompare(b.achieved_at));
    data.entries = data.entries.slice(0,10);
    await mkdir(dirname(path), {recursive:true});
    await writeFile(path + '.tmp', JSON.stringify(data, null, 2));
    await rename(path + '.tmp', path);
    return data;
  });
  queue = task.catch(() => {});
  return task;
}

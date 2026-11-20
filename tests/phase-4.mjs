import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('top ten survives restart, ties preserve first entry, export reads same disk file', async () => {
  const directory = await mkdtemp(join(tmpdir(),'lantern-ranking-'));
  process.env.LANTERN_BOARD = join(directory,'board.json');
  try {
    const {board,saveEntry} = await import('../scripts/board.mjs');
    assert.deepEqual(await board(), {entries:[]});
    const base = {name:'May',score:12,seed:42,nights_won:1};
    for (const name of ['a','May!','way_too_long_12']) assert.throws(()=>saveEntry({...base,name}));
    await Promise.all(Array.from({length:12},(_,i)=>saveEntry({...base,name:'May'+i,score:i < 10 ? i : 99})));
    const {entries} = await board();
    assert.equal(entries.length,10);
    assert.deepEqual(entries.slice(0,2).map(e=>e.name),['May10','May11']);
    assert.ok(entries.every(e=>e.achieved_at.endsWith('Z')));
    const dest=join(directory,'export.json');
    const result=spawnSync(process.execPath,['scripts/serve.mjs','--export-leaderboard',dest],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(await readFile(dest)),{entries});
  } finally {await rm(directory,{recursive:true,force:true});}
});

import { cp, mkdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const { contract_version } = JSON.parse(await readFile(new URL('game.contract.json', root), 'utf8'));
if (contract_version !== '1.2') throw new Error(`Phiên bản contract không được hỗ trợ: ${contract_version}`);
await mkdir(dist, { recursive: true });
for (const path of ['index.html', 'style.css', 'src', 'game.contract.json']) {
  await cp(new URL(path, root), new URL(path, dist), { recursive: true });
}
console.log('Đã tạo bản web trong dist/.');

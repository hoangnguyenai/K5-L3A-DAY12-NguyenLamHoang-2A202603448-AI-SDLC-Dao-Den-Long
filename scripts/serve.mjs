import { createServer } from 'node:http';
import { board, saveEntry } from './board.mjs';
import { readFile, writeFile } from 'node:fs/promises';

const directory = new URL('../dist/', import.meta.url);
const contentTypes = new Map([
  ['.html', 'text/html'], ['.css', 'text/css'], ['.mjs', 'text/javascript'], ['.json', 'application/json'],
]);
if (process.argv[2] === '--export-leaderboard') {
  if (!process.argv[3]) throw Error('Thiếu tên tệp xuất.');
  await writeFile(process.argv[3], JSON.stringify(await board(), null, 2) + '\n');
  process.exit(0);
}
await readFile(new URL('index.html', directory)).catch((error) => {
  if (error.code === 'ENOENT') throw new Error('Chạy node scripts/build.mjs trước.');
  throw error;
});
const port = Number(process.env.LANTERN_PORT ?? 4173);
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (path === '/leaderboard') {
    try {
      let data;
      if (request.method === 'GET') data = await board();
      else if (request.method === 'POST' && request.headers.origin === 'http://'+request.headers.host
        && request.headers['content-type'] === 'application/json') {
        let body = '';
        for await (const chunk of request) { body += chunk; if (body.length > 4096) throw Error('Dữ liệu quá dài'); }
        data = await saveEntry(JSON.parse(body));
      } else { response.writeHead(405).end(); return; }
      response.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(data));
    } catch (e) { response.writeHead(400).end('Không thể đọc hoặc lưu bảng điểm.'); }
    return;
  }
  const extension = path.slice(path.lastIndexOf('.'));
  if (!/^\/(?:src\/)?[a-zA-Z0-9._-]+$/.test(path) || !contentTypes.has(extension)) {
    response.writeHead(404).end('Không tìm thấy tệp.');
    return;
  }
  try {
    const content = await readFile(new URL(path.slice(1), directory));
    response.writeHead(200, { 'Content-Type': `${contentTypes.get(extension)}; charset=utf-8` }).end(content);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Không đọc được tệp.');
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Đảo Đèn Lồng: http://127.0.0.1:${server.address().port}`);
});

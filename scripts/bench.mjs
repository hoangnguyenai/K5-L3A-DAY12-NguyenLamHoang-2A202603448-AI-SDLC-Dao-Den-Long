import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform, release } from 'node:os';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { options } from './options.mjs';

const started = Date.now() - Math.round(process.uptime()*1000);
const {seed,duration,out} = options({seed:42,duration:30,out:'bench.json'});
const token = randomUUID();
const profile = await mkdtemp(join(tmpdir(),'lantern-bench-'));
const executable = process.env.LANTERN_CHROME ?? ({win32:'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}[platform()] ?? 'google-chrome');
const report = Promise.withResolvers();
const server = createServer(async (req,res) => {
  const {pathname} = new URL(req.url,'http://localhost');
  try {
    if (req.method === 'POST' && pathname === '/result/'+token) {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length>16384) throw Error('Result too large'); }
      const result = JSON.parse(body);
      res.end('OK');
      if (result.error) report.reject(Error(result.error)); else report.resolve(result);
      return;
    }
    if (!/^\/(bench\.html|game\.contract\.json|src\/[\w-]+\.mjs)$/.test(pathname)) {res.writeHead(404).end();return;}
    const data = await readFile(new URL('..'+pathname,import.meta.url));
    res.setHeader('Content-Type',pathname.endsWith('mjs')?'text/javascript':pathname.endsWith('html')?'text/html':'application/json');res.end(data);
  } catch(e) {res.writeHead(500).end(); report.reject(e);}
});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const url = 'http://127.0.0.1:'+server.address().port+'/bench.html?'+new URLSearchParams({seed,duration,start:started,token});
const chrome = spawn(executable,['--no-first-run','--no-default-browser-check','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion','--disable-frame-rate-limit','--disable-gpu-vsync',
  '--force-device-scale-factor=1','--window-size=1280,720','--user-data-dir='+profile,'--app='+url],{stdio:'ignore'});
chrome.on('error',e=>report.reject(e));
chrome.on('exit',code=>report.reject(Error('Chrome exited '+code)));
const timeout = setTimeout(()=>report.reject(Error('Benchmark timed out')), (duration+45)*1000);
try {
  const data = await report.promise;
  data.os = platform()+' '+release(); data.vsync_off = true;
  await writeFile(out,JSON.stringify(data,null,2)+'\n');console.log(data);
} finally {
  clearTimeout(timeout);server.close();server.closeAllConnections();
  chrome.kill();
  await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:200}).catch(()=>{});
}

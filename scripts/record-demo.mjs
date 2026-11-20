import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Capture the rendered game window, including its HUD, and encode those frames locally.
export async function recordDemo({command,evaluate,click,waitFor,root,gameUrl}) {
  await command('Page.navigate',{url:gameUrl});
  await waitFor("document.getElementById('start')?.disabled === false");
  await evaluate(`(() => {
    const canvas=document.createElement('canvas');
    canvas.width=1280;canvas.height=720;
    const ctx=canvas.getContext('2d');
    const stream=canvas.captureStream(15);
    const mime=['video/mp4;codecs=avc1.42001E','video/mp4;codecs=vp9','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    if (!mime) throw Error('Chrome MP4 encoder unavailable');
    const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2300000});
    const chunks=[];
    recorder.ondataavailable=e=>chunks.push(e.data);
    window.finishVideo=()=>new Promise(resolve=>{
      recorder.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(new Blob(chunks,{type:'video/mp4'}));
      };recorder.stop();
    });
    window.videoFrame=async data=>{
      const img=new Image(); img.src='data:image/jpeg;base64,'+data;
      await img.decode();ctx.drawImage(img,0,0,1280,720);
    };
    window.videoCard=(title,lines)=>{
      ctx.fillStyle='#0E1430';ctx.fillRect(0,0,1280,720);
      ctx.fillStyle='#FFE9B0';ctx.font='44px sans-serif';ctx.fillText(title,72,122);
      ctx.font='28px sans-serif';ctx.fillStyle='#F5F1E6';
      lines.forEach((line,i)=>ctx.fillText(line,72,224+62*i));
    };
    recorder.start();
  })()`);
  async function film(seconds) {
    const until=Date.now()+seconds*1000;
    while(Date.now()<until) {
      const {data}=await command('Page.captureScreenshot',{format:'jpeg',quality:70});
      await evaluate('videoFrame('+JSON.stringify(data)+')');
      await new Promise(r=>setTimeout(r,65));
    }
  }
  await film(1);
  await click('start');await film(1.5);await click('enter-night');
  const send=(type,code,key)=>command('Input.dispatchKeyEvent',{type,code,key});
  await send('keyDown','KeyW','w');await film(4.2);await send('keyUp','KeyW','w');
  await send('keyDown','KeyE','e');await send('keyUp','KeyE','e');await film(1.5);
  await click('pause');await film(1.2);
  const read = async file=>JSON.parse(await readFile(join(root,file),'utf8'));
  const bench=await read('bench.json'),soak=await read('soak.json'),proof=await read('docs/phase-4/proof/summary.json');
  async function card(title,lines) {
    for(let i=0;i<6;i++) {
      await evaluate('videoCard('+JSON.stringify(title)+','+JSON.stringify(lines)+')');
      await new Promise(r=>setTimeout(r,550));
    }
  }
  await card('Kiểm thử · Contract v1.3',[
    'node scripts/verify.mjs',proof.scenarios.length+' kịch bản headless · mỗi kịch bản chạy hai lần',
    'Đêm 3: '+proof.benchmark.ticks+' tick trong '+(proof.benchmark.elapsed_ms/1000).toFixed(2)+' giây',
    'Soak: '+soak.nights+' Đêm · '+soak.crashes+' crash',
    'RSS: '+soak.mem_start_mb.toFixed(1)+' → '+soak.mem_end_mb.toFixed(1)+' MiB']);
  await card('Benchmark · 1280 × 720',[
    'node scripts/bench.mjs --seed 42 --duration 30 --out bench.json',
    '200 Bóng Mực · 100 đom đóm · 3 đèn sáng',
    bench.avg_fps.toFixed(1)+' FPS trung bình · '+bench.p1_low_fps.toFixed(1)+' FPS ở 1% thấp',
    'p95: '+bench.frame_ms_p95.toFixed(1)+' ms · tải: '+bench.load_ms+' ms',
    'Kết quả máy cục bộ · chi tiết renderer trong bench.json']);
  const data=await evaluate('finishVideo()');
  const dir=join(root,'docs','demo');await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'demo.mp4'),Buffer.from(data,'base64'));
}

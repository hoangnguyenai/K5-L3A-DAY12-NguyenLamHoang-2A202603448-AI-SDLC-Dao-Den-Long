import { Night } from './simulation.mjs';
import { Scene } from './scene.mjs';
const query = new URLSearchParams(location.search);
async function report(result) {
  const r = await fetch('/result/'+query.get('token'), { method:'POST', body:JSON.stringify(result) });
  if (!r.ok) throw Error('Could not save benchmark');
}
async function run() {
  const {tuning} = await (await fetch('/game.contract.json')).json();
  const game = new Night(tuning, Number(query.get('seed')), { random_motes:false, random_shades:false,
    lanterns:['L1','L2','L3'].map(id => ({id,lit:true})) });
  const point = (y) => {
    const r = 39 * Math.sqrt(game.random()), a = game.random() * 2 * Math.PI;
    return [r*Math.cos(a),y,r*Math.sin(a)];
  };
  for (let i=0;i<200;i++) game.shades.push(game.makeShade({id:'S'+(i+1),pos:point(.8),state:'wander'}));
  for (let i=0;i<100;i++) game.motes.push(game.makeMote(point(0)));
  const scene = new Scene(document.querySelector('canvas'));
  const gl = scene.gl;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = [gl.getParameter(gl.VERSION), ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), navigator.userAgent].filter(Boolean).join(' · ');
  const duration = Number(query.get('duration')) * 1000;
  const frames = [];
  let first, previous, load, simulated = 0;
  function frame() {
    try {
      const now = performance.now();
      first ??= now;
      const t = (now-first)/1000;
      while (simulated < Math.floor(t*60)) {
        game.updateSafeZones();
        game.moveShades(true);
        simulated++;
      }
      const a = t * Math.PI * 2 / 15;
      scene.render(game,0,t,Infinity,false,{eye:[30*Math.cos(a),15,30*Math.sin(a)],target:[0,0,0]});
      if (load === undefined) { gl.finish(); load = Date.now() - Number(query.get('start')); }
      if (now >= first + 3000) {
        if (previous !== undefined && now <= first+3000+duration) frames.push(now-previous);
        previous = now;
      }
      if (now < first + 3000 + duration) return requestAnimationFrame(frame);
      if (!frames.length) throw Error('No measured frames');
      frames.sort((a,b)=>a-b);
      const sum = values => values.reduce((a,b)=>a+b,0);
      const worst = frames.slice(-Math.ceil(.01*frames.length));
      report({contract_version:'1.3',avg_fps:1000*frames.length/sum(frames),
        p1_low_fps:1000*worst.length/sum(worst), frame_ms_p95:frames[Math.ceil(.95*frames.length)-1],
        frames:frames.length,load_ms:load,peak_mem_mb:null,vsync_off:false,renderer});
    } catch (e) { report({error:String(e)}); }
  }
  requestAnimationFrame(frame);
}
run().catch(e=>report({error:String(e)}));

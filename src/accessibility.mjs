const controls = {
  KeyW:['Tiến','ArrowUp'], KeyS:['Lùi','ArrowDown'], KeyA:['Trái','ArrowLeft'], KeyD:['Phải','ArrowRight'],
  Space:['Nhảy'], ShiftLeft:['Lướt','ShiftRight'], KeyE:['Tương tác'], KeyF:['Tỏa sáng'],
  Escape:['Tạm dừng','KeyP'], KeyQ:['Xoay trái'], KeyR:['Xoay phải'],
};
export const keyLabel = code => code.replace(/^Key|^Digit/g,'').replace('ShiftLeft','Shift').replace('Escape','Esc');
export function bindAccess(storage, scene) {
  const state = { bindings:{}, reduced:matchMedia('(prefers-reduced-motion: reduce)').matches, large:false };
  try { Object.assign(state,JSON.parse(storage.getItem('lantern.access'))); } catch {}
  const $ = id => document.getElementById(id);
  const codeFor = original => state.bindings[original] ?? original;
  function resolve(code) {
    return Object.keys(controls).find(key => codeFor(key) === code || (!state.bindings[key] && controls[key][1] === code));
  }
  let armed;
  const buttons = new Map();
  const status = $('settings-status');
  function refresh(save) {
    for (const [key,button] of buttons) button.textContent = controls[key][0]+' · '+(armed === key ? 'Nhấn phím…' : keyLabel(codeFor(key)));
    for (const key of ['reduced','large']) $(key).checked = state[key];
    document.documentElement.classList.toggle('large',state.large);
    document.body.classList.toggle('reduced',state.reduced);
    scene.reduced = state.reduced;
    const hints = document.querySelectorAll('.keys kbd');
    const groups = [['KeyW','KeyA','KeyS','KeyD'],['Space'],['ShiftLeft'],['KeyQ'],['KeyR'],['KeyE'],['KeyF']];
    hints.forEach((el,i)=>el.textContent = groups[i].map(key=>keyLabel(codeFor(key))).join(' '));
    document.querySelector('#pause kbd').textContent = keyLabel(codeFor('Escape'));
    if (save) {
      try {storage.setItem('lantern.access',JSON.stringify(state));status.textContent='Đã lưu.';}
      catch {status.textContent='Đã áp dụng trong phiên này.';}
    }
  }
  for (const key of Object.keys(controls)) {
    const button = document.createElement('button');
    button.type='button'; button.className='plain';
    button.onclick = () => {armed=key;refresh(false);};
    $('bindings').append(button);buttons.set(key,button);
  }
  $('settings').addEventListener('keydown',event=>{
    if (!armed || event.repeat) return;
    event.preventDefault();event.stopPropagation();
    const other = resolve(event.code);
    if (other && other !== armed) {status.textContent='Phím đã dùng cho '+controls[other][0]+'. Chọn phím khác.';return;}
    if (event.code === armed) delete state.bindings[armed]; else state.bindings[armed]=event.code;
    armed=null;refresh(true);
  });
  $('settings').addEventListener('close',()=>{armed=null;refresh(false);});
  $('reset-keys').onclick=()=>{state.bindings={};armed=null;refresh(true);};
  for (const key of ['reduced','large']) $(key).onchange=()=>{state[key]=$(key).checked;refresh(true);};
  refresh(false);
  return {resolve, label:key=>keyLabel(codeFor(key))};
}

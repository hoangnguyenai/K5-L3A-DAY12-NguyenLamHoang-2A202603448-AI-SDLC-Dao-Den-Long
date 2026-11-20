export function initRanking() {
  const $ = id => document.getElementById(id);
  let entry;
  const form = $('score-form');
  $('open-board').onclick = async () => {
    $('board').showModal();
    const list = $('entries');
    list.textContent = 'Đang đọc…';
    try {
      const r = await fetch('/leaderboard',{cache:'no-store'});
      if (!r.ok) throw Error();
      const {entries} = await r.json();
      list.replaceChildren();
      for (const item of entries) {
        const row = document.createElement('li');
        row.textContent = item.name+' · '+item.score+' điểm · '+item.nights_won+'/3 Đêm';
        list.append(row);
      }
      $('board-status').textContent = entries.length ? '' : 'Chưa có điểm được lưu.';
    } catch {list.replaceChildren();$('board-status').textContent='Không đọc được bảng điểm cục bộ.';}
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const current = entry;
    $('save-score').disabled=true;
    try {
      const r = await fetch('/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...current,name:$('player-name').value})});
      if (!r.ok) throw Error();
      if (entry === current) $('save-status').textContent='Đã lưu kết quả.';
    } catch {if (entry === current) {$('save-status').textContent='Lưu thất bại. Hãy thử lại.';$('save-score').disabled=false;}}
  };
  return value => {
    entry=value; form.hidden=!value; form.reset(); $('save-status').textContent='';$('save-score').disabled=false;
  };
}

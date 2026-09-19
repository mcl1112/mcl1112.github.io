// ============================================================
// FORMATADORES, DATAS E HORÁRIOS
// ============================================================
function money(v){ return v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}); }
function pad(n){ return String(n).padStart(2,'0'); }
function dateKeyFor(date){ return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`; }
function slotKeyFor(date){ return `${dateKeyFor(date)}-${pad(date.getHours())}-${pad(date.getMinutes())}`; }
function timeLabel(date){ return date.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}); }
function startOfDay(d){ const x = new Date(d); x.setHours(0,0,0,0); return x; }
function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

function dayLabel(date, offset){
  if(offset===0) return 'Hoje';
  if(offset===1) return 'Amanhã';
  const wd = date.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');
  return `${wd.charAt(0).toUpperCase()+wd.slice(1)} ${pad(date.getDate())}/${pad(date.getMonth()+1)}`;
}

function generateSlots(targetDate){
  const cfg = state.config;
  const now = new Date();
  const isToday = sameDay(targetDate, now);
  const open = new Date(targetDate); open.setHours(cfg.openHour, cfg.openMinute, 0, 0);
  const close = new Date(targetDate); close.setHours(cfg.closeHour, cfg.closeMinute, 0, 0);
  let start;
  if(isToday){
    const earliest = new Date(now.getTime() + cfg.minLead*60000);
    start = earliest > open ? earliest : open;
  } else { start = new Date(open); }

  if(start > close) return [];
  const rem = start.getMinutes() % cfg.slotInterval;
  if(rem !== 0){ start = new Date(start.getTime() + (cfg.slotInterval-rem)*60000); }
  start.setSeconds(0,0);

  const slots = [];
  let cursor = new Date(start);
  while(cursor <= close){
    slots.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + cfg.slotInterval*60000);
  }
  return slots;
}

function countForSlot(key){
  return state.orders.filter(o => o.slotKey === key && o.status !== 'cancelado').length;
}

function escapeHtml(str){
  return String(str==null?'':str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function starsHtml(rating, size){
  size = size || 16;
  let out = '';
  for(let i=1;i<=5;i++){
    out += `<span style="font-size:${size}px; color:${i<=rating?'#FFB800':'#E5E7EB'};">★</span>`;
  }
  return out;
}

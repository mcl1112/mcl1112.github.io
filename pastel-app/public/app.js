// ---------- CONFIGURAÇÕES E ESTADO ----------
const SOUND_KEY = 'pastelaria-sound-v2';
const EMPLOYEE_PASSCODE = '1234';

const DEFAULT_CONFIG = {
  slotInterval: 15,
  maxPerSlot: 5,
  minLead: 20,
  openHour: 11, openMinute: 0,
  closeHour: 21, closeMinute: 0,
  maxDaysAhead: 2
};

const DEFAULT_MENU = [
  {id:'m1', cat:'Salgados', name:'Pastel de Carne Especial', desc:'Recheio farto de carne moída temperada com especiarias e azeitonas, extremamente suculento.', price:9.90, emoji:'🥟', image:'assets/images/pastel-carne.jpg', highlight:true, badge:'🔥 Mais Vendido', active:true},
  {id:'m2', cat:'Salgados', name:'Pastel de Queijo Puxa-Fio', desc:'Muita mussarela de primeira qualidade derretida puxando fio a cada mordida crocante.', price:8.90, emoji:'🧀', image:'assets/images/pastel-queijo.jpg', highlight:true, badge:'🧀 Muito Queijo', active:true},
  {id:'m3', cat:'Salgados', name:'Frango Cremoso c/ Catupiry', desc:'Peito de frango desfiado temperadinho combinado com o autêntico Catupiry cremoso.', price:10.90, emoji:'🍗', image:'assets/images/pastel-frango-catupiry.jpg', highlight:true, badge:'⭐ O Favorito', active:true},
  {id:'m4', cat:'Salgados', name:'Pastel de Pizza Especial', desc:'Presunto fatiado, mussarela derretida, orégano fresco e rodelas de tomate.', price:10.90, emoji:'🍕', image:'assets/images/pastel-pizza.jpg', highlight:false, badge:'', active:true},
  {id:'m5', cat:'Salgados', name:'Pastel de Palmito Especial', desc:'Palmito nobre em pedaços com molho branco super cremoso e cheiro verde.', price:9.90, emoji:'🌿', image:'assets/images/pastel-palmito.jpg', highlight:false, badge:'', active:true},
  {id:'m6', cat:'Doces', name:'Chocolate com Banana', desc:'Chocolate ao leite derretido com rodelas de banana, polvilhado com açúcar e canela.', price:9.90, emoji:'🍫', image:'assets/images/pastel-chocolate-banana.jpg', highlight:true, badge:'🍫 Irresistível', active:true},
  {id:'m7', cat:'Bebidas', name:'Caldo de Cana 300ml', desc:'Extraído na hora, trincando de gelado. O parceiro perfeito do pastel!', price:6.00, emoji:'🥤', image:'assets/images/caldo-de-cana.jpg', highlight:false, badge:'', active:true},
  {id:'m8', cat:'Bebidas', name:'Refrigerante Lata 350ml', desc:'Lata trincando de gelada pra descer perfeito.', price:6.00, emoji:'🥫', image:'assets/images/refrigerante-lata.jpg', highlight:false, badge:'', active:true}
];

let state = {
  config: {...DEFAULT_CONFIG},
  menu: [],
  orders: [],
  view: 'login',        // login | customer | employee-gate | employee
  step: 1,               // 1: Cardápio, 2: Sacola, 3: Horário, 4: Confirmado
  empTab: 'pedidos',
  cart: {},               // { itemId: qty }
  customer: {name:'', phone:''},
  selectedDate: null,
  selectedSlotKey: null,
  lastOrder: null,
  slotsCache: [],
  passcodeInput: '',
  passcodeError: false,
  empSelectedDateStr: null,
  editingItemId: null,
  addingItem: false,
  soundOn: true
};

// ============================================================
// CAMADA DE DADOS (SUPABASE)
// ============================================================
// Antes esta função salvava tudo em window.storage (memória do artefato).
// Agora ela lê/grava direto nas tabelas do Supabase configuradas em
// supabase-config.js. O restante do app (todas as telas, animações,
// sons etc.) continua exatamente igual.

async function loadConfig(){
  try{
    const { data, error } = await supabaseClient.from('config').select('*').eq('id', 1).single();
    if(error || !data) throw error || new Error('sem config');
    state.config = {
      slotInterval: data.slot_interval,
      maxPerSlot: data.max_per_slot,
      minLead: data.min_lead,
      openHour: data.open_hour,
      openMinute: data.open_minute,
      closeHour: data.close_hour,
      closeMinute: data.close_minute,
      maxDaysAhead: data.max_days_ahead
    };
  }catch(e){
    console.warn('Não foi possível carregar config do Supabase, usando padrão.', e);
    state.config = {...DEFAULT_CONFIG};
  }
}
async function saveConfig(){
  const c = state.config;
  const { error } = await supabaseClient.from('config').update({
    slot_interval: c.slotInterval,
    max_per_slot: c.maxPerSlot,
    min_lead: c.minLead,
    open_hour: c.openHour,
    open_minute: c.openMinute,
    close_hour: c.closeHour,
    close_minute: c.closeMinute,
    max_days_ahead: c.maxDaysAhead
  }).eq('id', 1);
  if(error) console.error('Falha ao salvar configurações no Supabase', error);
}

async function loadMenu(){
  try{
    const { data, error } = await supabaseClient.from('menu_items').select('*').order('cat');
    if(error) throw error;
    if(!data || data.length === 0){
      await seedDefaultMenu();
      return;
    }
    state.menu = data.map(rowToMenuItem);
  }catch(e){
    console.warn('Não foi possível carregar cardápio do Supabase, usando padrão local.', e);
    state.menu = DEFAULT_MENU.map(m=>({...m}));
  }
}
function rowToMenuItem(row){
  return {
    id: row.id, cat: row.cat, name: row.name, desc: row.description,
    price: Number(row.price), emoji: row.emoji, image: row.image,
    badge: row.badge, highlight: !!row.highlight, active: row.active !== false
  };
}
function menuItemToRow(item){
  return {
    id: item.id, cat: item.cat, name: item.name, description: item.desc,
    price: item.price, emoji: item.emoji, image: item.image,
    badge: item.badge, highlight: !!item.highlight, active: item.active !== false
  };
}
async function seedDefaultMenu(){
  const rows = DEFAULT_MENU.map(menuItemToRow);
  const { error } = await supabaseClient.from('menu_items').insert(rows);
  if(error) console.error('Falha ao popular cardápio inicial no Supabase', error);
  state.menu = DEFAULT_MENU.map(m=>({...m}));
}
async function saveMenuItem(item){
  const { error } = await supabaseClient.from('menu_items').upsert(menuItemToRow(item));
  if(error) console.error('Falha ao salvar item do cardápio no Supabase', error);
}
async function deleteMenuItemRemote(id){
  const { error } = await supabaseClient.from('menu_items').delete().eq('id', id);
  if(error) console.error('Falha ao remover item do cardápio no Supabase', error);
}

async function loadOrders(){
  try{
    const { data, error } = await supabaseClient.from('orders').select('*').order('created_at');
    if(error) throw error;
    state.orders = (data || []).map(rowToOrder);
  }catch(e){
    console.warn('Não foi possível carregar pedidos do Supabase.', e);
    state.orders = [];
  }
}
function rowToOrder(row){
  return {
    id: row.id, code: row.code, customerName: row.customer_name, phone: row.phone,
    items: row.items, subtotal: Number(row.subtotal), discount: Number(row.discount),
    total: Number(row.total), slotKey: row.slot_key, pickupLabel: row.pickup_label,
    pickupDayLabel: row.pickup_day_label, status: row.status, createdAt: row.created_at
  };
}
async function insertOrder(order){
  const { error } = await supabaseClient.from('orders').insert({
    id: order.id, code: order.code, customer_name: order.customerName, phone: order.phone,
    items: order.items, subtotal: order.subtotal, discount: order.discount, total: order.total,
    slot_key: order.slotKey, pickup_label: order.pickupLabel, pickup_day_label: order.pickupDayLabel,
    status: order.status, created_at: order.createdAt
  });
  if(error) console.error('Falha ao salvar pedido no Supabase', error);
}
async function updateOrderStatusRemote(id, status){
  const { error } = await supabaseClient.from('orders').update({status}).eq('id', id);
  if(error) console.error('Falha ao atualizar status do pedido no Supabase', error);
}

async function loadAllData(){
  await loadConfig();
  await loadMenu();
  await loadOrders();
  const snd = localStorage.getItem(SOUND_KEY);
  state.soundOn = snd ? snd === 'on' : true;
}

// Atualização em tempo real do painel da equipe (substitui polling manual):
// sempre que um pedido é inserido/alterado no Supabase, o painel recarrega sozinho.
let realtimeChannel = null;
function startEmployeeRealtime(){
  stopEmployeeRealtime();
  try{
    realtimeChannel = supabaseClient
      .channel('orders-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'orders'}, async ()=>{
        if(state.view === 'employee'){ await loadOrders(); render(); }
      })
      .subscribe();
  }catch(e){ console.warn('Realtime indisponível, painel não atualiza sozinho.', e); }
}
function stopEmployeeRealtime(){
  if(realtimeChannel){ supabaseClient.removeChannel(realtimeChannel); realtimeChannel = null; }
}

// ---------- SISTEMA DE ÁUDIO (ARQUIVO REAL + SYNTH FALLBACK) ----------
function playSoundEffect(type){
  if(!state.soundOn) return;
  // Tenta tocar o arquivo MP3 local da pasta assets/sounds/
  const audio = new Audio(`assets/sounds/${type}.mp3`);
  audio.play().catch(() => {
    // Se o arquivo não existir, executa o sintetizador WebAudio
    synthFallbackSound(type);
  });
}

function synthFallbackSound(type){
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);

    if(type === 'pop') {
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(); osc.stop(ctx.currentTime + 0.09);
    } else if(type === 'fizz' || type === 'chime' || type === 'ding') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.31);
    } else if(type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(); osc.stop(ctx.currentTime + 0.21);
    }
  } catch(e){}
}

function toggleSound(){
  state.soundOn = !state.soundOn;
  localStorage.setItem(SOUND_KEY, state.soundOn ? 'on' : 'off');
  if(state.soundOn) playSoundEffect('pop');
  render();
}

// ---------- AUXILIARES DE RENDER DE IMAGEM COM FALLBACK ----------
function renderImageHtml(src, fallbackEmoji, classAttr=""){
  return `
    <div class="media-box ${classAttr}">
      <img src="${src}" alt="Foto Comida" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <div class="fallback-emoji">${fallbackEmoji || '🥟'}</div>
    </div>
  `;
}

// ---------- FORMATADORES E CALCULOS ----------
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

function cartItems(){
  return Object.entries(state.cart)
    .filter(([id,qty]) => qty > 0)
    .map(([id,qty]) => ({...state.menu.find(m=>m.id===id), qty}))
    .filter(i => i.id);
}
function cartCount(){ return cartItems().reduce((s,i)=>s+i.qty,0); }

function calcTotals(){
  const items = cartItems();
  const subtotal = items.reduce((s,i)=>s+i.price*i.qty,0);
  const salgados = items.filter(i=>i.cat==='Salgados').reduce((s,i)=>s+i.qty,0);
  const bebidas = items.filter(i=>i.cat==='Bebidas').reduce((s,i)=>s+i.qty,0);
  const combos = Math.min(Math.floor(salgados/2), bebidas);
  const discount = combos * 2;
  return {subtotal, discount, total: subtotal-discount, combos};
}

// ---------- VIEWS PRINCIPAIS ----------
function render(){
  const app = document.getElementById('app');
  if(state.view === 'login') app.innerHTML = viewLogin();
  else if(state.view === 'customer') app.innerHTML = viewCustomer();
  else if(state.view === 'employee-gate') app.innerHTML = viewEmployeeGate();
  else if(state.view === 'employee') app.innerHTML = viewEmployee();
}

// ---------- VIEW 1: LOGIN E ESCOLHA DE PAPEL ----------
function viewLogin(){
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo">🥟</div>
        <div><div class="brand-title">Pastel Sem Fila</div><div class="brand-sub">Sabor & Agilidade</div></div>
      </div>
      <button class="icon-btn" onclick="toggleSound()">${state.soundOn?'🔊':'🔇'}</button>
    </header>
    <main>
      <div class="hero-card">
        <span class="hero-tag">🔥 Crocante, Quentinho & Sem Fila</span>
        <h2>Apenas peça, chegue e retire!</h2>
        <p>Escolha seus pastéis recheados favoritos, defina o horário de retirada e evite esperar no balcão.</p>
        <div class="fry-scene">
          ${renderImageHtml('assets/images/banner-destaque.gif', '🥟')}
          <div class="fry-pastel">🥟</div>
        </div>
      </div>

      <div class="role-grid">
        <button class="role-card" onclick="goCustomer()">
          <div class="role-icon-box">🧾</div>
          <div class="role-info">
            <h3>Fazer meu Pedido</h3>
            <p>Ver cardápio com fotos, escolher itens e agendar retirada sem fila.</p>
          </div>
        </button>

        <button class="role-card" onclick="goEmployeeGate()">
          <div class="role-icon-box">👨‍🍳</div>
          <div class="role-info">
            <h3>Área da Equipe</h3>
            <p>Gerenciar pedidos recebidos, alterar status da cozinha e editar cardápio.</p>
          </div>
        </button>
      </div>
    </main>
  `;
}

function goCustomer(){ playSoundEffect('pop'); state.view='customer'; state.step=1; render(); }
function goEmployeeGate(){ playSoundEffect('pop'); state.view='employee-gate'; state.passcodeInput=''; state.passcodeError=false; render(); }

// ---------- VIEW 2: FLUXO DO CLIENTE ----------
function viewCustomer(){
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo">🥟</div>
        <div><div class="brand-title">Pastel Sem Fila</div></div>
      </div>
      <div class="topbar-actions">
        <button class="icon-btn" onclick="toggleSound()">${state.soundOn?'🔊':'🔇'}</button>
        <button class="badge-btn" onclick="backToLogin()">Início</button>
      </div>
    </header>
    <main>
      ${state.step < 4 ? stepsNav() : ''}
      ${state.step === 1 ? stepMenu() : ''}
      ${state.step === 2 ? stepCart() : ''}
      ${state.step === 3 ? stepSlots() : ''}
      ${state.step === 4 ? stepConfirm() : ''}
    </main>
    ${state.step === 1 && cartCount() > 0 ? floatCartBar() : ''}
  `;
}

function stepsNav(){
  const steps = ['Cardápio', 'Sacola', 'Horário'];
  return `
    <div class="steps-nav">
      ${steps.map((s, idx) => {
        const num = idx + 1;
        const cls = num < state.step ? 'done' : (num === state.step ? 'active' : '');
        return `<div class="step-pill ${cls}">${num}. ${s}</div>`;
      }).join('')}
    </div>
  `;
}

function floatCartBar(){
  const t = calcTotals();
  return `
    <div class="cart-bar">
      <div>
        <div style="font-weight: 800; font-size: 15px;">${cartCount()} ${cartCount()===1?'item':'itens'} na sacola</div>
        <div style="font-size: 13px; opacity: 0.9;">Total: ${money(t.total)}</div>
      </div>
      <button class="btn btn-outline" style="padding: 8px 16px; font-size: 13px; color: var(--brand-red);" onclick="playSoundEffect('pop'); goStep(2)">Ver Sacola ➔</button>
    </div>
  `;
}

function stepMenu(){
  const activeItems = state.menu.filter(m => m.active !== false);
  const highlights = activeItems.filter(m => m.highlight);
  const categories = [...new Set(activeItems.map(m => m.cat))];

  return `
    <!-- Banner Desconto Combo -->
    <div class="promo-banner">
      <div class="promo-icon">🎁</div>
      <div class="promo-text">
        <h4>Combo 2x1 Pastelaria</h4>
        <p>Leve 2 Salgados + 1 Bebida e receba <b>R$ 2,00 de desconto</b> automático na sacola!</p>
      </div>
    </div>

    <!-- CARROSSEL HORIZONTAL DE DESTAQUES -->
    ${highlights.length > 0 ? `
      <div class="section-header">
        <h3>🔥 Destaques da Casa</h3>
        <span>Desperte a Fome</span>
      </div>
      <div class="carousel-wrap">
        ${highlights.map(item => `
          <div class="highlight-card">
            <div class="highlight-img-box">
              ${item.badge ? `<div class="highlight-badge">${item.badge}</div>` : ''}
              ${renderImageHtml(item.image, item.emoji)}
            </div>
            <div class="highlight-content">
              <div class="highlight-title">
                <span>${item.name}</span>
              </div>
              <div class="highlight-desc">${item.desc}</div>
              <div class="highlight-bottom">
                <span class="price-highlight">${money(item.price)}</span>
                <button class="btn btn-primary btn-sm" onclick="addToCart('${item.id}', event)">+ Adicionar</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- CARDÁPIO LISTA CATEGORIZADA -->
    ${categories.map(cat => `
      <div class="section-header">
        <h3>${cat}</h3>
      </div>
      ${activeItems.filter(m => m.cat === cat).map(foodCardRow).join('')}
    `).join('')}
  `;
}

function foodCardRow(item){
  const qty = state.cart[item.id] || 0;
  return `
    <div class="food-card">
      ${renderImageHtml(item.image, item.emoji, 'food-thumb')}
      <div class="food-details">
        <div>
          <div class="food-name">${item.name}</div>
          <div class="food-desc">${item.desc}</div>
        </div>
        <div class="food-bottom">
          <span class="food-price">${money(item.price)}</span>
          <div class="qty-selector">
            ${qty > 0 ? `<button class="qty-btn-sm" onclick="changeQty('${item.id}', -1)">−</button>` : ''}
            ${qty > 0 ? `<span class="qty-num">${qty}</span>` : ''}
            <button class="qty-btn-sm" style="background: var(--brand-red); color: #FFF;" onclick="addToCart('${item.id}', event)">+</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function addToCart(id, evt){
  playSoundEffect('pop');
  state.cart[id] = (state.cart[id] || 0) + 1;
  render();
}

function changeQty(id, delta){
  playSoundEffect('pop');
  const next = Math.max(0, (state.cart[id] || 0) + delta);
  if(next === 0) delete state.cart[id];
  else state.cart[id] = next;
  render();
}

function goStep(n){
  state.step = n;
  if(n === 3) prepSlotsStep();
  else render();
}

// ---------- PASSO 2: SACOLA ----------
function stepCart(){
  const items = cartItems();
  const t = calcTotals();
  if(items.length === 0){
    return `
      <div style="text-align: center; padding: 40px 10px;">
        <div style="font-size: 50px; margin-bottom: 10px;">🛒</div>
        <h3>Sua sacola está vazia</h3>
        <p style="color: var(--text-muted); font-size: 13px; margin: 8px 0 20px;">Adicione pastéis crocantes e bebidas para continuar.</p>
        <button class="btn btn-primary" onclick="goStep(1)">Ver Cardápio</button>
      </div>
    `;
  }

  return `
    <h2 style="font-size: 20px; margin-bottom: 14px;">Resumo do Pedido</h2>
    <div class="ticket-card">
      ${items.map(i => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--line);">
          <div>
            <div style="font-weight: 700; font-size: 14px;">${i.emoji} ${i.name}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${i.qty}x ${money(i.price)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800;">${money(i.price * i.qty)}</div>
            <button style="background: none; color: var(--brand-red); font-size: 11px; font-weight: 700;" onclick="changeQty('${i.id}', -${i.qty})">remover</button>
          </div>
        </div>
      `).join('')}

      <div style="margin-top: 14px; padding-top: 10px; border-top: 2px solid var(--text-main);">
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
          <span>Subtotal</span><span>${money(t.subtotal)}</span>
        </div>
        ${t.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--success); font-weight: 700; margin-bottom: 4px;">
            <span>🔥 Combo Desconto</span><span>-${money(t.discount)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; margin-top: 6px;">
          <span>Total</span><span>${money(t.total)}</span>
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 10px;">
      <button class="btn btn-outline" style="flex: 1;" onclick="goStep(1)">+ Adicionar Mais</button>
      <button class="btn btn-primary" style="flex: 1;" onclick="goStep(3)">Escolher Horário ➔</button>
    </div>
  `;
}

// ---------- PASSO 3: HORÁRIO DE RETIRADA ----------
async function prepSlotsStep(){
  await loadOrders();
  if(!state.selectedDate) state.selectedDate = startOfDay(new Date());
  state.slotsCache = generateSlots(state.selectedDate);
  render();
}

function stepSlots(){
  const t = calcTotals();
  return `
    <h2 style="font-size: 20px; margin-bottom: 4px;">Agendamento de Retirada</h2>
    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Vagas limitadas por horário para garantir pastéis quentinhos sem fila!</p>

    <div class="field">
      <label>Seu Nome</label>
      <input type="text" value="${state.customer.name}" oninput="state.customer.name=this.value" placeholder="Como podemos te chamar?">
    </div>

    <div class="field">
      <label>WhatsApp / Telefone</label>
      <input type="tel" value="${state.customer.phone}" oninput="state.customer.phone=this.value" placeholder="(11) 99999-9999">
    </div>

    <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">Dia da Retirada</label>
    ${renderDaySelector()}

    <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">Horários Disponíveis</label>
    ${renderSlotGrid()}

    <div style="display: flex; gap: 10px; margin-top: 10px;">
      <button class="btn btn-outline" onclick="goStep(2)">Voltar</button>
      <button class="btn btn-primary btn-block" id="confirmBtn" ${state.selectedSlotKey ? '' : 'disabled'} onclick="submitOrder()">
        Confirmar Pedido • ${money(t.total)}
      </button>
    </div>
  `;
}

function renderDaySelector(){
  const days = [];
  const base = startOfDay(new Date());
  for(let i = 0; i <= state.config.maxDaysAhead; i++){
    days.push({ date: new Date(base.getTime() + i*86400000), offset: i });
  }
  return `
    <div class="day-row">
      ${days.map(d => {
        const sel = sameDay(d.date, state.selectedDate);
        return `<button class="day-pill ${sel ? 'selected' : ''}" onclick="selectDate(${d.offset})">${dayLabel(d.date, d.offset)}</button>`;
      }).join('')}
    </div>
  `;
}

async function selectDate(offset){
  playSoundEffect('pop');
  const base = startOfDay(new Date());
  state.selectedDate = new Date(base.getTime() + offset*86400000);
  state.selectedSlotKey = null;
  await loadOrders();
  state.slotsCache = generateSlots(state.selectedDate);
  render();
}

function renderSlotGrid(){
  if(state.slotsCache.length === 0){
    return `<div style="text-align: center; padding: 20px; background: #FFF; border-radius: 12px; color: var(--text-muted); font-size: 13px;">Não há mais horários disponíveis neste dia. Escolha outra data acima.</div>`;
  }
  return `
    <div class="slot-grid">
      ${state.slotsCache.map(d => {
        const key = slotKeyFor(d);
        const used = countForSlot(key);
        const rem = state.config.maxPerSlot - used;
        const full = rem <= 0;
        const sel = state.selectedSlotKey === key;
        return `
          <button class="slot-btn ${full ? 'full' : ''} ${sel ? 'selected' : ''}" ${full ? 'disabled' : ''} onclick="selectSlot('${key}')">
            ${timeLabel(d)}
            <span class="rem">${full ? '' : rem + ' vaga' + (rem > 1 ? 's' : '')}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function selectSlot(key){ playSoundEffect('pop'); state.selectedSlotKey = key; render(); }

async function submitOrder(){
  if(!state.customer.name.trim() || !state.customer.phone.trim()){
    alert('Por favor, informe seu nome e telefone.'); return;
  }
  if(!state.selectedSlotKey){ alert('Escolha um horário de retirada.'); return; }

  const btn = document.getElementById('confirmBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Processando...'; }

  await loadOrders();
  const used = countForSlot(state.selectedSlotKey);
  if(used >= state.config.maxPerSlot){
    alert('Ops! Esse horário acabou de lotar. Escolha outro horário.');
    state.selectedSlotKey = null;
    state.slotsCache = generateSlots(state.selectedDate);
    render();
    return;
  }

  const items = cartItems();
  const t = calcTotals();
  const parts = state.selectedSlotKey.split('-');
  const pickupDateKey = parts.slice(0,3).join('-');
  const pickupDate = new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4]);
  const offset = Math.round((startOfDay(pickupDate) - startOfDay(new Date())) / 86400000);
  const pickupDayLabel = dayLabel(startOfDay(pickupDate), offset);

  const sameDayOrders = state.orders.filter(o => o.slotKey.startsWith(pickupDateKey+'-') && o.status !== 'cancelado').length;
  const code = '#' + pad(sameDayOrders + 1);

  const order = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    code,
    customerName: state.customer.name.trim(),
    phone: state.customer.phone.trim(),
    items: items.map(i=>({name:i.name, qty:i.qty, price:i.price})),
    subtotal: t.subtotal,
    discount: t.discount,
    total: t.total,
    slotKey: state.selectedSlotKey,
    pickupLabel: timeLabel(pickupDate),
    pickupDayLabel,
    status: 'pendente',
    createdAt: new Date().toISOString()
  };

  state.orders.push(order);
  await insertOrder(order);

  state.lastOrder = order;
  state.step = 4;
  state.cart = {};
  playSoundEffect('chime');
  render();
}

// ---------- PASSO 4: CONFIRMAÇÃO ----------
function stepConfirm(){
  const o = state.lastOrder;
  if(!o) return `<div style="text-align:center; padding: 30px;">Nenhum pedido recente.</div>`;

  return `
    <div style="text-align: center;">
      <h2 style="font-size: 22px; color: var(--success);">Pedido Confirmado! 🎉</h2>
      <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Já enviamos pra cozinha!</p>

      <div class="stamp-box">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase;">Senha de Retirada</div>
        <div class="stamp-code">${o.code}</div>
      </div>

      <p style="font-size: 14px; margin-bottom: 16px;">
        Retirada em <b>${o.pickupDayLabel} às ${o.pickupLabel}</b><br>
        <span style="font-size: 12px; color: var(--text-muted);">Chegue e informe sua senha no balcão.</span>
      </p>
    </div>

    <div class="ticket-card">
      <h4 style="margin-bottom: 8px;">Detalhes do Pedido</h4>
      ${o.items.map(i=>`
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0;">
          <span>${i.qty}x ${i.name}</span><span>${money(i.price*i.qty)}</span>
        </div>
      `).join('')}
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--line); font-weight: 800; display: flex; justify-content: space-between;">
        <span>Total a Pagar</span><span>${money(o.total)}</span>
      </div>
    </div>

    <button class="btn btn-primary btn-block" onclick="goStep(1)">Fazer Outro Pedido</button>
  `;
}

function backToLogin(){
  state.view = 'login';
  state.step = 1;
  state.cart = {};
  stopEmployeeRealtime();
  render();
}

// ---------- VIEW 3: GATE DA EQUIPE ----------
function viewEmployeeGate(){
  return `
    <header class="topbar">
      <div class="brand"><div class="brand-logo">👨‍🍳</div><div><div class="brand-title">Equipe</div></div></div>
      <button class="badge-btn" onclick="backToLogin()">Sair</button>
    </header>
    <main>
      <div class="ticket-card" style="max-width: 320px; margin: 40px auto 0;">
        <h3 style="text-align: center; margin-bottom: 14px;">Acesso Restrito</h3>
        <div class="field">
          <label>Senha de Acesso</label>
          <input type="password" id="passInput" value="${state.passcodeInput}" oninput="state.passcodeInput=this.value" onkeydown="if(event.key==='Enter')checkPasscode()">
        </div>
        ${state.passcodeError ? `<p style="color: var(--brand-red); font-size: 12px; margin-bottom: 10px;">Senha incorreta (Padrão: 1234)</p>` : ''}
        <button class="btn btn-primary btn-block" onclick="checkPasscode()">Entrar no Painel</button>
      </div>
    </main>
  `;
}

function checkPasscode(){
  if(state.passcodeInput === EMPLOYEE_PASSCODE){
    playSoundEffect('ding');
    state.view = 'employee';
    state.empTab = 'pedidos';
    enterEmployeeDashboard();
  } else {
    playSoundEffect('error');
    state.passcodeError = true;
    render();
  }
}
async function enterEmployeeDashboard(){
  await loadOrders();
  render();
  startEmployeeRealtime();
}

// ---------- VIEW 4: PAINEL DA EQUIPE ----------
function viewEmployee(){
  return `
    <header class="topbar">
      <div class="brand"><div class="brand-logo">👨‍🍳</div><div><div class="brand-title">Painel Cozinha</div></div></div>
      <button class="badge-btn" onclick="backToLogin()">Sair</button>
    </header>
    <main>
      <div class="tabs-bar">
        <button class="tab-item ${state.empTab==='pedidos'?'active':''}" onclick="setEmpTab('pedidos')">Pedidos</button>
        <button class="tab-item ${state.empTab==='cardapio'?'active':''}" onclick="setEmpTab('cardapio')">Cardápio</button>
        <button class="tab-item ${state.empTab==='config'?'active':''}" onclick="setEmpTab('config')">Config</button>
      </div>

      ${state.empTab === 'pedidos' ? empOrdersTab() : ''}
      ${state.empTab === 'cardapio' ? empMenuTab() : ''}
      ${state.empTab === 'config' ? empConfigTab() : ''}
    </main>
  `;
}

function setEmpTab(t){ playSoundEffect('pop'); state.empTab = t; render(); }

// Tab Pedidos
function empOrdersTab(){
  if(!state.empSelectedDateStr) state.empSelectedDateStr = dateKeyFor(new Date());
  const dateStr = state.empSelectedDateStr;
  const dayOrders = state.orders.filter(o => o.slotKey.startsWith(dateStr+'-'));

  return `
    <div style="display: flex; gap: 8px; margin-bottom: 14px;">
      <input type="date" value="${dateStr}" onchange="state.empSelectedDateStr=this.value; render();" style="padding: 8px; border-radius: 8px; border: 1px solid var(--line); flex: 1;">
      <button class="btn btn-outline btn-sm" onclick="state.empSelectedDateStr='${dateKeyFor(new Date())}'; render();">Hoje</button>
    </div>

    ${dayOrders.length === 0 ? `<div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">Nenhum pedido para esta data.</div>` : ''}

    ${dayOrders.map(o => `
      <div class="order-card-emp">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <span style="font-weight: 800; font-size: 16px;">${o.code}</span>
            <span style="font-size: 13px; color: var(--text-muted); margin-left: 6px;">${o.customerName}</span>
          </div>
          <span class="status-badge st-${o.status}">${o.status}</span>
        </div>
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">Retirada: <b>${o.pickupLabel}</b> • Tel: ${o.phone}</div>
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">
          ${o.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800;">${money(o.total)}</span>
          ${nextStatusBtn(o)}
        </div>
      </div>
    `).join('')}
  `;
}

function nextStatusBtn(o){
  const flow = { pendente: 'preparando', preparando: 'pronto', pronto: 'entregue' };
  const label = { pendente: 'Iniciar Preparo', preparando: 'Marcar Pronto', pronto: 'Finalizar Entregue' };
  const next = flow[o.status];
  if(!next) return '';
  return `<button class="btn btn-primary btn-sm" onclick="advanceOrderStatus('${o.id}', '${next}')">${label[o.status]}</button>`;
}

async function advanceOrderStatus(id, nextStatus){
  const order = state.orders.find(x => x.id === id);
  if(order){
    order.status = nextStatus;
    await updateOrderStatusRemote(id, nextStatus);
    playSoundEffect('ding');
    render();
  }
}

// Tab Cardápio
function empMenuTab(){
  return `
    <button class="btn btn-primary btn-block" style="margin-bottom: 14px;" onclick="state.addingItem=true; state.editingItemId=null; render();">+ Adicionar Novo Item</button>

    ${state.addingItem ? renderItemForm() : ''}

    ${state.menu.map(item => state.editingItemId === item.id ? renderItemForm(item) : `
      <div class="order-card-emp" style="${item.active === false ? 'opacity: 0.5;' : ''}">
        <div style="display: flex; gap: 10px; align-items: center;">
          ${renderImageHtml(item.image, item.emoji, 'food-thumb')}
          <div style="flex: 1;">
            <div style="font-weight: 700;">${item.name}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${item.cat} • ${money(item.price)}</div>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px;">
          <button class="btn btn-outline btn-sm" onclick="toggleActiveItem('${item.id}')">${item.active===false?'Ativar':'Desativar'}</button>
          <button class="btn btn-outline btn-sm" onclick="state.editingItemId='${item.id}'; state.addingItem=false; render();">Editar</button>
          <button class="btn btn-sm" style="background: var(--brand-red); color: #FFF;" onclick="deleteMenuItem('${item.id}')">Excluir</button>
        </div>
      </div>
    `).join('')}
  `;
}

function renderItemForm(item){
  const f = item || { name:'', cat:'Salgados', desc:'', price:'', emoji:'🥟', image:'', highlight:false, badge:'' };
  return `
    <div class="ticket-card">
      <h4>${item ? 'Editar Item' : 'Novo Item'}</h4>
      <div class="field"><label>Nome</label><input id="if-name" value="${f.name}"></div>
      <div class="field"><label>Categoria</label><input id="if-cat" value="${f.cat}"></div>
      <div class="field"><label>Descrição</label><input id="if-desc" value="${f.desc}"></div>
      <div class="field"><label>Preço (R$)</label><input id="if-price" type="number" step="0.10" value="${f.price}"></div>
      <div class="field"><label>Caminho Imagem (assets/images/nome.jpg)</label><input id="if-img" value="${f.image || ''}"></div>
      <div class="field"><label>Selo / Badge (Ex: 🔥 Mais Vendido)</label><input id="if-badge" value="${f.badge || ''}"></div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-outline" onclick="state.addingItem=false; state.editingItemId=null; render();">Cancelar</button>
        <button class="btn btn-primary" onclick="saveItemForm('${item?item.id:''}')">Salvar Item</button>
      </div>
    </div>
  `;
}

async function saveItemForm(id){
  const name = document.getElementById('if-name').value.trim();
  const cat = document.getElementById('if-cat').value.trim() || 'Outros';
  const desc = document.getElementById('if-desc').value.trim();
  const price = parseFloat(document.getElementById('if-price').value) || 0;
  const image = document.getElementById('if-img').value.trim();
  const badge = document.getElementById('if-badge').value.trim();

  if(!name){ alert('Nome é obrigatório'); return; }

  let item;
  if(id){
    item = state.menu.find(m => m.id === id);
    if(item) Object.assign(item, { name, cat, desc, price, image, badge });
  } else {
    item = { id:'m'+Date.now().toString(36), name, cat, desc, price, image, badge, active:true, emoji:'🥟', highlight:!!badge };
    state.menu.push(item);
  }

  await saveMenuItem(item);
  state.addingItem = false;
  state.editingItemId = null;
  playSoundEffect('ding');
  render();
}

async function toggleActiveItem(id){
  const item = state.menu.find(m => m.id === id);
  if(item){ item.active = !item.active; await saveMenuItem(item); render(); }
}

async function deleteMenuItem(id){
  if(!confirm('Excluir item do cardápio?')) return;
  state.menu = state.menu.filter(m => m.id !== id);
  await deleteMenuItemRemote(id);
  render();
}

// Tab Configurações
function empConfigTab(){
  const c = state.config;
  return `
    <div class="ticket-card">
      <h4 style="margin-bottom: 12px;">Configurações de Horário</h4>
      <div class="field">
        <label>Limite de Pedidos por Slot</label>
        <input type="number" id="cfg-max" value="${c.maxPerSlot}">
      </div>
      <div class="field">
        <label>Intervalo dos Slots (Minutos)</label>
        <input type="number" id="cfg-interval" value="${c.slotInterval}">
      </div>
      <div class="field">
        <label>Antecedência Mínima (Minutos)</label>
        <input type="number" id="cfg-lead" value="${c.minLead}">
      </div>
      <button class="btn btn-primary btn-block" onclick="saveSettings()">Salvar Ajustes</button>
    </div>
  `;
}

async function saveSettings(){
  state.config.maxPerSlot = parseInt(document.getElementById('cfg-max').value) || 5;
  state.config.slotInterval = parseInt(document.getElementById('cfg-interval').value) || 15;
  state.config.minLead = parseInt(document.getElementById('cfg-lead').value) || 20;
  await saveConfig();
  playSoundEffect('ding');
  alert('Configurações salvas!');
  render();
}

// ---------- INICIALIZAÇÃO ----------
async function init(){
  await loadAllData();
  render();
}
init();

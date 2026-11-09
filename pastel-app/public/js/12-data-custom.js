// ============================================================
// DADOS: PASTEL PERSONALIZADO
// O cliente escolhe o tamanho (P/M/G) e QUANTAS PORÇÕES de cada ingrediente.
//   Cada ingrediente define o que é 1 porção ("fatia" = 25 g, "colher" = 20 g...)
//   - Preço = preço base do tamanho + (porções x preço da porção) de cada ingrediente
//   - Baixa = massa do tamanho + (porções x peso da porção) de cada ingrediente
//   - O tamanho limita o total de porções (ex.: Pequeno até 3, Médio até 5)
// Uma linha da sacola é: { uid, sizeId, picks: { ingredienteId: nPorções }, qty }
// A baixa de verdade acontece no banco (consume_stock); aqui ficam as contas
// que mostram preço, gramatura e disponibilidade na tela.
// ============================================================

const CUSTOM_CAT = 'Personalizado'; // "categoria" do pastel personalizado nas promoções/combos

// ---------- carregar / salvar ----------
function rowToCustomSize(r){
  return {
    id: r.id, name: r.name, basePrice: Number(r.base_price),
    factor: Number(r.factor == null ? 1 : r.factor),        // (não usado mais; mantido no banco)
    doughQty: Number(r.dough_qty),
    maxPortions: Number(r.max_portions || 0),                // 0 = sem limite
    sort: Number(r.sort || 0)
  };
}

async function loadCustomConfig(){
  try{
    const [sz, st] = await Promise.all([
      supabaseClient.from('custom_sizes').select('*').order('sort'),
      supabaseClient.from('custom_settings').select('*').eq('id', 1).maybeSingle()
    ]);
    if(sz.error) throw sz.error;
    if(st.error) throw st.error;
    state.customSizes = (sz.data || []).map(rowToCustomSize);
    state.customSettings = st.data
      ? { active: st.data.active !== false, doughId: st.data.dough_id || null }
      : { active: true, doughId: null };
  }catch(e){
    console.warn('Pastel personalizado indisponível (rodou a migração migration-personalizado.sql?)', e);
    state.customSizes = [];
    state.customSettings = { active: false, doughId: null };
  }
}

async function saveCustomSizes(sizes){
  const rows = sizes.map(s => ({
    id: s.id, name: s.name, base_price: s.basePrice, factor: s.factor == null ? 1 : s.factor,
    dough_qty: s.doughQty, max_portions: s.maxPortions || 0, sort: s.sort
  }));
  const { error } = await supabaseClient.from('custom_sizes').upsert(rows);
  if(error) console.error('Falha ao salvar tamanhos', error);
  return error || null;
}

async function saveCustomSettings(settings){
  const { error } = await supabaseClient.from('custom_settings')
    .upsert({ id: 1, active: settings.active, dough_id: settings.doughId });
  if(error) console.error('Falha ao salvar configuração do pastel personalizado', error);
  return error || null;
}

async function saveIngredientCustom(id, f){
  const { error } = await supabaseClient.from('ingredients').update({
    custom_enabled: f.customEnabled, custom_category: f.customCategory,
    custom_portion: f.customPortion, custom_price: f.customPrice,
    custom_portion_label: f.customPortionLabel, custom_max_qty: f.customMaxQty
  }).eq('id', id);
  if(error) console.error('Falha ao salvar ingrediente do personalizado', error);
  return error || null;
}

// ---------- textos: porção, gramatura, plural ----------
function pluralizePt(word){
  const w = String(word || '').trim();
  if(!w) return w;
  const lower = w.toLowerCase();
  if(lower.endsWith('ão')) return w.slice(0, -2) + 'ões';
  if(lower.endsWith('m')) return w.slice(0, -1) + 'ns';
  if(/[rz]$/.test(lower)) return w + 'es';
  if(lower.endsWith('s')) return w;
  return w + 's';
}
function portionNoun(ing, n){
  const label = String(ing.customPortionLabel || 'porção').trim() || 'porção';
  return n === 1 ? label : pluralizePt(label);
}
// 0,025 kg -> "25 g"; 0,5 L -> "500 ml"; g/ml/un ficam como estão
function humanAmount(value, unit){
  if(unit === 'kg' && value < 1) return fmtQty(round2(value * 1000)) + ' g';
  if(unit === 'L' && value < 1) return fmtQty(round2(value * 1000)) + ' ml';
  return fmtQty(value) + ' ' + unit;
}
// "25 g" (n=1) / "50 g" (n=2). Vazio se o ingrediente não tem peso definido.
function portionAmountText(ing, n = 1){
  if(!(ing.customPortion > 0)) return '';
  return humanAmount(ing.customPortion * n, ing.unit);
}
// "2 fatias de Mussarela (50 g)"
function pickText(ing, n){
  const amount = portionAmountText(ing, n);
  return `${n} ${portionNoun(ing, n)} de ${ing.name}` + (amount ? ` (${amount})` : '');
}

// ---------- picks (porções escolhidas) ----------
function customSizeById(id){ return state.customSizes.find(s => s.id === id); }

function pickEntries(picks){
  return Object.entries(picks || {}).filter(([, n]) => n > 0);
}
function totalPortions(picks){
  return pickEntries(picks).reduce((s, [, n]) => s + n, 0);
}
function picksKey(picks){
  return JSON.stringify(pickEntries(picks).sort((a, b) => a[0].localeCompare(b[0])));
}
// soma dos gramas do recheio (só ingredientes medidos em g/kg)
function fillingGrams(picks){
  let g = 0;
  for(const [id, n] of pickEntries(picks)){
    const ing = ingredientById(id);
    if(!ing || !(ing.customPortion > 0)) continue;
    if(ing.unit === 'g') g += ing.customPortion * n;
    else if(ing.unit === 'kg') g += ing.customPortion * n * 1000;
  }
  return g;
}

// ---------- preço ----------
function customUnitPrice(sizeId, picks){
  const size = customSizeById(sizeId);
  if(!size) return 0;
  let price = size.basePrice;
  for(const [id, n] of pickEntries(picks)){
    const ing = ingredientById(id);
    if(ing && ing.customEnabled) price += (ing.customPrice || 0) * n;
  }
  return round2(price);
}
function customLineTotal(line){ return round2(customUnitPrice(line.sizeId, line.picks) * line.qty); }
function customCartCount(){ return state.customCart.reduce((s, l) => s + l.qty, 0); }

function customLineLabel(line){
  const size = customSizeById(line.sizeId);
  return 'Pastel Personalizado' + (size ? ` (${size.name})` : '');
}
function customLineIngredientTexts(line){
  return pickEntries(line.picks)
    .map(([id, n]) => { const ing = ingredientById(id); return ing ? pickText(ing, n) : null; })
    .filter(Boolean);
}
// Como o item aparece dentro do pedido gravado (a cozinha vê porções e gramas)
function customOrderItem(line){
  const size = customSizeById(line.sizeId);
  return {
    name: customLineLabel(line), qty: line.qty,
    price: customUnitPrice(line.sizeId, line.picks),
    custom: {
      size: size ? size.name : '',
      ingredients: customLineIngredientTexts(line),
      picks: pickEntries(line.picks).map(([id, n]) => {
        const ing = ingredientById(id);
        return { id, n, name: ing ? ing.name : id, amount: ing ? portionAmountText(ing, n) : '' };
      })
    }
  };
}

// ---------- estoque que cada linha consome ----------
function customLineNeeds(line){
  const needs = {};
  const size = customSizeById(line.sizeId);
  if(!size) return needs;
  if(state.customSettings.doughId){
    needs[state.customSettings.doughId] = size.doughQty * line.qty;
  }
  for(const [id, n] of pickEntries(line.picks)){
    const ing = ingredientById(id);
    if(!ing || !ing.customEnabled) continue;
    needs[id] = (needs[id] || 0) + ing.customPortion * n * line.qty;
  }
  return needs;
}

// ---------- o que o cliente pode escolher ----------
function enabledCustomIngredients(){
  return state.ingredients.filter(i => i.customEnabled);
}
// máximo de porções que o cliente pode pedir desse ingrediente num pastel (0 = sem limite)
function ingredientMaxPortions(ing){ return ing.customMaxQty > 0 ? ing.customMaxQty : 0; }

// O pastel personalizado tem condição de existir? (só olha o estoque, não a sacola)
function customStockAvailable(){
  if(!state.customSettings.active || state.customSizes.length === 0) return false;
  const ings = enabledCustomIngredients();
  if(ings.length === 0) return false;
  const doughId = state.customSettings.doughId;
  const dough = doughId ? ingredientById(doughId) : null;
  return state.customSizes.some(size => {
    if(doughId && (!dough || dough.stock + STOCK_EPS < size.doughQty)) return false;
    return ings.some(ing => ing.customPortion <= 0 || ing.stock + STOCK_EPS >= ing.customPortion);
  });
}

function customMinPrice(){
  if(state.customSizes.length === 0) return 0;
  return Math.min(...state.customSizes.map(s => s.basePrice));
}

// Um tamanho está disponível? (massa suficiente, considerando o que já está na sacola)
function builderSizeAvailable(sizeId){
  const test = { sizeId, picks: {}, qty: 1 };
  return !cartExceedsStock(state.cart, [...state.customCart, test]);
}

function builderDraftLine(){
  const d = state.builder;
  return { sizeId: d.sizeId, picks: d.picks, qty: d.qty };
}
function builderDraftExceeds(){
  return cartExceedsStock(state.cart, [...state.customCart, builderDraftLine()]);
}

// Dá pra colocar mais 1 porção desse ingrediente no pastel que está sendo montado?
// Devolve null se pode, ou o motivo ('max' | 'size' | 'stock').
function builderPlusBlockReason(ingId){
  const d = state.builder;
  const ing = ingredientById(ingId);
  if(!ing) return 'stock';
  const cur = d.picks[ingId] || 0;
  const max = ingredientMaxPortions(ing);
  if(max > 0 && cur + 1 > max) return 'max';
  const size = customSizeById(d.sizeId);
  if(size && size.maxPortions > 0 && totalPortions(d.picks) + 1 > size.maxPortions) return 'size';
  const test = { ...d.picks, [ingId]: cur + 1 };
  if(cartExceedsStock(state.cart, [...state.customCart, { sizeId: d.sizeId, picks: test, qty: d.qty }])) return 'stock';
  return null;
}

// Maior quantidade desse pastel que o estoque aguenta (0 se nem 1 cabe)
function builderMaxQty(){
  const d = state.builder;
  let max = 0;
  for(let q = 1; q <= 30; q++){
    const line = { sizeId: d.sizeId, picks: d.picks, qty: q };
    if(cartExceedsStock(state.cart, [...state.customCart, line])) break;
    max = q;
  }
  return max;
}

// Ajusta as porções escolhidas ao limite do tamanho e ao estoque. Devolve true se mudou algo.
function fitPicksToSize(sizeId, picks, qty){
  let changed = false;
  const size = customSizeById(sizeId);
  if(size && size.maxPortions > 0){
    while(totalPortions(picks) > size.maxPortions){
      const [id] = pickEntries(picks).sort((a, b) => b[1] - a[1])[0];
      picks[id] -= 1;
      if(picks[id] <= 0) delete picks[id];
      changed = true;
    }
  }
  for(const id of Object.keys(picks)){
    while(picks[id] > 0 && cartExceedsStock(state.cart, [...state.customCart, { sizeId, picks, qty }])){
      picks[id] -= 1;
      changed = true;
    }
    if(picks[id] <= 0) delete picks[id];
  }
  return changed;
}
